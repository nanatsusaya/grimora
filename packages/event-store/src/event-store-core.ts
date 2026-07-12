/**
 * The engine-neutral event-store logic (issue #105-B): the `events` table shape, the SQL, the
 * optimistic-concurrency append transaction, and the row↔envelope mapping — written once against
 * {@link SqlDriver} so the native (`bun:sqlite`) and browser (SQLite-WASM/OPFS) drivers share one
 * implementation instead of duplicating the invariants.
 *
 * This module imports **no** SQLite engine (only the {@link SqlDriver} abstraction), so it is safe to
 * pull into either runtime. It preserves the exact behaviour the shared `eventStoreContract` already
 * pins for the native driver (ADR 0004 §4, ADR 0005 §1).
 */

import type { AppError, EventStorePort } from '@grimora/core-domain';
import { appError, EventIdMismatchError } from '@grimora/core-domain';
import type { EntityId, EventEnvelope, PersistedEvent, Result } from '@grimora/shared-types';
import { err, ok } from '@grimora/shared-types';
import type { SqlDriver } from './sql-driver';

/**
 * A SQLite-backed event store. Extends `EventStorePort` with `close()` because a durable adapter owns an
 * OS/handle resource the composition root must release — the pure port has no such lifecycle, so it stays
 * off the port and on the concrete adapter. Shared by the native and OPFS drivers.
 */
export interface SqliteEventStore extends EventStorePort {
  /**
   * Apply events replicated **from the cloud** (a sync pull, #107 slice 3b) into the local log — insert-only
   * and **idempotent by `id`** (ADR 0005 §3): an already-present event is a no-op, so re-pulling the same
   * page never double-applies. Unlike {@link EventStorePort.append} this is **not** the optimistic-concurrency
   * command path — replicated events carry their own cloud-assigned `version` and are not subject to an
   * `expectedVersion` check; each gets a fresh **local** `position` (positions are store-local, ADR 0004 §2).
   * A `(aggregate_id, version)` collision by a *different* id is genuine divergence (concurrent cross-device
   * writers) — out of scope under Option A (only an origin device writes a stream) and deferred to #176; it
   * surfaces here as a thrown error rather than silently overwriting.
   * @param events  the cloud events to apply locally (each already persisted upstream, carrying its version)
   */
  replicate(events: readonly PersistedEvent[]): Promise<void>;
  /** Release the underlying database handle. After this the store must not be used again. */
  close(): void;
}

/** The stable, namespaced conflict code the fake also returns — kept identical so callers/tests can't
 * tell the fake and this adapter apart on the concurrency path (ADR 0004 §4 optimistic concurrency). */
const CONFLICT_CODE = 'store.version_conflict';

/**
 * Sentinel thrown inside the append transaction when the optimistic-concurrency check fails, so the
 * transaction rolls back and the outer handler can translate it to a `Conflict` `Result` (expected
 * failures cross the boundary as `Result`, never as a thrown error — ADR 0009 §1).
 */
class VersionConflictError extends Error {}

/** The row shape the `events` table returns — snake_case columns mapped to the envelope on read. */
interface EventRow {
  readonly position: number;
  readonly id: string;
  readonly aggregate_id: string;
  readonly aggregate_type: string;
  readonly type: string;
  readonly version: number;
  readonly schema_version: number;
  readonly occurred_at: string;
  readonly metadata: string | null;
  readonly payload: string;
}

/**
 * True if a thrown error is a SQLite UNIQUE-constraint violation — the storage-level backstop for the
 * per-aggregate `version` invariant (and event-`id` idempotency). It fires when two writers pass the
 * in-transaction version check concurrently and both try to insert the same `(aggregate_id, version)`;
 * the second insert is rejected by the DB, which we surface as a `Conflict` exactly like a stale
 * `expectedVersion` (ADR 0024 §3 amendment / issue #76). Matches on both the `bun:sqlite` error `code`
 * and SQLite's own message text, so it works across engines (the WASM build throws the same message).
 * @param error  the value caught from a failed transaction
 * @returns      whether it is a UNIQUE-constraint violation
 */
function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { code?: unknown }).code;
  const message = (error as { message?: unknown }).message;
  return (
    (typeof code === 'string' && code.startsWith('SQLITE_CONSTRAINT')) ||
    (typeof message === 'string' && message.includes('UNIQUE constraint failed'))
  );
}

/**
 * Map a persisted `events` row back to a {@link PersistedEvent}, reversing the column mapping and
 * re-parsing the JSON `payload`/`metadata`. `metadata` is `undefined` (not `null`) when absent, matching
 * the optional-metadata envelope shape (ADR 0004 §2).
 * @param row  a raw row from the `events` table
 * @returns    the reconstructed persisted event
 */
