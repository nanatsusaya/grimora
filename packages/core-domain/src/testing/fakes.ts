/**
 * In-memory fakes for every port (ADR 0017 R1 — fakes live in a `core-domain` testing sub-path, reused
 * by tests and the composition root without shipping in the main entry). Deterministic by construction
 * (fixed clock, sequential ids, seeded RNG in the domain) so the whole slice validates without real
 * infrastructure (ADR 0022 §5). Published via the `@grimora/core-domain/testing` subpath.
 */

import type {
  EntityId,
  EventEnvelope,
  IsoTimestamp,
  PersistedEvent,
  Result,
} from '@grimora/shared-types';
import { err, ok } from '@grimora/shared-types';
import type {
  Actor,
  AiProviderPort,
  AuthPort,
  AuthSession,
  ClockPort,
  EventStorePort,
  IdGeneratorPort,
  PolicyPort,
  ProposedToolCall,
  ReadModelStorePort,
  SyncPort,
  SyncPushResult,
} from '../application/ports';
import { appError, EventIdMismatchError } from '../domain/errors';

/**
 * Whether two envelopes with the **same `id`** carry identical content — the test the append idempotency
 * check uses to tell a harmless re-delivery (skip) from a corrupt id reuse (#151). Compares every persisted
 * field; `payload`/`metadata` are compared structurally via canonical JSON (the event body is already
 * JSON-serializable, ADR 0004 §2), so ordering-insensitive deep equality is not required.
 * @param a  one envelope
 * @param b  the other (already known to share `a`'s id)
 * @returns  true iff all persisted fields match
 */
function sameEventContent(a: EventEnvelope, b: EventEnvelope): boolean {
  return (
    a.aggregateId === b.aggregateId &&
    a.aggregateType === b.aggregateType &&
    a.type === b.type &&
    a.version === b.version &&
    a.schemaVersion === b.schemaVersion &&
    a.occurredAt === b.occurredAt &&
    JSON.stringify(a.metadata ?? null) === JSON.stringify(b.metadata ?? null) &&
    JSON.stringify(a.payload) === JSON.stringify(b.payload)
  );
}

/**
 * An in-memory event store with the extra `replicate`/`snapshotAll` methods the sync harness needs.
 * `append` is the local write path (optimistic concurrency); `replicate` is insert-only, dedup-by-`id`
 * replication (ADR 0005 §3) that preserves each event's `version` while assigning a fresh local
 * `position` (positions are store-local, ADR 0004 §2).
 */
export interface InMemoryEventStore extends EventStorePort {
  /** Insert replicated events (from another store), skipping any `id` already present. */
  replicate(events: readonly PersistedEvent[]): Promise<void>;
  /** All persisted events in local `position` order (for sync/inspection). */
  snapshotAll(): readonly PersistedEvent[];
  /** Drop all events (used by the sync harness to re-materialize a client from the cloud). */
  reset(): void;
}

