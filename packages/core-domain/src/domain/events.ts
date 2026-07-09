/**
 * Domain events for the skeleton's two aggregates (ADR 0004 §1/§10). Events are **past-tense,
 * intention-revealing** facts — never generic field-setters (CLAUDE.md guardrail). Payloads carry
 * abstract trait ids + values/deltas; *which* traits exist and their labels come from the plugin
 * (ADR 0004 §10), so core `character` events stay rule-agnostic.
 *
 * A `NewEvent` is what an aggregate's decide-function returns; the application layer wraps it into a
 * `shared-types` `EventEnvelope` (adding id/version/position/metadata) before appending.
 */

import type { RollRequest, RollResult } from '@grimora/plugin-sdk';
import type { EntityId } from '@grimora/shared-types';

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
  'campaign.created',
  { readonly name: string; readonly ownerId: EntityId }
>;

/** Every event the campaign aggregate can emit (a union so folding is exhaustive, ADR 0004 §1). */
export type CampaignEvent = CampaignCreated;

/**
 * Character was created, bound to exactly one rule system with **provenance** (which plugin + version
 * produced it — ADR 0006 §4/§9, ADR 0004).
 */
export type CharacterCreated = NewEvent<
  'character.created',
  {
    /** The character's display name (personal data — see the ADR 0023 classification, tracked in #92). */
    readonly name: string;
    /** The campaign this character belongs to (the sharing/authorization unit, ADR 0009 RBAC). */
    readonly campaignId: EntityId;
    /** The owning user — the actor who created it; the resource-scoped authz subject (ADR 0010 §2). */
    readonly ownerId: EntityId;
    /** The **rule system** bound to this character (e.g. "dsa5") — an abstract system id, exactly one
     * per character (ADR 0006 §9). Distinct from `pluginId` below. */
    readonly ruleSystemId: string;
    /** The **plugin** that contributed that rule system (a reverse-DNS id, e.g. "org.grimora.dsa5") —
     * recorded as provenance so events stay attributable/upcastable across plugin upgrades (ADR 0006 §4).
     * A rule system id and its plugin id are easy to confuse: one names the *ruleset*, the other the
     * *code that supplied it*. */
    readonly pluginId: string;
    /** Version of the producing plugin at creation time — pins provenance for later upcasting. */
    readonly pluginVersion: string;
  }
>;

/** An attribute was set to an absolute value during generation (intent: absolute set, ADR 0004 §10). */
export type CharacterAttributeSet = NewEvent<
  'character.attributeSet',
  { readonly attributeId: string; readonly value: number }
>;

/**
 * A check was rolled and resolved. Carries the full request + result (including the opaque plugin
 * outcome and the seed) so the roll is auditable and **replayed from the stored result, never
 * re-rolled** (ADR 0021 §4, ADR 0022 §6). Provenance included for upcasting across plugin upgrades.
 */
export type CharacterCheckRolled = NewEvent<
  'character.checkRolled',
  {
    /** Which plugin check was rolled. Deliberately duplicated at `request.context.checkId`: this
     * top-level copy lets projections/`describe()` read it without unpacking the nested request, while
     * the request keeps its own self-contained context for the plugin's resolution function. */
    readonly checkId: string;
    /** The full roll request (terms, targets, visibility) — see `RollRequest` in the SDK. */
    readonly request: RollRequest;
    /** The roll outcome + seed; the stored result is authoritative on replay/rebase (ADR 0022 §6). */
    readonly result: RollResult;
    /** Producing plugin id (provenance, ADR 0006 §4). */
    readonly pluginId: string;
    /** Producing plugin version (provenance/upcasting). */
    readonly pluginVersion: string;
  }
>;

/** Every event the character aggregate can emit (a union so folding is exhaustive, ADR 0004 §1). */
export type CharacterEvent = CharacterCreated | CharacterAttributeSet | CharacterCheckRolled;

/** Any event either aggregate can produce. */
export type AnyDomainEvent = CampaignEvent | CharacterEvent;
