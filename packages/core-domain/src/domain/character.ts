/**
 * The Character aggregate (ADR 0004 §1, ADR 0020 core generic-entity model): identity + a
 * **schema-driven trait container** (attribute id → value, populated per the bound rule system) + the
 * per-aggregate roll sequence used to seed dice deterministically (ADR 0021 §3).
 *
 * `rollCheck` is the **core roll orchestration** (ADR 0021 §5): it builds the request, rolls with a
 * seeded RNG derived purely from state, and calls the plugin's `resolve` (the mechanic). It stays pure
 * — the request id is passed in (generated via `IdGeneratorPort` at the application layer), and the
 * RNG is derived from state, so a replay reproduces the roll and the stored result is authoritative.
 */

import type {
  CheckDefinition,
  RollOutcome,
  RollRequest,
  RollResult,
  SeededRng,
} from '@grimora/plugin-sdk';
import type { EntityId } from '@grimora/shared-types';
import { err, ok, type Result } from '@grimora/shared-types';
import { type AppError, appError } from './errors';
import type { CharacterCheckRolled, CharacterCreated, CharacterEvent, StoredEvent } from './events';
import { deriveSeed, makeSeededRng } from './rng';

/** Folded character state, including the generic trait container and the roll sequence. */
export interface CharacterState {
  readonly id: EntityId;
  readonly exists: boolean;
  readonly version: number;
  readonly name: string;
  readonly campaignId: EntityId;
  readonly ownerId: EntityId;
  /** The single bound rule system (ADR 0006 §9) + its provenance (ADR 0006 §4). */
  readonly ruleSystemId: string;
  readonly pluginId: string;
  readonly pluginVersion: string;
  /** Generic, plugin-populated trait values by abstract id (ADR 0020). */
  readonly attributes: Readonly<Record<string, number>>;
  /** Monotonic per-aggregate roll counter; seeds the RNG so rolls are reproducible (ADR 0021 §3). */
  readonly rollSequence: number;
}

/** Identity/provenance needed to create a character, bound to exactly one rule system. */
export interface CreateCharacterInput {
  readonly name: string;
  readonly campaignId: EntityId;
  readonly ownerId: EntityId;
  readonly ruleSystemId: string;
  readonly pluginId: string;
  readonly pluginVersion: string;
}

/** The zero state for a character stream before any event is applied. */
export function emptyCharacter(id: EntityId): CharacterState {
  return {
    id,
    exists: false,
    version: 0,
    name: '',
    campaignId: '' as EntityId,
    ownerId: '' as EntityId,
    ruleSystemId: '',
    pluginId: '',
    pluginVersion: '',
    attributes: {},
    rollSequence: 0,
  };
}

/**
 * Fold one stored event into character state (ADR 0004 §1). For `character.checkRolled`, the roll
 * sequence is restored from the stored seed so a replay re-derives the *next* roll's seed identically
 * (determinism, ADR 0021 §3) — the roll itself is never re-executed (ADR 0022 §6).
 */
export function applyCharacter(state: CharacterState, event: StoredEvent): CharacterState {
  const next = { ...state, version: event.version };
  switch (event.type) {
    case 'character.created': {
      const p = event.payload as CharacterCreated['payload'];
      return {
        ...next,
        exists: true,
        name: p.name,
        campaignId: p.campaignId,
        ownerId: p.ownerId,
        ruleSystemId: p.ruleSystemId,
        pluginId: p.pluginId,
        pluginVersion: p.pluginVersion,
        attributes: {},
        rollSequence: 0,
      };
    }
    case 'character.attributeSet': {
      const p = event.payload as { attributeId: string; value: number };
      return { ...next, attributes: { ...state.attributes, [p.attributeId]: p.value } };
    }
    case 'character.checkRolled': {
      const p = event.payload as CharacterCheckRolled['payload'];
      /*
       * INVARIANT (ADR 0021 §3 + ADR 0024 §4, 2026-07-09 amendment): the roll sequence folds ONLY
       * from this aggregate's own stream, so a roll event MUST stay on the character stream and must
       * never be routed to a separate audience stream to hide it. If a hidden roll lived on another
       * stream, this fold would not see it, the sequence would not advance, and the next visible roll
       * would re-use the same seed (a determinism bug). `seed` is therefore classified `nonPersonal`
       * and kept plaintext (ADR 0023 §2) so every authorized replica can advance the counter even when
       * the roll's *outcome* is encrypted per-audience. Hidden rolls hide the outcome, not the seed.
       */
      return { ...next, rollSequence: Math.max(state.rollSequence, p.result.seed.sequence) };
    }
    default:
      return next;
  }
}

