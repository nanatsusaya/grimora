/**
 * The character-sheet projection (ADR 0004 §5): a denormalized read model the UI reads instead of the
 * event store. Deterministic and idempotent (keyed by store `position` + checkpointed), so it can be
 * **rebuilt** from `position 0` to byte-identical state — one of the skeleton's pass criteria (ADR
 * 0022 §9). Derived values are (re)computed by the core formula interpreter over the plugin's
 * `derivedValue` formulas (ADR 0020/0021).
 */

import type { EntityId, PersistedEvent } from "@grimora/shared-types";
import { describeEvent } from "../domain/describe";
import type { CharacterAttributeSet, CharacterCreated } from "../domain/events";
import { evaluateFormula } from "../domain/formula";
import type { EventStorePort, ReadModelStorePort, RuleSystemRegistryPort } from "./ports";

/** Read-model collection + projection (checkpoint) name. */
export const CHARACTER_SHEET = "characterSheet";

/** The denormalized character sheet the UI renders (attributes + computed derived values + history). */
export interface CharacterSheet {
  readonly characterId: EntityId;
  readonly name: string;
  readonly campaignId: EntityId;
  readonly ruleSystemId: string;
  readonly attributes: Readonly<Record<string, number>>;
  readonly derived: Readonly<Record<string, number>>;
  readonly history: readonly string[];
}

/** The ports the projection reads from / writes to. */
export interface ProjectionDeps {
  readonly events: EventStorePort;
  readonly reads: ReadModelStorePort;
  readonly rules: RuleSystemRegistryPort;
}

/** Recompute all derived values for a sheet from its current attribute values (ADR 0020). */
function computeDerived(
  deps: ProjectionDeps,
  ruleSystemId: string,
  attributes: Readonly<Record<string, number>>,
): Record<string, number> {
  const ruleSystem = deps.rules.getRuleSystem(ruleSystemId);
  const derived: Record<string, number> = {};
  if (!ruleSystem) return derived;
  for (const trait of ruleSystem.traits) {
    if (trait.kind !== "derivedValue") continue;
    const result = evaluateFormula(trait.formula, { traits: attributes });
    if (result.ok) derived[trait.id] = result.value;
  }
  return derived;
}

/** Fold one character event into its sheet (or create it), then persist the updated sheet. */
async function applyToSheet(deps: ProjectionDeps, event: PersistedEvent): Promise<void> {
  const existing = await deps.reads.get<CharacterSheet>(CHARACTER_SHEET, event.aggregateId);

  if (event.type === "character.created") {
    const p = event.payload as CharacterCreated["payload"];
    const sheet: CharacterSheet = {
      characterId: event.aggregateId,
      name: p.name,
      campaignId: p.campaignId,
      ruleSystemId: p.ruleSystemId,
      attributes: {},
      derived: {},
      history: [describeEvent(event)],
    };
    await deps.reads.put(CHARACTER_SHEET, event.aggregateId, sheet);
    return;
  }

  if (!existing) return; // out-of-order guard; character.created always precedes its other events

  if (event.type === "character.attributeSet") {
    const p = event.payload as CharacterAttributeSet["payload"];
    const attributes = { ...existing.attributes, [p.attributeId]: p.value };
    const updated: CharacterSheet = {
      ...existing,
      attributes,
      derived: computeDerived(deps, existing.ruleSystemId, attributes),
      history: [...existing.history, describeEvent(event)],
    };
    await deps.reads.put(CHARACTER_SHEET, event.aggregateId, updated);
    return;
  }

  if (event.type === "character.checkRolled") {
    const updated: CharacterSheet = {
      ...existing,
      history: [...existing.history, describeEvent(event)],
    };
    await deps.reads.put(CHARACTER_SHEET, event.aggregateId, updated);
  }
}

/**
 * Run the projection forward from its checkpoint: read new events in `position` order, fold each into
 * its sheet, and advance the checkpoint. Idempotent — re-running processes nothing already seen.
 */
export async function runCharacterSheetProjection(deps: ProjectionDeps): Promise<void> {
  const from = await deps.reads.getCheckpoint(CHARACTER_SHEET);
  const events = await deps.events.readAll(from);
  for (const event of events) {
    if (event.aggregateType === "character") {
      await applyToSheet(deps, event);
    }
    await deps.reads.setCheckpoint(CHARACTER_SHEET, event.position);
  }
}

/**
 * Rebuild the projection from scratch (ADR 0004 §5): clear the read model + checkpoint, then replay
 * from `position 0`. Used to prove rebuild-determinism (ADR 0022 §9 pass criterion).
 */
export async function rebuildCharacterSheetProjection(deps: ProjectionDeps): Promise<void> {
  await deps.reads.clear();
  await runCharacterSheetProjection(deps);
}
