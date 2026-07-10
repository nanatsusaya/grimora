/**
 * @grimora/plugin-sdk — the published contract a rule-system plugin implements (ADR 0006 §3), and the
 * host-side vocabulary `core-domain` consumes to load and run plugins.
 *
 * **Provisional v0** (ADR 0022 §3): these shapes exist to let the walking skeleton validate the
 * architecture; the frozen public contract is ADR 0025 (issue #62). See this package's README.
 *
 * Imports `@grimora/shared-types` only (the leaf); this package is the shared "published language"
 * between `core-domain` (host) and `plugins/*` (ADR 0003 §9), which is why the trait/formula/roll
 * contract types live here.
 */

export type {
  BehaviourContext,
  CheckDefinition,
  PluginError,
  ResolveCheck,
  ResolveCheckInput,
  SeededRng,
} from './behaviour';
export type {
  DiceTerm,
  RollContext,
  RollOutcome,
  RollRequest,
  RollResult,
  RollSeed,
  RollVisibility,
} from './dice';
export type { CmpOp, FormulaAst } from './formula';
export { f } from './formula';
export type {
  GrimoraPlugin,
  PluginManifest,
  PluginRegistry,
  RegisterFn,
  RuleSystemDefinition,
} from './plugin';
export { definePlugin } from './plugin';
export type {
  PrivacyClass,
  PrivacyClassification,
  Redactable,
  RedactedView,
} from './privacy';
export { privacy, redacted, redactView, reveal, validateClassification } from './privacy';
export type {
  AttributeDefinition,
  DerivedValueDefinition,
  SkillDefinition,
  TraitDefinition,
  TraitKind,
} from './traits';
