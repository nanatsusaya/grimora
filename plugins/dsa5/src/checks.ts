/**
 * DSA5 checks (`CheckDefinition`s) + the skill-check *mechanic* itself — the plugin's own dice rule
 * (ADR 0020): three d20 rolled under three attributes, skill points offsetting shortfalls, success
 * scaling to a quality level; two 1s = critical, two 20s = botch. Pure and deterministic given the
 * rolled pips.
 *
 * Own module so the resolver can be generalised (skeleton: a hardcoded perception check → a
 * parameterised check reused across talents, issue #211) without touching the trait modules.
 *
 * **Fidelity SSOT (ADR 0029)** — the whole mechanic below (3d20, skill points offsetting shortfalls,
 * quality levels, double-1 / double-20) is verified against:
 * - Regel-Wiki (public, normative): <https://dsa.ulisses-regelwiki.de/GR_Proben/fertigkeiten.html>
 *   (skill checks) and <https://dsa.ulisses-regelwiki.de/GR_Proben.html> (the underlying check roll)
 * - DSA5 vault (private anchor): `01 Regeln/Grundregeln/Fertigkeiten.md` and
 *   `01 Regeln/Grundregeln/Proben.md`
 *
 * Verified 2026-07-15: every element of this resolver matches the rule as written, including the
 * deliberate absence of confirmation rolls (the rule states skill checks have none, unlike attribute
 * checks). Pointers only — no rule text is reproduced.
 */
import type {
  CheckDefinition,
  PluginError,
  ResolveCheckInput,
  RollOutcome,
} from '@grimora/plugin-sdk';
import { err, ok, type Result } from '@grimora/shared-types';
import { TALENTS } from './talents';

/** The DSA5 quality-level / success outcome (the opaque plugin `value`, ADR 0020 / 0021 R3). */
interface Dsa5CheckOutcome {
  readonly success: boolean;
  readonly quality: number;
  readonly critical: boolean;
  readonly botch: boolean;
}

/** Read a die value defensively from the rolled pips. */
function die(pips: readonly number[], index: number): number {
  return pips[index] ?? 0;
}

/**
 * The DSA5 quality level from the skill points left over after covering the shortfalls: every 3 leftover
 * points raise the QL, a bare success (0 left) is still QL 1, and the QL is capped at **6** (the DSA5
 * scale is 1–6). Kept separate so the cap/step rule is stated once and reused by the success paths.
 *
 * This arithmetic is a **closed-form reproduction of the rule's QL table**, not an approximation — worth
 * stating because the table is what a reader will check it against. Verified row-by-row against the SSOT
 * (ADR 0029; vault `01 Regeln/Grundregeln/Fertigkeiten.md`, table *Qualitätsstufen*): 0–3→1, 4–6→2,
 * 7–9→3, 10–12→4, 13–15→5, 16+→6. The `max(1, …)` is the rule's explicit "a check passed with 0 SP still
 * counts as QL 1" clause, not a defensive clamp.
 * @param remaining  skill points left after offsetting shortfalls (only meaningful when ≥ 0)
 * @returns          the quality level, clamped to 1…6
 */
function qualityLevel(remaining: number): number {
  return Math.min(6, Math.max(1, Math.ceil(remaining / 3)));
}

/**
 * The DSA5 skill-check mechanic, *parameterised* over which three attributes and which skill it tests
 * (this is the *plugin's* mechanic, ADR 0020): roll three d20 under the three given attribute ratings;
 * each die exceeding its attribute is a shortfall; the skill's points offset the total. Success iff
 * points cover the shortfalls; quality level scales with the remainder. Two 1s = critical, two 20s =
 * botch. Pure and deterministic given the rolled pips — every DSA5 talent reuses this one resolver,
 * differing only in the attribute triple / skill id passed in.
 * @param input         the rolled pips (`rolls[0]` = three d20) and the target attribute/skill ratings
 * @param attributeIds  the three attribute trait ids to test against, one per d20 (order matters)
 * @param skillId       the skill trait id whose points offset the shortfalls
 * @returns             a `RollOutcome` carrying the opaque DSA5 outcome, or a `Validation` `PluginError`
 */
function resolveSkillCheck(
  input: ResolveCheckInput,
  attributeIds: readonly string[],
  skillId: string,
): Result<RollOutcome, PluginError> {
  const pips = input.rolls[0];
  if (pips?.length !== 3) {
    return err({
      code: 'dsa5.invalid_check_dice',
      messageKey: 'dsa5.invalid_check_dice',
      category: 'Validation',
    });
  }
  const attributes = attributeIds.map((id) => input.targets[id] ?? 0);
  const skill = input.targets[skillId] ?? 0;

  let shortfall = 0;
  let ones = 0;
  let twenties = 0;
  for (let i = 0; i < 3; i++) {
    const value = die(pips, i);
    if (value === 1) ones++;
    if (value === 20) twenties++;
    const attribute = attributes[i] ?? 0;
    if (value > attribute) shortfall += value - attribute;
  }
  const remaining = skill - shortfall;

  let outcome: Dsa5CheckOutcome;
  if (twenties >= 2) {
    outcome = { success: false, quality: 0, critical: false, botch: true };
  } else if (ones >= 2) {
    outcome = {
      success: true,
      quality: qualityLevel(remaining),
      critical: true,
      botch: false,
    };
  } else {
    const success = remaining >= 0;
    outcome = {
      success,
      quality: success ? qualityLevel(remaining) : 0,
      critical: false,
      botch: false,
    };
  }

  return ok({
    value: outcome,
    labelKey: outcome.success ? 'dsa5.check.success' : 'dsa5.check.failure',
    labelParams: { quality: outcome.quality },
  });
}

/**
 * The checks contributed by the plugin — **one 3d20 skill check per catalog talent**, each delegating to
 * the parameterised {@link resolveSkillCheck} with its own attribute triple + skill id. Derived from
 * `TALENTS` (single source of truth); a talent's name key `dsa5.skill.*` becomes its check's
 * `dsa5.check.*`. All triples are the canonical DSA5 ones from the Regel-Wiki (e.g. Perception SGC/INT/INT,
 * Body Control AGI/AGI/CON).
 *
 * Because the triples come from `TALENTS`, their provenance is each talent's own `regelwiki`/`vaultNote`
 * reference (ADR 0029) — there is nothing to duplicate here. A vault cross-check of all 59 triples ran
 * clean on 2026-07-15.
 */
export const CHECKS: readonly CheckDefinition[] = TALENTS.map((talent) => ({
  id: talent.checkId,
  labelKey: talent.labelKey.replace('.skill.', '.check.'),
  attributeIds: talent.attributeIds,
  skillId: talent.id,
  terms: [{ sides: 20, count: 3 }],
  resolve: (input) => resolveSkillCheck(input, talent.attributeIds, talent.id),
}));
