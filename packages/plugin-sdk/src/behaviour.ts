/**
 * The Behaviour-API surface (ADR 0006 §3): the **pure** functions a plugin supplies, and the
 * capability-scoped context they receive. No ambient authority — a plugin's behaviour gets a seeded
 * RNG (ADR 0021 §3, never `Math.random`) and a scoped logger, never raw I/O, network, DOM or globals.
 *
 * **Provisional v0** (ADR 0022 §3) — frozen later in ADR 0025.
 */

import type { Result } from "@grimora/shared-types";
import type { DiceTerm, RollOutcome } from "./dice";

/**
 * A deterministic, seeded random source injected into plugin behaviour (ADR 0021 §3). The core builds
 * it from the aggregate stream id + roll sequence number so a roll is reproducible on replay; plugins
 * never see wall-clock time or `Math.random`.
 */
export interface SeededRng {
  /** Uniform integer die roll in the inclusive range [1, `sides`]. */
  rollDie(sides: number): number;
  /** Uniform float in [0, 1). */
  next(): number;
}

/**
 * The capability-scoped context passed to every Behaviour-API function (ADR 0006 §3). Deliberately
 * narrow: a seeded RNG and a scoped log sink — nothing that grants ambient authority.
 */
export interface BehaviourContext {
  /** Deterministic RNG derived from the aggregate stream (ADR 0021 §3). */
  readonly rng: SeededRng;
  /** Scoped, side-effect-light log sink (the host decides where it goes). */
  readonly log: (message: string) => void;
}

/**
 * A plugin-surfaced error (ADR 0009 §1 taxonomy), namespaced by plugin id. Crosses the SDK boundary
 * as a value (never a thrown exception, ADR 0006/0009). i18n key, not literal text.
 */
export interface PluginError {
  /** Stable, plugin-namespaced code, e.g. "dsa5.invalid_check". */
  readonly code: string;
  /** i18n message key resolved at the presentation layer. */
  readonly messageKey: string;
  /** Closed error category (subset used by the skeleton). */
  readonly category: "Validation" | "NotFound" | "Conflict" | "Infrastructure";
}

/** Input to a check's resolution function: the already-rolled raw pips and the numeric targets. */
export interface ResolveCheckInput {
  /** Raw pips, one inner array per {@link CheckDefinition.terms} entry (rolled by the core). */
  readonly rolls: readonly (readonly number[])[];
  /** The numeric targets the mechanic evaluates against (trait id → value). */
  readonly targets: Readonly<Record<string, number>>;
}

/**
 * A check's **resolution function** — the plugin's *mechanic* (ADR 0020/0021): it interprets the raw
 * pips the core rolled against the targets and returns an opaque {@link RollOutcome}. Pure; receives
 * only the {@link BehaviourContext}. Returns a `Result` (never throws across the boundary).
 */
export type ResolveCheck = (
  input: ResolveCheckInput,
  ctx: BehaviourContext,
) => Result<RollOutcome, PluginError>;

/**
 * A check a plugin defines (e.g. a DSA5 skill check). The core builds the roll (rolls `terms` with the
 * seeded RNG, reads `attributeIds`/`skillId` values as targets) and calls `resolve` to interpret the
 * result. The dice mechanic itself lives entirely in `resolve` — the core never interprets pips.
 */
export interface CheckDefinition {
  /** Plugin-defined check id (matches {@link import("./dice").RollContext.checkId}). */
  readonly id: string;
  /** i18n key for the check's display name. */
  readonly labelKey: string;
  /** Attribute trait ids whose values become numeric targets for this check. */
  readonly attributeIds: readonly string[];
  /** Optional skill trait id whose value the mechanic may use (e.g. DSA5 skill points). */
  readonly skillId?: string;
  /** The dice to roll for this check — the mechanic's dice shape (e.g. three d20 for DSA5). */
  readonly terms: readonly DiceTerm[];
  /** Interpret the rolled pips into an outcome — see {@link ResolveCheck}. */
  readonly resolve: ResolveCheck;
}
