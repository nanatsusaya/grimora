/**
 * @grimora/core-domain — the rule-agnostic hexagon interior (ADR 0003 §1): Domain + Application + Ports.
 *
 * **Provisional v0** (ADR 0022 §3 / R1): the seed the real core grows from; shapes here inform, but do
 * not freeze, the plugin-SDK v0 (ADR 0025) or later core ADRs. Reusable test fakes are **not** exported
 * here — they live behind the `@grimora/core-domain/testing` subpath.
 */

export {
  type AiTool,
  type AiTurnResult,
  coreAiTools,
  runAiToolTurn,
} from './application/ai-tools';
export { createPluginHost, type PluginHost } from './application/plugin-host';
export { createRoleMatrixPolicy } from './application/policy';
// --- Application: ports, use cases, projection, AI tools, plugin host ---
export type {
  Actor,
  AiProviderPort,
  AuthCredentials,
  AuthPort,
  AuthSession,
  ClockPort,
  EventStorePort,
  IdGeneratorPort,
  PolicyAction,
  PolicyPort,
  PolicyResource,
  ProposedToolCall,
  ReadModelStorePort,
  Role,
  RuleSystemRegistryPort,
  SyncPort,
  SyncPullPage,
  SyncPushResult,
} from './application/ports';
export {
  CHARACTER_SHEET,
  type CharacterSheet,
  type ProjectionDeps,
  rebuildCharacterSheetProjection,
  runCharacterSheetProjection,
} from './application/projection';
export {
  type CommandDeps,
  createCampaign,
  createCharacter,
  rollCheck,
  setAttribute,
} from './application/use-cases';
export {
  applyCampaign,
  type CampaignState,
  createCampaign as decideCreateCampaign,
  emptyCampaign,
} from './domain/campaign';
export {
  applyCharacter,
  type CharacterState,
  type CreateCharacterInput,
  createCharacter as decideCreateCharacter,
  emptyCharacter,
  rollCheck as decideRollCheck,
  setAttribute as decideSetAttribute,
} from './domain/character';
export { describeEvent } from './domain/describe';
// --- Domain: aggregates, events, the rules-runtime ---
export type { AppError, ErrorCategory } from './domain/errors';
export { appError, EVENT_ID_MISMATCH_CODE, EventIdMismatchError } from './domain/errors';
export type {
  AnyDomainEvent,
  CampaignEvent,
  CharacterEvent,
  NewEvent,
  StoredEvent,
} from './domain/events';
export { evaluateFormula, type FormulaContext } from './domain/formula';
export { deriveSeed, makeSeededRng } from './domain/rng';
