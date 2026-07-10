/**
 * `@grimora/cqrs-read` — a durable `ReadModelStorePort` adapter (ADR 0004 §5, ADR 0005 §1) backed by
 * **SQLite via `bun:sqlite`**, the read-side counterpart to `@grimora/event-store`. It holds the
 * denormalized read models the UI queries (never the event store, ADR 0004 §5) plus each projection's
 * checkpoint, and is held to the shared `readModelStoreContract` so it is behaviourally interchangeable
 * with the in-memory fake (ADR 0017 port-contract tests).
 *
 * **Rebuildability is the load-bearing property** (ADR 0004 §5): read models are *derived* projections
 * of the event log, never a second source of truth. `clear()` drops both the read-model rows **and** the
 * checkpoints so a projection can replay from `position 0` to identical state — this is why a breaking
 * read-model change is a replay, not a data migration (ADR 0005 §6).
 *
 * **Driver scope (deliberate, same as #103):** native `bun:sqlite` only; the OPFS/WASM web driver is
 * deferred to the `apps/web` shell (#105) where a browser can verify it end-to-end. The table shape is
 * plain so that driver reuses it. Two adapters (this + `@grimora/event-store`) may point at the **same**
 * database file — their table names (`read_models`/`checkpoints` vs `events`) do not collide — or at
 * separate files; the composition root decides. This adapter never imports the event-store adapter
 * (`adapters-no-cross-adapter`); it only implements the port.
 */

import { Database, type Statement } from 'bun:sqlite';
import type { ReadModelStorePort } from '@grimora/core-domain';

/**
 * A SQLite-backed read-model store. Extends `ReadModelStorePort` with `close()` because a durable adapter
 * owns a database handle the composition root must release — the pure port has no such lifecycle.
 */
export interface SqliteReadModelStore extends ReadModelStorePort {
  /** Release the underlying database handle. After this the store must not be used again. */
  close(): void;
}

/**
 * Construction options for {@link createSqliteReadModelStore}.
 */
export interface SqliteReadModelStoreOptions {
  /**
   * The database file path. Omit (or pass `:memory:`) for an ephemeral in-memory database — the default,
   * used by the contract tests. A real composition root passes a device-local file path (ADR 0005 §1),
   * which may be the same file the event-store adapter uses (the table names do not collide).
   */
  readonly filename?: string;
}

/** A row from the `read_models` table — the JSON `value` is re-parsed on read. */
interface ReadModelRow {
  readonly value: string;
}

/** A row from the `checkpoints` table. */
interface CheckpointRow {
  readonly position: number;
}

/**
 * Create a durable SQLite-backed {@link SqliteReadModelStore}. Creates the `read_models` and
 * `checkpoints` tables on first use (idempotent `IF NOT EXISTS`, ADR 0005 §6 startup migration). Read
 * models are keyed by `(collection, id)`; checkpoints by `projection`.
 * @param options  optional database file path (defaults to an in-memory database)
 * @returns        a ready-to-use SQLite read-model store
 */
export function createSqliteReadModelStore(
  options: SqliteReadModelStoreOptions = {},
): SqliteReadModelStore {
  const db = new Database(options.filename ?? ':memory:');

  db.run(`
    CREATE TABLE IF NOT EXISTS read_models (
      collection TEXT NOT NULL,
      id         TEXT NOT NULL,
      value      TEXT NOT NULL,
      PRIMARY KEY (collection, id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS checkpoints (
      projection TEXT PRIMARY KEY,
      position   INTEGER NOT NULL
    )
  `);

  const selectModel: Statement = db.query(
    'SELECT value FROM read_models WHERE collection = ? AND id = ?',
  );
  // Upsert: a projection re-puts the same key as it folds more events, so put is last-write-wins.
  const upsertModel: Statement = db.query(
    `INSERT INTO read_models (collection, id, value) VALUES (?, ?, ?)
       ON CONFLICT (collection, id) DO UPDATE SET value = excluded.value`,
  );
  const selectCheckpoint: Statement = db.query(
    'SELECT position FROM checkpoints WHERE projection = ?',
  );
  const upsertCheckpoint: Statement = db.query(
    `INSERT INTO checkpoints (projection, position) VALUES (?, ?)
       ON CONFLICT (projection) DO UPDATE SET position = excluded.position`,
  );
  const deleteModels: Statement = db.query('DELETE FROM read_models');
  const deleteCheckpoints: Statement = db.query('DELETE FROM checkpoints');
  // clear() must wipe both tables atomically so a rebuild never sees models without their checkpoint
  // (or vice-versa) — the rebuild-from-position-0 precondition (ADR 0004 §5).
  const clearAll = db.transaction(() => {
    deleteModels.run();
    deleteCheckpoints.run();
  });

  return {
    async get<T>(collection: string, id: string): Promise<T | undefined> {
      // bun:sqlite returns `null` (not `undefined`) when no row matches — normalise to `undefined`.
      const row = selectModel.get(collection, id) as ReadModelRow | null;
      return row === null ? undefined : (JSON.parse(row.value) as T);
    },

    async put<T>(collection: string, id: string, value: T): Promise<void> {
      upsertModel.run(collection, id, JSON.stringify(value));
    },

    async getCheckpoint(projection: string): Promise<number> {
      // `null` when the projection has never checkpointed → default position 0 (ADR 0004 §5).
      const row = selectCheckpoint.get(projection) as CheckpointRow | null;
      return row?.position ?? 0;
    },

    async setCheckpoint(projection: string, position: number): Promise<void> {
      upsertCheckpoint.run(projection, position);
    },

    async clear(): Promise<void> {
      clearAll();
    },

    close(): void {
      db.close();
    },
  };
}
