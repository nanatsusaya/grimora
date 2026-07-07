/**
 * The ports (ADR 0003 §1/§7): interfaces the Application declares and adapters implement. Domain and
 * Application depend only on these; concrete SQLite/Postgres/AI adapters live outside the hexagon and
 * are wired at the composition root. The skeleton implements them all as in-memory fakes (ADR 0017 R1,
 * `../testing`).
 *
 * **Provisional v0** (ADR 0022 §3): sketches, not the frozen port catalog. Notably the store is
 * array-returning rather than `AsyncIterable` (ADR 0004 §4 uses streaming) — a deliberate skeleton
 * simplification.
 */

import type { CheckDefinition, RuleSystemDefinition } from "@grimora/plugin-sdk";
import type {
  EntityId,
  EventEnvelope,
  IsoTimestamp,
  PersistedEvent,
  Result,
} from "@grimora/shared-types";
import type { AppError } from "../domain/errors";

/** Append-only event store (ADR 0004 §4). Optimistic concurrency via `expectedVersion`. */
export interface EventStorePort {
  /**
   * Append events to a stream iff `expectedVersion` still matches the stream's current version.
   * @param streamId         the aggregate stream
   * @param expectedVersion  the version the caller rehydrated from (0 for a new stream)
   * @param events           fully-formed envelopes (the store assigns each a global `position`)
   * @returns                ok, or a `Conflict` error on a stale write (→ client rebase, ADR 0005 §4)
   */
  append(
    streamId: EntityId,
    expectedVersion: number,
    events: readonly EventEnvelope[],
  ): Promise<Result<void, AppError>>;
  /** Read one aggregate's events in version order (optionally from a version). */
  readStream(streamId: EntityId, fromVersion?: number): Promise<readonly PersistedEvent[]>;
  /** Read all events across streams in store `position` order (for projections/sync). */
  readAll(fromPosition?: number): Promise<readonly PersistedEvent[]>;
}

/** Denormalized read-model store the UI/queries read from (ADR 0004 §5). Never the event store. */
export interface ReadModelStorePort {
  get<T>(collection: string, id: string): Promise<T | undefined>;
  put<T>(collection: string, id: string, value: T): Promise<void>;
  /** Last processed `position` for a projection (checkpointing, ADR 0004 §5). */
  getCheckpoint(projection: string): Promise<number>;
  setCheckpoint(projection: string, position: number): Promise<void>;
  /** Drop all read-model data + checkpoints (for a rebuild-from-position-0). */
  clear(): Promise<void>;
}

/** Injected clock (ADR 0004 §9) — the Domain never reads wall-clock time directly. */
export interface ClockPort {
  now(): IsoTimestamp;
}

/** Injected id generator (ADR 0004 §2) — UUIDv7 in production; deterministic in tests. */
export interface IdGeneratorPort {
  newId(): EntityId;
}

/** The authenticated actor a use case runs on behalf of. */
export interface Actor {
  readonly userId: EntityId;
}

/** The actions the skeleton authorizes. */
export type PolicyAction =
  | "campaign.create"
  | "character.create"
  | "character.setAttribute"
  | "character.rollCheck";

/** The resource an action targets, carrying the ownership needed for a resource-scoped check. */
export interface PolicyResource {
  /** The resource owner, when the action targets an existing resource. */
  readonly ownerId?: EntityId;
}

/**
 * Authorization policy (ADR 0009 §3, ADR 0010 §2): a **pure** function of (actor, action, resource).
 * Enforced in the Application layer for every use case (default-deny, ADR 0010 §2) — and reused
 * unchanged by the AI tool path (ADR 0008 §2), which is what the skeleton's authz-parity check proves.
 */
export interface PolicyPort {
  can(actor: Actor, action: PolicyAction, resource: PolicyResource): boolean;
}

/** A tool call an AI provider proposes (a descriptor over an existing use case, ADR 0008 §2). */
export interface ProposedToolCall {
  readonly tool: string;
  readonly args: Readonly<Record<string, unknown>>;
}

/**
 * AI provider abstraction (ADR 0008 §1). The skeleton only needs it to *propose* a tool call; the
 * agent loop then executes it through the same use case + authorization as the UI (no privileged path).
 */
export interface AiProviderPort {
  propose(message: string, tools: readonly string[]): Promise<ProposedToolCall | undefined>;
}

/**
 * In-process rule-system registry (ADR 0006 §5 first-party). The host loads a plugin (calls its
 * `register`) and exposes the collected definitions to use cases.
 */
export interface RuleSystemRegistryPort {
  getRuleSystem(ruleSystemId: string): RuleSystemDefinition | undefined;
  getCheck(ruleSystemId: string, checkId: string): CheckDefinition | undefined;
  /**
   * Bounds for a **rated** trait (attribute *or* skill — both are stored, bounded values in the generic
   * trait container, ADR 0020), or undefined if the id is not a rated trait. Used to validate a set.
   */
  getRatedTrait(
    ruleSystemId: string,
    traitId: string,
  ): { readonly min: number; readonly max: number } | undefined;
  /** Which plugin (id + version) contributed a rule system — recorded as event provenance (ADR 0006 §4). */
  getProvenance(
    ruleSystemId: string,
  ): { readonly pluginId: string; readonly pluginVersion: string } | undefined;
}
