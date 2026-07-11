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

import type { CheckDefinition, RuleSystemDefinition } from '@grimora/plugin-sdk';
import type {
  EntityId,
  EventEnvelope,
  IsoTimestamp,
  PersistedEvent,
  Result,
} from '@grimora/shared-types';
import type { AppError } from '../domain/errors';

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
  /**
   * Read one aggregate's events in ascending `version` order. `fromVersion` is **exclusive** — it
   * returns events with `version > fromVersion` (0/omitted = the whole stream). Every adapter MUST honour
   * this exclusivity: incremental readers pass their last-seen version, so an inclusive implementation
   * would re-fold the boundary event (double-apply) — a silent correctness bug.
   * @param streamId     the aggregate stream to read
   * @param fromVersion  exclusive lower bound; return events strictly after this version
   * @returns            the stream's events after `fromVersion`, in `version` order
   */
  readStream(streamId: EntityId, fromVersion?: number): Promise<readonly PersistedEvent[]>;
  /**
   * Read all events across streams in store `position` order (for projections/sync). `fromPosition` is
   * **exclusive** — returns events with `position > fromPosition` (0/omitted = from the start). The
   * projection checkpoint relies on this exclusivity; an inclusive adapter would reprocess the last
   * event on every run.
   * @param fromPosition  exclusive lower bound; return events strictly after this store position
   * @returns             events after `fromPosition`, in `position` order
   */
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

/**
 * The minimum role set ADR 0009 §3 names (extensible by later amendment/ADR): `spectator` is
 * enforced as strictly read-only by every {@link PolicyPort} action below (never granted a write).
 */
export type Role = 'owner' | 'gm' | 'player' | 'spectator';

/** The actions the skeleton authorizes. */
export type PolicyAction =
  | 'campaign.create'
  | 'character.create'
  | 'character.setAttribute'
  | 'character.rollCheck';

/**
 * The resource an action targets, carrying what a resource-scoped check needs. Both fields are
 * resolved by the **caller** (the use case, which has already rehydrated the aggregate) before
 * `PolicyPort.can` is invoked — the port itself stays a pure function, never a store lookup.
 */
export interface PolicyResource {
  /** The resource owner, when the action targets an existing resource. */
  readonly ownerId?: EntityId;
  /**
   * The actor's role *relative to this specific resource* (e.g. "GM of this campaign"), already
   * resolved from campaign-membership data — not a global role claim. Undefined until a membership
   * read model exists (#107/#120): today only the `ownerId` branch (and, transitively, the ADR 0012
   * §13 unbound-device identity, which simply *is* the owner of what it created) is reachable in
   * production; `gm`/`player`/`spectator` are exercised by `policy.test.ts` ahead of that wiring so
   * the matrix is correct and tested the moment membership resolution lands.
   */
  readonly actorRole?: Role;
}

/**
 * Authorization policy (ADR 0009 §3, ADR 0010 §2): a **pure** function of (actor, action, resource).
 * Enforced in the Application layer for every use case (default-deny, ADR 0010 §2) — and reused
 * unchanged by the AI tool path (ADR 0008 §2), which is what the skeleton's authz-parity check proves.
 *
 * **Existence-before-authz (resolved):** a use case that loads a resource before checking policy on it
 * must return a **uniform** result — the same `NotFound` error — whether the resource is genuinely
 * absent or exists but this actor is not authorized on it. Returning a distinguishable `Forbidden` in
 * the latter case would leak existence to an unauthorized caller (an id-enumeration oracle, ADR 0010
 * §1). See `application/use-cases.ts` for the applied pattern.
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
  /** The full definition of a loaded rule system, or undefined if no plugin contributed that id. */
  getRuleSystem(ruleSystemId: string): RuleSystemDefinition | undefined;
  /** A specific check within a rule system (the roll shape + resolution mechanic), or undefined. */
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
