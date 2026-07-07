/**
 * Domain events for the skeleton's two aggregates (ADR 0004 §1/§10). Events are **past-tense,
 * intention-revealing** facts — never generic field-setters (CLAUDE.md guardrail). Payloads carry
 * abstract trait ids + values/deltas; *which* traits exist and their labels come from the plugin
 * (ADR 0004 §10), so core `character` events stay rule-agnostic.
 *
 * A `NewEvent` is what an aggregate's decide-function returns; the application layer wraps it into a
 * `shared-types` `EventEnvelope` (adding id/version/position/metadata) before appending.
 */

import type { RollRequest, RollResult } from "@grimora/plugin-sdk";
import type { EntityId } from "@grimora/shared-types";

/** A newly-decided domain event: an intent-named type + its structured payload. */
export interface NewEvent<TType extends string = string, TPayload = unknown> {
  readonly type: TType;
  readonly payload: TPayload;
}

/**
 * The minimal shape an aggregate's `apply`/fold function reads from a stored event — `type`, the
 * per-aggregate `version` (so rehydration restores the current version), and `payload`. A
 * `shared-types` `PersistedEvent` satisfies this structurally.
 */
export interface StoredEvent<TType extends string = string, TPayload = unknown> {
  readonly type: TType;
  readonly version: number;
  readonly payload: TPayload;
}

/** Campaign was created (owner = its creator, provisional minimal authz — ADR 0022 §7). */
export type CampaignCreated = NewEvent<
  "campaign.created",
  { readonly name: string; readonly ownerId: EntityId }
>;

export type CampaignEvent = CampaignCreated;

/**
 * Character was created, bound to exactly one rule system with **provenance** (which plugin + version
 * produced it — ADR 0006 §4/§9, ADR 0004).
 */
export type CharacterCreated = NewEvent<
  "character.created",
  {
    readonly name: string;
    readonly campaignId: EntityId;
    readonly ownerId: EntityId;
    readonly ruleSystemId: string;
    readonly pluginId: string;
    readonly pluginVersion: string;
  }
>;

/** An attribute was set to an absolute value during generation (intent: absolute set, ADR 0004 §10). */
export type CharacterAttributeSet = NewEvent<
  "character.attributeSet",
  { readonly attributeId: string; readonly value: number }
>;

/**
 * A check was rolled and resolved. Carries the full request + result (including the opaque plugin
 * outcome and the seed) so the roll is auditable and **replayed from the stored result, never
 * re-rolled** (ADR 0021 §4, ADR 0022 §6). Provenance included for upcasting across plugin upgrades.
 */
export type CharacterCheckRolled = NewEvent<
  "character.checkRolled",
  {
    readonly checkId: string;
    readonly request: RollRequest;
    readonly result: RollResult;
    readonly pluginId: string;
    readonly pluginVersion: string;
  }
>;

export type CharacterEvent = CharacterCreated | CharacterAttributeSet | CharacterCheckRolled;

/** Any event either aggregate can produce. */
export type AnyDomainEvent = CampaignEvent | CharacterEvent;
