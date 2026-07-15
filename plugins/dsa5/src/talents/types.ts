/**
 * The DSA5 talent (skill) catalog **data model** — the mechanical roster of a talent, as permitted by
 * the content boundary (name as an i18n key + attribute triple + category + improvement factor +
 * encumbrance + application slugs; **no** descriptions/flavour/values-with-expression). Sourced from the
 * official English *The Dark Eye* Regel-Wiki (<https://tde.ulisses-regelwiki.de/>).
 *
 * **Fidelity SSOT (ADR 0029):** the model carries the two-layer source reference (`regelwiki` +
 * `vaultNote`) that makes each entry re-checkable against the owner's DSA5 vault. The fields are
 * structured (not comments) so a later arch fitness function can assert their presence (ADR 0029 R3
 * defers the assertion until the reference set is complete).
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
 *   regelwiki: 'https://dsa.ulisses-regelwiki.de/talent.html?talent=K%C3%B6rperbeherrschung',
 *   vaultNote: '01 Regeln/Talente/Körpertalente/Körperbeherrschung.md',
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
  /**
   * why: the **public, normative** provenance anchor (ADR 0029 §2) — the official Regel-Wiki id this
   * entry's mechanics were implemented from, so any reader can re-verify them without our asserting
   * correctness. Also the stable **join key** into the private vault SSOT note (which is keyed by the
   * same id), which is why it stays a URL rather than a local path.
   */
  readonly regelwiki: string;
  /**
   * why: the **private** fidelity anchor (ADR 0029 §2) — the note path in the owner's DSA5 vault SSOT
   * (`github.com/nanatsusaya/dsa5`). Optional and best-effort: the vault is private, so this link is
   * owner-only-resolvable *by design*, and a vault reorganization may drift the path — `regelwiki` is
   * the stable key. A pointer only; no rule text is ever copied here (content boundary).
   */
  readonly vaultNote?: string;
}
