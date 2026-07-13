/**
 * The DSA5 talent (skill) catalog **data model** — the mechanical roster of a talent, as permitted by
 * the content boundary (name as an i18n key + attribute triple + category + improvement factor +
 * encumbrance + application slugs; **no** descriptions/flavour/values-with-expression). Sourced from the
 * official English *The Dark Eye* Regel-Wiki (<https://tde.ulisses-regelwiki.de/>).
 *
 * Kept as plain data separate from the SDK trait model: the SDK `TraitDefinition` (a `kind: 'skill'`
 * trait) and `CheckDefinition` are *derived* from these entries (see `skills.ts` / `checks.ts`), so the
 * DSA5-specific fields (category / improvement cost / encumbrance / applications) live here in the plugin
 * — the core stays rule-agnostic (ADR 0020) — ready for later DSA5 logic (improvement cost, encumbrance)
 * without an SDK change.
 */

/** The five DSA5 talent groups (the Regel-Wiki's skill categories). */
export type TalentCategory = 'physical' | 'social' | 'nature' | 'knowledge' | 'craft';

/** DSA5 improvement cost / *Steigerungsfaktor* (A cheapest … D most expensive). */
export type ImprovementCost = 'A' | 'B' | 'C' | 'D';

/** Whether encumbrance applies to a talent's checks: always / never / situationally. */
export type Encumbrance = 'yes' | 'no' | 'maybe';

/**
 * One talent's mechanical roster entry. Ids are the machine-stable keys that end up in event-sourced
 * data, so they must not change once shipped; the human-readable name is resolved via `labelKey` through
 * i18n and never hard-coded here.
 *
 * Example (Body Control):
 * ```
 * {
 *   id: 'BODY_CONTROL', checkId: 'body-control', labelKey: 'dsa5.skill.bodyControl',
 *   attributeIds: ['AGI', 'AGI', 'CON'], category: 'physical', improvementCost: 'D',
 *   encumbrance: 'yes', applications: ['acrobatics', 'balance', 'combat-maneuver', 'jumping', 'running', 'squirm'],
 * }
 * ```
 */
export interface Talent {
  /** stable skill-trait id (event data) — UPPER_SNAKE of the English name, e.g. `BODY_CONTROL`. */
  readonly id: string;
  /** stable check id — kebab-case of the English name, e.g. `body-control`. */
  readonly checkId: string;
  /** i18n key for the talent name, e.g. `dsa5.skill.bodyControl`; the check reuses it as `dsa5.check.*`. */
  readonly labelKey: string;
  /** the three governing attribute ids tested, in the Regel-Wiki's order (duplicates allowed). */
  readonly attributeIds: readonly [string, string, string];
  /** which of the five talent groups it belongs to. */
  readonly category: TalentCategory;
  /** DSA5 Steigerungsfaktor (A–D). */
  readonly improvementCost: ImprovementCost;
  /** whether encumbrance applies to its checks. */
  readonly encumbrance: Encumbrance;
  /** stable slugs of the talent's application areas (names only, kebab-case) — no descriptions. */
  readonly applications: readonly string[];
}