/** Create an in-memory event store (ADR 0004 §4). */
export function createInMemoryEventStore(): InMemoryEventStore {
  const byStream = new Map<string, PersistedEvent[]>();
  const seenIds = new Set<string>();
  const byId = new Map<string, PersistedEvent>();
  const all: PersistedEvent[] = [];
  let position = 0;

  const seenVersions = new Set<string>();

  const persist = (event: EventEnvelope): PersistedEvent => {
    const persisted: PersistedEvent = { ...event, position: ++position };
    const stream = byStream.get(event.aggregateId) ?? [];
    byStream.set(event.aggregateId, [...stream, persisted]);
    all.push(persisted);
    seenIds.add(event.id);
    byId.set(event.id, persisted);
    seenVersions.add(`${event.aggregateId}:${event.version}`);
    return persisted;
  };

  return {
    async append(
      streamId,
      expectedVersion,
      events,
    ): Promise<Result<void, ReturnType<typeof appError>>> {
      // Idempotency pre-pass (#151, ADR 0005 §3): an event whose `id` is already stored *identically* is a
      // no-op (a re-delivered event), while the same id with a *different* body is corruption (thrown, never
      // a Result). Only genuinely-new events go on to the optimistic-concurrency check — so re-delivering an
      // already-applied batch succeeds instead of failing the stale-version check.
      const toInsert: EventEnvelope[] = [];
      for (const event of events) {
        const existing = byId.get(event.id);
        if (existing) {
          if (!sameEventContent(existing, event)) throw new EventIdMismatchError(event.id);
          continue; // identical re-delivery → skip
        }
        toInsert.push(event);
      }
      if (toInsert.length === 0) return ok(undefined); // fully idempotent re-delivery

      const stream = byStream.get(streamId) ?? [];
      const current = stream.length > 0 ? (stream[stream.length - 1] as PersistedEvent).version : 0;
      if (current !== expectedVersion) {
        // Stale write → the caller rebases (ADR 0005 §4).
        return err(appError('store.version_conflict', 'Conflict'));
      }
      for (const event of toInsert) persist(event);
      return ok(undefined);
    },
    async readStream(streamId, fromVersion = 0) {
      return (byStream.get(streamId) ?? []).filter((e) => e.version > fromVersion);
    },
    async readAll(fromPosition = 0) {
      return all.filter((e) => e.position > fromPosition);
    },
    async replicate(events) {
      for (const event of events) {
        if (seenIds.has(event.id)) continue; // idempotent dedup-by-id (ADR 0005 §3)
        const versionKey = `${event.aggregateId}:${event.version}`;
        if (seenVersions.has(versionKey)) {
          // Per-aggregate version uniqueness (ADR 0004 §1/§2; the C11 collision bound, ADR 0024 §3
          // amendment) — the real durable store enforces this with a UNIQUE(aggregate_id, version)
          // constraint (packages/event-store); the fake now matches that fidelity (#76), so a bug that
          // would violate it in production fails loudly in tests too, instead of silently double-persisting.
          throw new Error(
            `InMemoryEventStore.replicate: duplicate event at (aggregateId, version) = (${event.aggregateId}, ${event.version})`,
          );
        }
        persist(event);
      }
    },
    snapshotAll() {
      return all;
    },
    reset() {
      byStream.clear();
      seenIds.clear();
      byId.clear();
      seenVersions.clear();
      all.length = 0;
      position = 0;
    },
  };
}

/**
 * An in-memory {@link SyncPort} modelling the **cloud server** side of ADR 0005 §3 ingestion, so the sync
 * contract (and, later, the rebase orchestration) can be exercised without a real Postgres / `apps/api`
 * (ADR 0017 R1). Ingestion is insert-only: dedup-by-`id` → `duplicate`; a per-aggregate optimistic check →
 * `conflict` on a stale/gapped `version`; otherwise `accepted` with a freshly assigned cloud `position`.
 * `pull` returns the events after a checkpoint (optionally stream-scoped). `snapshot()` exposes the
 * ingested cloud log for test inspection — it is not part of the {@link SyncPort} contract.
 * @returns a fresh in-memory sync port whose cloud starts empty
 */
export function createInMemorySyncPort(): SyncPort & {
  /** All ingested cloud events in canonical `position` order (test inspection only, not the port). */
  snapshot(): readonly PersistedEvent[];
} {
  const all: PersistedEvent[] = [];
  const seenIds = new Set<string>();
  const versionByAggregate = new Map<string, number>();
  let position = 0;

  return {
    async push(events) {
      const results: SyncPushResult[] = [];
      for (const event of events) {
        if (seenIds.has(event.id)) {
          // Idempotent no-op — an offline retry re-sending an accepted event (ADR 0005 §4).
          results.push({ id: event.id, status: 'duplicate' });
          continue;
        }
        const current = versionByAggregate.get(event.aggregateId) ?? 0;
        if (event.version !== current + 1) {
          // Stale or gapped version → the client rebases its intent onto `current` (ADR 0005 §4).
          results.push({ id: event.id, status: 'conflict', currentVersion: current });
          continue;
        }
        const persisted: PersistedEvent = { ...event, position: ++position };
        all.push(persisted);
        seenIds.add(event.id);
        versionByAggregate.set(event.aggregateId, event.version);
        results.push({ id: event.id, status: 'accepted', position: persisted.position });
      }
      return ok(results);
    },
    async pull(sincePosition, streams) {
      // The checkpoint advances past every event the server *considered* — including ones a stream scope
      // (or RLS, ADR 0005 §7) filtered out — so a scoped pull never leaves a gap the client re-requests.
      const considered = all.filter((e) => e.position > sincePosition);
      const events = streams
        ? considered.filter((e) => streams.includes(e.aggregateId))
        : considered;
      const checkpoint =
        considered.length > 0
          ? (considered[considered.length - 1] as PersistedEvent).position
          : sincePosition;
      return ok({ events, checkpoint });
    },
    snapshot() {
      return all;
    },
  };
}