function rowToEvent(row: EventRow): PersistedEvent {
  return {
    id: row.id as EntityId,
    aggregateId: row.aggregate_id as EntityId,
    aggregateType: row.aggregate_type,
    type: row.type,
    version: row.version,
    schemaVersion: row.schema_version,
    occurredAt: row.occurred_at as PersistedEvent['occurredAt'],
    metadata: row.metadata === null ? undefined : JSON.parse(row.metadata),
    payload: JSON.parse(row.payload),
    position: row.position,
  };
}

/**
 * Whether an already-stored row carries the **same content** as an incoming event with the same `id` — the
 * test the append idempotency check uses to tell a harmless re-delivery from corrupt id reuse (#151). Each
 * field is compared against how it was persisted: `payload`/`metadata` against their stored canonical JSON
 * (both serialized the same way on insert), so re-appending an identical event matches exactly.
 * @param row    the stored row found by the incoming event's id
 * @param event  the incoming event
 * @returns      true iff every persisted field is identical
 */
function sameStoredContent(row: EventRow, event: EventEnvelope): boolean {
  const expectedMetadata = event.metadata === undefined ? null : JSON.stringify(event.metadata);
  return (
    row.aggregate_id === event.aggregateId &&
    row.aggregate_type === event.aggregateType &&
    row.type === event.type &&
    row.version === event.version &&
    row.schema_version === event.schemaVersion &&
    row.occurred_at === event.occurredAt &&
    row.metadata === expectedMetadata &&
    row.payload === JSON.stringify(event.payload)
  );
}

/**
 * Build a durable {@link SqliteEventStore} over an already-open {@link SqlDriver}. Creates the `events`
 * table on first use (idempotent `IF NOT EXISTS`, ADR 0005 §6 startup migration) with the invariants the
 * port relies on: a store-local monotonic `position` (`INTEGER PRIMARY KEY AUTOINCREMENT`), a
 * globally-unique event `id`, and a **`UNIQUE(aggregate_id, version)`** constraint enforcing
 * per-aggregate version uniqueness at the storage layer (ADR 0004 §1/§2), not merely in application code.
 * @param driver  an open SQLite driver (native `bun:sqlite` or browser SQLite-WASM/OPFS)
 * @returns       a ready-to-use event store bound to that driver
 */
