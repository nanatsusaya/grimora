/**
 * Generic dice / roll model — the rule-**agnostic** shapes the core stores and replays, while the
 * concrete *mechanic* (how raw pips become success/failure) is the plugin's (ADR 0021 §2, ADR 0020).
 *
 * These shapes are deliberately mechanic-neutral across the seven-system comparison (ADR 0020): three
 * independent d20 terms for DSA5's roll-under-three-attributes, one d20+modifier term for d20-vs-DC, a
 * pool of same-sided dice for Shadowrun-style hit counting, etc. The core never interprets the
 * outcome — a plugin's resolution function does (see `behaviour.ts`).
 *
 * **Provisional v0** (ADR 0022 §3) — frozen later in ADR 0025.
 */

import type { EntityId } from '@grimora/shared-types';

/**
 * One homogeneous group of dice within a roll. `sides` carries the die size (e.g. 20 for a d20);
 * narrative symbol-dice sets are a future extension (ADR 0021 §2) not exercised by the skeleton.
 */
export interface DiceTerm {
  /** Number of sides per die, e.g. 20. */
  readonly sides: number;
  /** How many dice of this size to roll. */
  readonly count: number;
  /** A flat modifier applied to this term's total, if the mechanic uses one. */
  readonly modifier?: number;
}

/** Who may see a roll — covers hidden/GM rolls (ADR 0021 §2). */
export type RollVisibility = 'public' | 'gmOnly' | 'private';

/**
 * What a roll is *about*: the aggregate it belongs to (also the RNG-seed source, ADR 0021 §3), the
 * plugin-defined check id, and the numeric targets the mechanic rolls against (e.g. attribute values).
 */
export interface RollContext {
  /** The character/NPC aggregate this roll is for. */
  readonly aggregateId: EntityId;
  /** Plugin-defined identifier of what is being checked (a skill/attribute/check id). */
  readonly checkId: string;
  /** Named numeric targets the mechanic evaluates against (attribute id → value). */
  readonly targets: Readonly<Record<string, number>>;
}

/**
 * A request to roll. The core turns this into actual pips via a seeded RNG; the plugin's resolution
 * function then interprets the pips. `groupId` correlates opposed/group checks; `rerollOf` links a
 * reroll to the prior request rather than mutating it (ADR 0021 R4 — linked requests, immutable facts).
 */
export interface RollRequest {
  /** Stable id of this request (used to correlate the resulting event/result). */
  readonly id: EntityId;
  /** The dice groups to roll (the mechanic's shape). */
  readonly terms: readonly DiceTerm[];
  /** What the roll is about — see {@link RollContext}. */
  readonly context: RollContext;
  /** Visibility (hidden/GM/public). */
  readonly visibility: RollVisibility;
  /** Correlates multiple requests in one opposed/group check. */
  readonly groupId?: EntityId;
  /** If this roll is a reroll, the id of the request it rerolls (ADR 0021 R4). */
  readonly rerollOf?: EntityId;
}

/**
 * The reproducibility record for a roll (ADR 0021 §3/§4): the seed is derived from the aggregate
 * stream id + a per-aggregate roll sequence number, so replaying the event stream reproduces the same
 * roll — and the stored result (not a re-roll) is the source of truth on replay/rebase (ADR 0022 §6).
 */
export interface RollSeed {
  /** The aggregate stream id the seed derives from. */
  readonly streamId: EntityId;
  /** The per-aggregate roll sequence number at the time of the roll. */
  readonly sequence: number;
}

/**
 * The plugin-defined outcome of a roll. Its structured `value` is **opaque to the core** (ADR 0020 /
 * ADR 0021 R3); its human-readable part is an **i18n key** (+ params), never a literal string —
 * matching `AppError.messageKey` (ADR 0009 §1) and event `describe()` (ADR 0004 §10), so generic core
 * UI can render a localized label without understanding the outcome's meaning.
 */
export interface RollOutcome {
  /** Plugin-defined structured outcome (e.g. a DSA5 quality level); the core does not interpret it. */
  readonly value: unknown;
  /** i18n message key for the human-readable outcome, resolved at the presentation layer. */
  readonly labelKey: string;
  /** Parameters for interpolating into the localized label. */
  readonly labelParams?: Readonly<Record<string, string | number>>;
}

/**
 * The result of executing a {@link RollRequest}: the raw pips per term (kept for audit), the opaque
 * plugin outcome, and the seed. Immutable — a rebased/synced roll carries this result rather than
 * re-rolling (ADR 0022 §6).
 */
export interface RollResult {
  /** The request this result answers. */
  readonly requestId: EntityId;
  /** Raw pips, one inner array per {@link RollRequest.terms} entry. */
  readonly rolls: readonly (readonly number[])[];
  /** The plugin-defined outcome — see {@link RollOutcome}. */
  readonly outcome: RollOutcome;
  /** Reproducibility record — see {@link RollSeed}. */
  readonly seed: RollSeed;
  /** If this result is a reroll, the prior request id (mirrors {@link RollRequest.rerollOf}). */
  readonly rerollOf?: EntityId;
}
