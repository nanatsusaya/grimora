/**
 * @grimora/plugin-sdk — the published contract a rule-system plugin implements (ADR 0006 §3), and the
 * host-side vocabulary `core-domain` consumes to load and run plugins.
 *
 * **Provisional v0** (ADR 0022 §3): these shapes exist to let the walking skeleton validate the
 * architecture; the frozen public contract is ADR 0025 (issue #62). See this package's README.
 *
 * The **rules-execution contract** (formula AST, dice/roll model, seeded RNG, plugin resolution surface,
 * privacy classification) now lives in the stable leaf **`@grimora/rules-contract`** (ADR 0028) and is
 * **re-exported here** so the plugin-author surface (ADR 0025 §2) is unchanged. This package keeps only
 * the plugin *registration* and *trait-definition* vocabulary. It imports `@grimora/rules-contract` +
 * `@grimora/shared-types` (both leaves), remaining the shared "published language" between `core-domain`
 * (host) and `plugins/*` (ADR 0003 §9).
 */

export type {
  BehaviourContext,
  CheckDefinition,
  CmpOp,
  DiceTerm,
  FormulaAst,
  PluginError,
  PrivacyClass,
  PrivacyClassification,
  Redactable,
  RedactedView,
  ResolveCheck,
  ResolveCheckInput,
  RollContext,
  RollOutcome,
  RollRequest,
  RollResult,
  RollSeed,
  RollVisibility,
  SeededRng,
} from '@grimora/rules-contract';
export {
  f,
  privacy,
  redacted,
  redactView,
  reveal,
  validateClassification,
} from '@grimora/rules-contract';
export type {
  GrimoraPlugin,
  PluginManifest,
  PluginRegistry,
  RegisterFn,
  RuleSystemDefinition,
} from './plugin';
export { definePlugin } from './plugin';
export type {
  AttributeDefinition,
  DerivedValueDefinition,
  SkillDefinition,
  TraitDefinition,
  TraitKind,
} from './traits';
