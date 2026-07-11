/**
 * `@grimora/cqrs-read` (native entry) — a durable `ReadModelStorePort` adapter (ADR 0004 §5, ADR 0005 §1)
 * backed by **native SQLite via `bun:sqlite`**, the read-side counterpart to `@grimora/event-store`. It
 * holds the denormalized read models the UI queries (never the event store, ADR 0004 §5) plus each
 * projection's checkpoint, and is held to the shared `readModelStoreContract` (ADR 0017).
 *
 * The store logic lives engine-neutrally in `read-model-store-core.ts` (over {@link SqlDriver}); this
 * module only wraps `bun:sqlite`, so the browser **OPFS** driver (`./opfs`, issue #105-B) reuses the exact
 * same SQL. Importing this entry pulls in `bun:sqlite` (Node/Bun only) — the browser imports
 * `@grimora/cqrs-read/opfs` instead. Two adapters (this + the event store) may share one database file
 * (their table names do not collide) or use separate files; the composition root decides. This adapter
 * never imports the event-store adapter in production (`adapters-no-cross-adapter`).
 */

import { Database } from 'bun:sqlite';
import { createReadModelStoreOverDriver, type SqliteReadModelStore } from './read-model-store-core';
import type { SqlDriver } from './sql-driver';

export type { SqliteReadModelStore } from './read-model-store-core';

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

/**
 * Wrap a `bun:sqlite` `Database` into the engine-neutral {@link SqlDriver}: normalise a missing `get` row
 * from `null` to `undefined`, and turn Bun's deferred `transaction(fn)` factory into the driver's "run
 * atomically now" semantic by immediately invoking it.
 * @param filename  the database file path (or `:memory:` for an ephemeral database)
 * @returns         a driver backed by native SQLite
 */
function createBunSqlDriver(filename: string): SqlDriver {
  const db = new Database(filename);
  return {
    exec(sql) {
      db.run(sql);
    },
    prepare(sql) {
      const stmt = db.query(sql);
      return {
        get: (...params) => (stmt.get(...params) as Record<string, unknown> | null) ?? undefined,
        all: (...params) => stmt.all(...params) as Record<string, unknown>[],
        run: (...params) => {
          stmt.run(...params);
        },
      };
    },
    transaction(fn) {
      db.transaction(fn)();
    },
    close() {
      db.close();
    },
  };
}

/**
 * Create a durable native-SQLite-backed {@link SqliteReadModelStore}. Behaviour (table shape, upsert,
 * checkpoints, atomic `clear()`) is defined once in `read-model-store-core.ts`; this supplies the
 * `bun:sqlite` driver.
 * @param options  optional database file path (defaults to an in-memory database)
 * @returns        a ready-to-use SQLite read-model store
 */
export function createSqliteReadModelStore(
  options: SqliteReadModelStoreOptions = {},
): SqliteReadModelStore {
  return createReadModelStoreOverDriver(createBunSqlDriver(options.filename ?? ':memory:'));
}
