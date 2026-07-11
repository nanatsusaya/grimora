/**
 * `@grimora/rules-contract` — the **stable, shared rules-execution contract** (ADR 0028): the formula
 * AST, the generic dice/roll model, the seeded-RNG interface, the plugin resolution surface, and the
 * event-payload privacy classification helpers (ADR 0021, ADR 0023).
 *
 * Why this package exists as its own leaf: this contract is the **shared language** between `core-domain`
 * (the host — formula interpreter + roll orchestration) and `plugin-sdk`/`plugins/*` (which author
 * formulas and checks), so **neither may depend "upward" into the other** (ADR 0003 §2.1). Several of
 * these types — `RollRequest`, `RollResult`, `RollOutcome`, `DiceTerm` — are embedded in the **persisted**
 * `character.checkRolled` event payload (ADR 0004), so their stability must match the event log's
 * durability; keeping them here (a leaf that imports only `@grimora/shared-types`) rather than in the
 * `plugin-sdk`'s `0.x` "may break" surface (ADR 0025 §1) removes that durability hazard at the root
 * (ADR 0028 §1/§2). `@grimora/plugin-sdk` **re-exports** everything below, so the plugin-author surface
 * (ADR 0025 §2) is unchanged — the definitions merely live here now.
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
  PrivacyClass,
  PrivacyClassification,
  Redactable,
  RedactedView,
} from './privacy';
export { privacy, redacted, redactView, reveal, validateClassification } from './privacy';