/**
 * An in-memory {@link AuthPort} for tests + the composition root before the real Supabase adapter exists
 * (ADR 0017 R1). Sign-in succeeds for a **registered** user whose credentials match; anything else is an
 * `Unauthorized` error. Session state and change-notifications are modelled so the ADR 0012 §13 first-bind
 * and UI reactivity can be exercised deterministically — no network, no real tokens.
 * @param users  the known accounts: each maps an `email` (+ the expected `password` for `method: 'password'`
 *               or `token` for `method: 'otp'`) to a `userId`. Defaults to none (every sign-in fails).
 * @returns      a fresh auth port starting with **no** current session (the §13 unbound-device state)
 */
export function createInMemoryAuthPort(
  users: readonly {
    readonly email: string;
    readonly userId: EntityId;
    readonly password?: string;
    readonly token?: string;
  }[] = [],
): AuthPort {
  let session: AuthSession | undefined;
  const listeners = new Set<(next: AuthSession | undefined) => void>();
  const notify = (): void => {
    for (const listener of listeners) listener(session);
  };
  return {
    async signIn(credentials) {
      const user = users.find(
        (u) =>
          u.email === credentials.email &&
          (credentials.method === 'password'
            ? u.password === credentials.password
            : u.token === credentials.token),
      );
      if (!user) return err(appError('auth.invalid_credentials', 'Unauthorized'));
      session = { userId: user.userId };
      notify();
      return ok(session);
    },
    async signOut() {
      session = undefined;
      notify();
      return ok(undefined);
    },
    async getSession() {
      return session;
    },
    onSessionChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** In-memory read-model store (ADR 0004 §5). */
export function createInMemoryReadModelStore(): ReadModelStorePort {
  let collections = new Map<string, Map<string, unknown>>();
  let checkpoints = new Map<string, number>();
  const col = (name: string) => {
    let c = collections.get(name);
    if (!c) {
      c = new Map();
      collections.set(name, c);
    }
    return c;
  };
  return {
    async get<T>(collection: string, id: string) {
      return col(collection).get(id) as T | undefined;
    },
    async put<T>(collection: string, id: string, value: T) {
      col(collection).set(id, value);
    },
    async getCheckpoint(projection) {
      return checkpoints.get(projection) ?? 0;
    },
    async setCheckpoint(projection, pos) {
      checkpoints.set(projection, pos);
    },
    async clear() {
      collections = new Map();
      checkpoints = new Map();
    },
  };
}

/**
 * A deterministic clock (ADR 0004 §9): always returns the same instant, so event timestamps are
 * reproducible across runs (a real wall-clock would make tests non-deterministic).
 * @param iso  the fixed instant every `now()` returns (defaults to a stable arbitrary timestamp)
 * @returns    a `ClockPort` whose `now()` is constant
 */
export function createFixedClock(iso = '2026-07-07T00:00:00.000Z'): ClockPort {
  return { now: () => iso as IsoTimestamp };
}

/**
 * A deterministic id generator (ADR 0004 §2 in tests): sequential, prefixed ids instead of random
 * UUIDv7s, so event ids are reproducible and the per-client `prefix` keeps ids globally unique when
 * several simulated devices push to one store (the sync harness relies on this).
 * @param prefix  a per-generator prefix (e.g. a device label) guaranteeing cross-store id uniqueness
 * @returns       an `IdGeneratorPort` producing `${prefix}-0001`, `${prefix}-0002`, …
 */
export function createSequentialIdGenerator(prefix = 'id'): IdGeneratorPort {
  let n = 0;
  return {
    newId: () => `${prefix}-${(++n).toString().padStart(4, '0')}` as EntityId,
  };
}

/**
 * The provisional minimal authorization policy (ADR 0022 §7): any authenticated actor may *create*;
 * only an aggregate's owner may mutate it. Kept for tests (ADR 0017 R1 fakes) alongside the real
 * production policy, `createRoleMatrixPolicy` (`application/policy.ts`, #106), which composition roots
 * wire instead.
 */
export function createOwnerPolicy(): PolicyPort {
  return {
    can(actor: Actor, action, resource) {
      if (action === 'campaign.create' || action === 'character.create') {
        return actor.userId !== ('' as EntityId);
      }
      // Resource-scoped: creator = owner (ADR 0022 §7).
      return resource.ownerId !== undefined && resource.ownerId === actor.userId;
    },
  };
}

/**
 * A scripted AI provider (ADR 0008 §1 fake): returns a pre-set proposal regardless of the prompt, so the
 * authz-parity test can drive the AI tool path deterministically without a real model.
 * @param proposal  the tool call to always propose, or undefined to simulate "no tool proposed"
 * @returns         an `AiProviderPort` that yields `proposal`
 */
export function createScriptedAiProvider(proposal: ProposedToolCall | undefined): AiProviderPort {
  return {
    async propose() {
      return proposal;
    },
  };
}
