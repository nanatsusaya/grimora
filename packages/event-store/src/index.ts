/**
 * `@grimora/event-store` — a durable `EventStorePort` adapter (ADR 0004 §4, ADR 0005 §1) backed by
 * **SQLite via `bun:sqlite`**. This is the first real, non-fake implementation of the port: it replaces
 * the in-memory fake (`@grimora/core-domain/testing`) for native/desktop/test runtimes, and is held to
 * the same behaviour by the shared `eventStoreContract` (ADR 0017 port-contract tests).
 *
 * **Driver scope (deliberate, see issue #103):** ADR 0005 §1 fixes SQLite as the local engine —
 * *native* SQLite here (`bun:sqlite`, covering desktop/Tauri + the test runtime) and *SQLite-WASM over
 * OPFS* on web. Only the **native** driver lives here; the OPFS/WASM web driver is deferred to the
 * `apps/web` shell work (#105), where a browser context exists to verify it end-to-end (an OPFS backend
 * cannot be honestly exercised in this Bun test environment, so shipping it here would violate the
 * Definition of Done). The SQL/table shape below is intentionally plain so the web driver can reuse it.
 *
 * The adapter is engine-specific but leaks **no** SQLite type through `EventStorePort`; Domain and
 * Application never see it (ADR 0003 §1/§4) — it is wired at a composition root.
 */

import { Database, type Statement } from 'bun:sqlite';
import type { EventStorePort } from '@grimora/core-domain';
import { type AppError, appError } from '@grimora/core-domain';
import type { EntityId, EventEnvelope, PersistedEvent, Result } from '@grimora/shared-types';
import { err, ok } from '@grimora/shared-types';

/**
 * A SQLite-backed event store. Extends `EventStorePort` with `close()` because a durable adapter owns an
 * OS resource (the database handle/file) the composition root must release — the pure port has no such
 * lifecycle, so it stays off the port and on the concrete adapter.
 */
export interface SqliteEventStore extends EventStorePort {
  /** Release the underlying database handle. After this the store must not be used again. */
  close(): void;
}

/**
 * Construction options for {@link createSqliteEventStore}.
 */
export interface SqliteEventStoreOptions {
  /**
   * The database file path. Omit (or pass `:memory:`) for an ephemeral in-memory database — the default,
   * used by the contract tests. A real composition root passes a device-local file path (ADR 0005 §1).
   */
  readonly filename?: string;
}

/** The stable, namespaced conflict code the fake also returns — kept identical so callers/tests can’t
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
 * in-transaction version check concurrently (e.g. two OS processes on one file) and both try to insert
 * the same `(aggregate_id, version)`; the second insert is rejected by the DB, which we surface as a
 * `Conflict` exactly like a stale `expectedVersion` (ADR 0024 §3 amendment / issue #76).
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
 * Create a durable SQLite-backed {@link SqliteEventStore}. Creates the `events` table on first use
 * (idempotent `IF NOT EXISTS`, ADR 0005 §6 startup migration) with the invariants the port relies on:
 * a store-local monotonic `position` (`INTEGER PRIMARY KEY AUTOINCREMENT`), a globally-unique event `id`,
 * and — the item this ticket adds over the fake — a **`UNIQUE(aggregate_id, version)`** constraint that
 * enforces per-aggregate version uniqueness at the storage layer (ADR 0004 §1/§2), not merely in
 * application code.
 * @param options  optional database file path (defaults to an in-memory database)
 * @returns        a ready-to-use SQLite event store
 */
export function createSqliteEventStore(options: SqliteEventStoreOptions = {}): SqliteEventStore {
  const db = new Database(options.filename ?? ':memory:');

  db.run(`
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

  const selectMaxVersion: Statement = db.query(
    'SELECT MAX(version) AS v FROM events WHERE aggregate_id = ?',
  );
  const insertEvent: Statement = db.query(
    `INSERT INTO events
       (id, aggregate_id, aggregate_type, type, version, schema_version, occurred_at, metadata, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const selectStream: Statement = db.query(
    'SELECT * FROM events WHERE aggregate_id = ? AND version > ? ORDER BY version ASC',
  );
  const selectAll: Statement = db.query(
    'SELECT * FROM events WHERE position > ? ORDER BY position ASC',
  );

  /**
   * The append transaction: the version check and the inserts are one atomic unit, so a concurrent
   * writer cannot interleave between "read current version" and "insert". A stale `expectedVersion`
   * throws {@link VersionConflictError} to roll the whole batch back.
   */
  const appendTx = db.transaction(
    (streamId: string, expectedVersion: number, events: readonly EventEnvelope[]) => {
      const row = selectMaxVersion.get(streamId) as { v: number | null } | undefined;
      const current = row?.v ?? 0;
      if (current !== expectedVersion) throw new VersionConflictError();
      for (const event of events) {
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
    },
  );

  return {
    async append(
      streamId: EntityId,
      expectedVersion: number,
      events: readonly EventEnvelope[],
    ): Promise<Result<void, AppError>> {
      if (events.length === 0) return ok(undefined);
      try {
        appendTx(streamId, expectedVersion, events);
        return ok(undefined);
      } catch (error) {
        // Both a stale expectedVersion (app-level check) and a UNIQUE(aggregate_id, version) violation
        // (storage-level backstop for concurrent writers) are the same optimistic-concurrency conflict —
        // the caller rebases (ADR 0005 §4). Anything else is unexpected and rethrows to the composition
        // root (ADR 0009 §1: programmer/infrastructure errors are not modelled as Result errors).
        if (error instanceof VersionConflictError || isUniqueViolation(error)) {
          return err(appError(CONFLICT_CODE, 'Conflict'));
        }
        throw error;
      }
    },

    async readStream(streamId: EntityId, fromVersion = 0): Promise<readonly PersistedEvent[]> {
      // `version > fromVersion` — the EXCLUSIVE lower bound the port mandates: an incremental reader
      // passes its last-seen version, so an inclusive `>=` would re-fold the boundary event (ADR 0004 §4).
      return (selectStream.all(streamId, fromVersion) as EventRow[]).map(rowToEvent);
    },

    async readAll(fromPosition = 0): Promise<readonly PersistedEvent[]> {
      // `position > fromPosition` — EXCLUSIVE, for the same reason on the projection/sync checkpoint side.
      return (selectAll.all(fromPosition) as EventRow[]).map(rowToEvent);
    },

    close(): void {
      db.close();
    },
  };
}
