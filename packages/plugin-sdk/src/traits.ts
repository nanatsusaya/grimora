/**
 * The generic trait meta-model vocabulary (ADR 0020): plugin-populated, typed slots the core stores
 * generically without knowing their meaning. The core knows "a character has attributes"; the plugin
 * says *which* attributes (by abstract id) and *how* derived values compute (via a formula AST).
 *
 * The skeleton implements the three kinds its golden slice needs — `attribute`, `derivedValue`,
 * `skill` — deliberately spanning **different kinds** to stress the meta-model (ADR 0022 R2). The
 * remaining ADR 0020 kinds (ability, advantage, resource, item, template) are not exercised here.
 *
 * **Provisional v0** (ADR 0022 §3) — frozen later in ADR 0025.
 */

import type { FormulaAst } from '@grimora/rules-contract';

/** Which meta-model slot a trait definition populates. */
export type TraitKind = 'attribute' | 'derivedValue' | 'skill';

/** Fields common to every trait definition. `labelKey` is an i18n key (no literal UI text — ADR 0016). */
interface TraitDefinitionBase {
  /** Abstract, rule-agnostic id (e.g. "COU"); the core never hardcodes these. */
  readonly id: string;
  /** i18n key for the display name; resolved at the presentation layer. */
  readonly labelKey: string;
}

/** A rated attribute (e.g. DSA5 "Courage"): a directly-stored numeric value with bounds. */
export interface AttributeDefinition extends TraitDefinitionBase {
  readonly kind: 'attribute';
  /** **Inclusive** lower bound. The **core** enforces `[min, max]` when a value is set (`setAttribute`);
   * the plugin only declares the range, so bounds-checking is not duplicated per plugin. */
  readonly min: number;
  /** **Inclusive** upper bound (see {@link AttributeDefinition.min}). */
  readonly max: number;
  /** Value used at character creation before any explicit assignment. */
  readonly defaultValue: number;
}

/** A rated skill (e.g. a talent): like an attribute, but tested via a check against attributes. */
export interface SkillDefinition extends TraitDefinitionBase {
  readonly kind: 'skill';
  /** Inclusive lower bound, core-enforced on set — same contract as {@link AttributeDefinition.min}. */
  readonly min: number;
  /** Inclusive upper bound, core-enforced on set. */
  readonly max: number;
  /** Value used at character creation before any explicit assignment. */
  readonly defaultValue: number;
}

/**
 * A derived value (e.g. life points): **computed** from other traits by a formula AST, never stored
 * directly. Re-evaluated by the core interpreter whenever its inputs change (ADR 0020, ADR 0021 §1).
 */
export interface DerivedValueDefinition extends TraitDefinitionBase {
  readonly kind: 'derivedValue';
  readonly formula: FormulaAst;
}

/** A plugin-declared trait slot of any supported kind. */
export type TraitDefinition = AttributeDefinition | SkillDefinition | DerivedValueDefinition;
