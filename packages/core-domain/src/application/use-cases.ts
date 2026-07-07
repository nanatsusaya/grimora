/**
 * Application use cases (ADR 0003 §1, ADR 0004 §3): the command handlers that authorize, rehydrate the
 * aggregate, call pure Domain decide-functions, and append the resulting events with optimistic
 * concurrency. Every use case performs an explicit `PolicyPort` check (default-deny, ADR 0010 §2) — the
 * *same* check the AI tool path reuses (ADR 0008 §2), which the authz-parity test exercises.
 *
 * These are the intent-named command operations (ADR 0011 §1); writes are local + event-sourced, not
 * REST CRUD.
 */

import type { EntityId, EventEnvelope, PersistedEvent, Result } from "@grimora/shared-types";
import { err } from "@grimora/shared-types";
import {
  applyCampaign,
  createCampaign as decideCreateCampaign,
  emptyCampaign,
} from "../domain/campaign";
import {
  applyCharacter,
  type CharacterState,
  createCharacter as decideCreateCharacter,
  rollCheck as decideRollCheck,
  setAttribute as decideSetAttribute,
  emptyCharacter,
} from "../domain/character";
import { type AppError, appError } from "../domain/errors";
import type { NewEvent, StoredEvent } from "../domain/events";
import type {
  Actor,
  ClockPort,
  EventStorePort,
  IdGeneratorPort,
  PolicyPort,
  RuleSystemRegistryPort,
} from "./ports";

/** The ports a command handler needs. */
export interface CommandDeps {
  readonly events: EventStorePort;
  readonly ids: IdGeneratorPort;
  readonly clock: ClockPort;
  readonly policy: PolicyPort;
  readonly rules: RuleSystemRegistryPort;
}

/** Rehydrate an aggregate by folding its stored stream (ADR 0004 §3). */
async function rehydrate<S>(
  events: EventStorePort,
  streamId: EntityId,
  empty: S,
  apply: (state: S, event: StoredEvent) => S,
): Promise<{ readonly state: S; readonly version: number }> {
  const stream = await events.readStream(streamId);
  let state = empty;
  for (const persisted of stream) {
    state = apply(state, persisted);
  }
  const version = stream.length > 0 ? (stream[stream.length - 1] as PersistedEvent).version : 0;
  return { state, version };
}

/** Wrap decided domain events into full `shared-types` envelopes ready to append (ADR 0004 §2). */
function toEnvelopes(
  deps: CommandDeps,
  streamId: EntityId,
  aggregateType: string,
  baseVersion: number,
  newEvents: readonly NewEvent[],
  actor: Actor,
): readonly EventEnvelope[] {
  return newEvents.map((event, index) => ({
    id: deps.ids.newId(),
    aggregateId: streamId,
    aggregateType,
    type: event.type,
    version: baseVersion + index + 1,
    schemaVersion: 1,
    occurredAt: deps.clock.now(),
    metadata: { actorId: actor.userId },
    payload: event.payload,
  }));
}

/** Create a campaign (owner = the creating actor). */
export async function createCampaign(
  deps: CommandDeps,
  input: { readonly campaignId: EntityId; readonly name: string; readonly actor: Actor },
): Promise<Result<void, AppError>> {
  if (!deps.policy.can(input.actor, "campaign.create", {})) {
    return err(appError("campaign.forbidden", "Forbidden"));
  }
  const { state, version } = await rehydrate(
    deps.events,
    input.campaignId,
    emptyCampaign(input.campaignId),
    applyCampaign,
  );
  const decided = decideCreateCampaign(state, input.name, input.actor.userId);
  if (!decided.ok) return decided;
  return deps.events.append(
    input.campaignId,
    version,
    toEnvelopes(deps, input.campaignId, "campaign", version, decided.value, input.actor),
  );
}

/** Create a character bound to one loaded rule system, stamping plugin provenance (ADR 0006 §4). */
export async function createCharacter(
  deps: CommandDeps,
  input: {
    readonly characterId: EntityId;
    readonly name: string;
    readonly campaignId: EntityId;
    readonly ruleSystemId: string;
    readonly actor: Actor;
  },
): Promise<Result<void, AppError>> {
  if (!deps.policy.can(input.actor, "character.create", {})) {
    return err(appError("character.forbidden", "Forbidden"));
  }
  const provenance = deps.rules.getProvenance(input.ruleSystemId);
  if (!provenance) {
    return err(appError("character.rule_system_not_loaded", "NotFound"));
  }
  const { state, version } = await loadCharacter(deps, input.characterId);
  const decided = decideCreateCharacter(state, {
    name: input.name,
    campaignId: input.campaignId,
    ownerId: input.actor.userId,
    ruleSystemId: input.ruleSystemId,
    pluginId: provenance.pluginId,
    pluginVersion: provenance.pluginVersion,
  });
  if (!decided.ok) return decided;
  return deps.events.append(
    input.characterId,
    version,
    toEnvelopes(deps, input.characterId, "character", version, decided.value, input.actor),
  );
}

/** Set a character attribute (resource-scoped authz: only the owner may edit). */
export async function setAttribute(
  deps: CommandDeps,
  input: {
    readonly characterId: EntityId;
    readonly attributeId: string;
    readonly value: number;
    readonly actor: Actor;
  },
): Promise<Result<void, AppError>> {
  const { state, version } = await loadCharacter(deps, input.characterId);
  if (!state.exists) return err(appError("character.not_found", "NotFound"));
  if (!deps.policy.can(input.actor, "character.setAttribute", { ownerId: state.ownerId })) {
    return err(appError("character.forbidden", "Forbidden"));
  }
  const bounds = deps.rules.getRatedTrait(state.ruleSystemId, input.attributeId);
  if (!bounds) {
    return err(appError("character.unknown_attribute", "Validation"));
  }
  const decided = decideSetAttribute(state, input.attributeId, input.value, bounds);
  if (!decided.ok) return decided;
  return deps.events.append(
    input.characterId,
    version,
    toEnvelopes(deps, input.characterId, "character", version, decided.value, input.actor),
  );
}

/** Roll a check for a character (resource-scoped authz: only the owner may roll). */
export async function rollCheck(
  deps: CommandDeps,
  input: { readonly characterId: EntityId; readonly checkId: string; readonly actor: Actor },
): Promise<Result<void, AppError>> {
  const { state, version } = await loadCharacter(deps, input.characterId);
  if (!state.exists) return err(appError("character.not_found", "NotFound"));
  if (!deps.policy.can(input.actor, "character.rollCheck", { ownerId: state.ownerId })) {
    return err(appError("character.forbidden", "Forbidden"));
  }
  const check = deps.rules.getCheck(state.ruleSystemId, input.checkId);
  if (!check) {
    return err(appError("character.unknown_check", "NotFound"));
  }
  const decided = decideRollCheck(state, check, deps.ids.newId());
  if (!decided.ok) return decided;
  return deps.events.append(
    input.characterId,
    version,
    toEnvelopes(deps, input.characterId, "character", version, decided.value, input.actor),
  );
}

/** Rehydrate a character (shared by the character use cases). */
function loadCharacter(
  deps: CommandDeps,
  characterId: EntityId,
): Promise<{ readonly state: CharacterState; readonly version: number }> {
  return rehydrate(deps.events, characterId, emptyCharacter(characterId), applyCharacter);
}