export function createEventStoreOverDriver(driver: SqlDriver): SqliteEventStore {
  driver.exec(`
    CREATE TABLE IF NOT EXISTS events (
      position       INTEGER PRIMARY KEY AUTOINCREMENT,
      id             TEXT    NOT NULL UNIQUE,
      aggregate_id   TEXT    NOT NULL,
      aggregate_type TEXT    NOT NULL,
      type           TEXT    NOT NULL,
      version        INTEGER NOT NULL,
      schema_version INTEGER NOT NULL,
      occurred_at    TEXT    NOT NULL,
      metadata       TEXT,
      payload        TEXT    NOT NULL,
      UNIQUE (aggregate_id, version)
    )
  `);

  const selectMaxVersion = driver.prepare(
    'SELECT MAX(version) AS v FROM events WHERE aggregate_id = ?',
  );
  const insertEvent = driver.prepare(
    `INSERT INTO events
       (id, aggregate_id, aggregate_type, type, version, schema_version, occurred_at, metadata, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  // The replication insert (sync pull, #107 slice 3b): `ON CONFLICT(id) DO NOTHING` makes a re-pulled
  // event an idempotent no-op (ADR 0005 §3 dedup-by-id). It deliberately targets ONLY the `id` conflict —
  // a `(aggregate_id, version)` clash by a *different* id is NOT swallowed, so it still raises and surfaces
  // as divergence (deferred to #176), rather than `INSERT OR IGNORE` which would hide it.
  const insertReplicated = driver.prepare(
    `INSERT INTO events
       (id, aggregate_id, aggregate_type, type, version, schema_version, occurred_at, metadata, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO NOTHING`,
  );
  const selectStream = driver.prepare(
    'SELECT * FROM events WHERE aggregate_id = ? AND version > ? ORDER BY version ASC',
  );
  const selectAll = driver.prepare('SELECT * FROM events WHERE position > ? ORDER BY position ASC');
  const selectById = driver.prepare('SELECT * FROM events WHERE id = ?');

  return {
    async append(
      streamId: EntityId,
      expectedVersion: number,
      events: readonly EventEnvelope[],
    ): Promise<Result<void, AppError>> {
      if (events.length === 0) return ok(undefined);
      try {
        // The idempotency pre-pass, the version check and the inserts are one atomic unit, so a concurrent
        // writer cannot interleave between "read current version" and "insert". A stale expectedVersion or
        // an id-corruption throws to roll the whole batch back.
        driver.transaction(() => {
          // Idempotency pre-pass (#151, ADR 0005 §3): an event whose `id` is already stored *identically*
          // is a no-op (re-delivery); the same id with a *different* body is corruption (throws, distinct
          // from a version Conflict). Only genuinely-new events proceed to the optimistic-concurrency check,
          // so re-delivering an already-applied batch succeeds rather than tripping the stale-version check.
          const toInsert: EventEnvelope[] = [];
          for (const event of events) {
            const existing = selectById.get(event.id) as EventRow | undefined;
            if (existing) {
              if (!sameStoredContent(existing, event)) throw new EventIdMismatchError(event.id);
              continue; // identical re-delivery → skip
            }
            toInsert.push(event);
          }
          if (toInsert.length === 0) return; // fully idempotent re-delivery — commit nothing, no-op success

          const row = selectMaxVersion.get(streamId) as { v: number | null } | undefined;
          const current = row?.v ?? 0;
          if (current !== expectedVersion) throw new VersionConflictError();
          for (const event of toInsert) {
            insertEvent.run(
              event.id,
              event.aggregateId,
              event.aggregateType,
              event.type,
              event.version,
              event.schemaVersion,
              event.occurredAt,
              event.metadata === undefined ? null : JSON.stringify(event.metadata),
              JSON.stringify(event.payload),
            );
          }
        });
        return ok(undefined);
      } catch (error) {
        // Both a stale expectedVersion (app-level check) and a UNIQUE(aggregate_id, version) violation
        // (storage-level backstop for concurrent writers) are the same optimistic-concurrency conflict —
        // the caller rebases (ADR 0005 §4). An `EventIdMismatchError` (id reuse with different content) is
        // corruption and propagates as a throw (#151). Anything else is unexpected and rethrows to the
        // composition root (ADR 0009 §1: programmer/infrastructure errors are not modelled as Result errors).
        if (error instanceof VersionConflictError || isUniqueViolation(error)) {
          return err(appError(CONFLICT_CODE, 'Conflict'));
        }
        throw error;
      }
    },

    async readStream(streamId: EntityId, fromVersion = 0): Promise<readonly PersistedEvent[]> {
      // `version > fromVersion` — the EXCLUSIVE lower bound the port mandates: an incremental reader
      // passes its last-seen version, so an inclusive `>=` would re-fold the boundary event (ADR 0004 §4).
      return (selectStream.all(streamId, fromVersion) as unknown as EventRow[]).map(rowToEvent);
    },

    async readAll(fromPosition = 0): Promise<readonly PersistedEvent[]> {
      // `position > fromPosition` — EXCLUSIVE, for the same reason on the projection/sync checkpoint side.
      return (selectAll.all(fromPosition) as unknown as EventRow[]).map(rowToEvent);
    },

    async replicate(events: readonly PersistedEvent[]): Promise<void> {
      if (events.length === 0) return;
      try {
        // One transaction for the whole page: either all newly-seen events apply, or (on divergence) none —
        // so a re-run pulls the same page cleanly. Each event keeps its cloud `version`; the local `position`
        // is reassigned by AUTOINCREMENT (positions are store-local, ADR 0004 §2), so it is not inserted.
        driver.transaction(() => {
          for (const event of events) {
            insertReplicated.run(
              event.id,
              event.aggregateId,
              event.aggregateType,
              event.type,
              event.version,
              event.schemaVersion,
              event.occurredAt,
              event.metadata === undefined ? null : JSON.stringify(event.metadata),
              JSON.stringify(event.payload),
            );
          }
        });
      } catch (error) {
        // A UNIQUE(aggregate_id, version) violation here means a *different* event already holds that
        // (stream, version) locally — concurrent cross-device divergence, not an id re-delivery (those are
        // absorbed by ON CONFLICT(id) DO NOTHING). That is the co-editing case deferred to #176; surface it
        // loudly rather than silently dropping or overwriting. Anything else is unexpected infra → rethrow.
        if (isUniqueViolation(error)) {
          throw new Error(
            'event-store replicate: divergent (aggregate_id, version) — concurrent cross-device write, deferred to #176',
          );
        }
        throw error;
      }
    },

    close(): void {
      driver.close();
    },
  };
}
