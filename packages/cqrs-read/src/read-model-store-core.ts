/**
 * The engine-neutral read-model-store logic (issue #105-B): the `read_models` + `checkpoints` table
 * shapes, the SQL, and the atomic `clear()` — written once against {@link SqlDriver} so the native
 * (`bun:sqlite`) and browser (SQLite-WASM/OPFS) drivers share one implementation.
 *
 * Imports **no** SQLite engine (only {@link SqlDriver}), so it is safe in either runtime, and preserves
 * the exact behaviour the shared `readModelStoreContract` already pins for the native driver
 * (ADR 0004 §5, ADR 0005 §1). Rebuildability is load-bearing: `clear()` drops both tables atomically so a
 * projection can replay from position 0 to identical state (never models without their checkpoint).
 */

import type { ReadModelStorePort } from '@grimora/core-domain';
import type { SqlDriver } from './sql-driver';

/**
 * A SQLite-backed read-model store. Extends `ReadModelStorePort` with `close()` because a durable adapter
 * owns a database handle the composition root must release — the pure port has no such lifecycle. Shared
 * by the native and OPFS drivers.
 */
export interface SqliteReadModelStore extends ReadModelStorePort {
  /** Release the underlying database handle. After this the store must not be used again. */
  close(): void;
}

/**
 * Build a durable {@link SqliteReadModelStore} over an already-open {@link SqlDriver}. Creates the
 * `read_models` (keyed by `(collection, id)`) and `checkpoints` (keyed by `projection`) tables on first
 * use (idempotent `IF NOT EXISTS`, ADR 0005 §6). Read models and checkpoints are upserted last-write-wins
 * as a projection folds events; `clear()` wipes both atomically for a clean rebuild-from-0 (ADR 0004 §5).
 * @param driver  an open SQLite driver (native `bun:sqlite` or browser SQLite-WASM/OPFS)
 * @returns       a ready-to-use read-model store bound to that driver
 */
export function createReadModelStoreOverDriver(driver: SqlDriver): SqliteReadModelStore {
  driver.exec(`
    CREATE TABLE IF NOT EXISTS read_models (
      collection TEXT NOT NULL,
      id         TEXT NOT NULL,
      value      TEXT NOT NULL,
      PRIMARY KEY (collection, id)
    )
  `);
  driver.exec(`
    CREATE TABLE IF NOT EXISTS checkpoints (
      projection TEXT PRIMARY KEY,
      position   INTEGER NOT NULL
    )
  `);

  const selectModel = driver.prepare(
    'SELECT value FROM read_models WHERE collection = ? AND id = ?',
  );
  // Upsert: a projection re-puts the same key as it folds more events, so put is last-write-wins.
  const upsertModel = driver.prepare(
    `INSERT INTO read_models (collection, id, value) VALUES (?, ?, ?)
       ON CONFLICT (collection, id) DO UPDATE SET value = excluded.value`,
  );
  const selectCheckpoint = driver.prepare('SELECT position FROM checkpoints WHERE projection = ?');
  const upsertCheckpoint = driver.prepare(
    `INSERT INTO checkpoints (projection, position) VALUES (?, ?)
       ON CONFLICT (projection) DO UPDATE SET position = excluded.position`,
  );
  const deleteModels = driver.prepare('DELETE FROM read_models');
  const deleteCheckpoints = driver.prepare('DELETE FROM checkpoints');

  return {
    async get<T>(collection: string, id: string): Promise<T | undefined> {
      const row = selectModel.get(collection, id);
      return row === undefined ? undefined : (JSON.parse(row.value as string) as T);
    },

    async put<T>(collection: string, id: string, value: T): Promise<void> {
      upsertModel.run(collection, id, JSON.stringify(value));
    },

    async getCheckpoint(projection: string): Promise<number> {
      // Missing row → default position 0 (a projection that has never checkpointed), ADR 0004 §5.
      const row = selectCheckpoint.get(projection);
      return row === undefined ? 0 : (row.position as number);
    },

    async setCheckpoint(projection: string, position: number): Promise<void> {
      upsertCheckpoint.run(projection, position);
    },

    async clear(): Promise<void> {
      // Both tables in one transaction so a rebuild never sees models without their checkpoint (or
      // vice-versa) — the rebuild-from-position-0 precondition (ADR 0004 §5).
      driver.transaction(() => {
        deleteModels.run();
        deleteCheckpoints.run();
      });
    },

    close(): void {
      driver.close();
    },
  };
}
