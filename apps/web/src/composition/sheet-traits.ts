/**
 * Resolves the trait fields the minimal character sheet renders, **against the loaded rule system**
 * rather than from a hand-maintained list in the UI.
 *
 * Why this module exists: the sheet used to hard-code both the trait ids *and* their bounds
 * (`{ id: 'PER', min: 0, max: 25 }`). Both were duplicates of plugin data, and both drifted — `PER` named
 * a trait the DSA5 plugin does not define at all (its skill id is `PERCEPTION`), a leftover the catalog
 * work in #211/#214 left behind, and nothing failed: the field simply rendered empty forever and errored
 * on edit (#225). Bounds could drift the same way, silently disagreeing with the rule the use-case
 * actually enforces.
 *
 * The fix is structural, not a corrected constant: the UI names only *which* traits it wants to show — a
 * legitimate presentation choice — and every fact **about** them (existence, min, max) comes from the
 * `RuleSystemRegistryPort`, i.e. the same authority the `setAttribute` use-case validates against. An id
 * the rule system does not define can therefore no longer be rendered; it fails at boot instead
 * (see {@link resolveSheetTraits}).
 *
 * This is the ADR 0029 argument applied to the UI: a fact duplicated away from its authority degrades
 * into an assertion. There, the authority is the DSA5 vault; here, it is the loaded rule system.
 */

import type { RuleSystemRegistryPort } from '@grimora/core-domain';

/** A trait field the sheet renders: the id it edits, plus the rule system's own bounds for it. */
export interface SheetTrait {
  /** the rated trait id the field writes through `setAttribute` (must exist in the rule system) */
  readonly id: string;
  /** lower bound, taken from the rule system — never duplicated in the UI, so it cannot drift */
  readonly min: number;
  /** upper bound, taken from the rule system */
  readonly max: number;
}

/**
 * The trait ids the minimal sheet exposes — a deliberate **subset** of the rule system's traits (the full
 * DSA5 sheet is not this slice's job), but not an arbitrary one: it must include every input of a derived
 * value the sheet displays, or the user sees a number they cannot influence. `CON` is here for exactly
 * that reason — it is the sole input of `LP` (5 + 2×CON, #223).
 *
 * Only ids are listed; bounds come from the rule system (see {@link resolveSheetTraits}).
 */
export const SHEET_TRAIT_IDS: readonly string[] = ['COU', 'AGI', 'INT', 'CON', 'PERCEPTION'];

/**
 * Resolve {@link SHEET_TRAIT_IDS} against a loaded rule system, taking each trait's bounds from the
 * registry and **failing fast** on an id the rule system does not define.
 *
 * The throw is deliberate: naming a non-existent trait is a programming error, not a user error, and the
 * only way to make it structurally impossible is to refuse to boot. It surfaces immediately in dev and in
 * the Playwright E2E — which is precisely what #225 lacked, letting a dead field ship unnoticed. Callers
 * must therefore invoke this **after** the plugin is loaded into the host.
 * @param rules         the rule-system registry (a plugin host with the rule system already loaded)
 * @param ruleSystemId  the rule system the sheet binds to (e.g. `dsa5`)
 * @returns             one {@link SheetTrait} per id in {@link SHEET_TRAIT_IDS}, in that order
 * @throws              if the rule system is unknown, or defines no rated trait for one of the ids
 */
export function resolveSheetTraits(
  rules: RuleSystemRegistryPort,
  ruleSystemId: string,
): readonly SheetTrait[] {
  if (!rules.getRuleSystem(ruleSystemId)) {
    throw new Error(
      `Grimora: rule system "${ruleSystemId}" is not loaded — cannot resolve sheet traits`,
    );
  }
  return SHEET_TRAIT_IDS.map((id) => {
    const bounds = rules.getRatedTrait(ruleSystemId, id);
    if (!bounds) {
      throw new Error(
        `Grimora: sheet trait "${id}" is not a rated trait of rule system "${ruleSystemId}" — ` +
          'the sheet may only render traits the rule system defines (#225)',
      );
    }
    return { id, min: bounds.min, max: bounds.max };
  });
}