/**
 * Decide the events for creating a character bound to one rule system (ADR 0006 §9), recording plugin
 * provenance (ADR 0006 §4).
 */
export function createCharacter(
  state: CharacterState,
  input: CreateCharacterInput,
): Result<readonly CharacterEvent[], AppError> {
  if (state.exists) {
    return err(appError('character.already_exists', 'Conflict'));
  }
  if (input.name.trim() === '') {
    return err(appError('character.name_required', 'Validation'));
  }
  return ok([{ type: 'character.created', payload: input }]);
}

/**
 * Decide the event for setting an attribute to an absolute value during generation (ADR 0004 §10:
 * intent = absolute *set*). Validates existence and the plugin-declared [min, max] bounds.
 *
 * @param state     current character state
 * @param attributeId  abstract attribute id (plugin vocabulary)
 * @param value     the absolute value to set
 * @param bounds    the plugin's declared bounds for this attribute
 */
export function setAttribute(
  state: CharacterState,
  attributeId: string,
  value: number,
  bounds: { readonly min: number; readonly max: number },
): Result<readonly CharacterEvent[], AppError> {
  if (!state.exists) {
    return err(appError('character.not_found', 'NotFound'));
  }
  if (value < bounds.min || value > bounds.max) {
    return err(appError('character.attribute_out_of_range', 'Validation'));
  }
  return ok([{ type: 'character.attributeSet', payload: { attributeId, value } }]);
}

/** Roll every die of every term with the seeded RNG, returning raw pips grouped per term. */
function rollTerms(check: CheckDefinition, rng: SeededRng): number[][] {
  return check.terms.map((term) => {
    const pips: number[] = [];
    for (let i = 0; i < term.count; i++) {
      pips.push(rng.rollDie(term.sides));
    }
    return pips;
  });
}

/**
 * Core roll orchestration (ADR 0021 §5): build the request, roll deterministically, and delegate the
 * *mechanic* to the plugin's `resolve`. Pure — the RNG is derived from state, the request id is passed
 * in, and the resolution function is a pure plugin function.
 *
 * @param state      current character state (must exist; the seed/targets come from it)
 * @param check      the plugin's check definition (dice shape + resolution mechanic)
 * @param requestId  a freshly-generated id for this roll (from `IdGeneratorPort` at the app layer)
 * @returns          a single `character.checkRolled` event, or a mapped plugin/validation error
 */
export function rollCheck(
  state: CharacterState,
  check: CheckDefinition,
  requestId: EntityId,
): Result<readonly CharacterEvent[], AppError> {
  if (!state.exists) {
    return err(appError('character.not_found', 'NotFound'));
  }

  // Build the numeric targets from the character's trait container (attributes + optional skill).
  const targetIds = check.skillId ? [...check.attributeIds, check.skillId] : check.attributeIds;
  const targets: Record<string, number> = {};
  for (const id of targetIds) {
    const value = state.attributes[id];
    if (value === undefined) {
      return err(appError('character.missing_trait_for_check', 'Validation'));
    }
    targets[id] = value;
  }

  const sequence = state.rollSequence + 1;
  const seed = { streamId: state.id, sequence } as const;
  const rng = makeSeededRng(deriveSeed(state.id, sequence));
  const rolls = rollTerms(check, rng);

  const resolved = check.resolve({ rolls, targets }, { rng, log: () => {} });
  if (!resolved.ok) {
    return err(appError(resolved.error.code, resolved.error.category, resolved.error.messageKey));
  }
  const outcome: RollOutcome = resolved.value;

  const request: RollRequest = {
    id: requestId,
    terms: check.terms,
    context: { aggregateId: state.id, checkId: check.id, targets },
    visibility: 'public',
  };
  const result: RollResult = { requestId, rolls, outcome, seed };

  return ok([
    {
      type: 'character.checkRolled',
      payload: {
        checkId: check.id,
        request,
        result,
        pluginId: state.pluginId,
        pluginVersion: state.pluginVersion,
      },
    },
  ]);
}
