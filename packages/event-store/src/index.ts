/**
 * `@grimora/event-store` (native entry) — a durable `EventStorePort` adapter (ADR 0004 §4, ADR 0005 §1)
 * backed by **native SQLite via `bun:sqlite`**. This is the default entry: it covers the desktop/Tauri
 * runtime and the Node/Bun **test** runtime, and is held to the shared `eventStoreContract` (ADR 0017).
 *
 * The store logic lives engine-neutrally in `event-store-core.ts` (over the {@link SqlDriver}
 * abstraction); this module only wraps `bun:sqlite` into that driver, so the browser **OPFS** driver
 * (`./opfs`, issue #105-B) reuses the exact same SQL and invariants. Importing this entry pulls in
 * `bun:sqlite` (Node/Bun only) — the browser imports `@grimora/event-store/opfs` instead, which never
 * loads `bun:sqlite`.
 *
 * The adapter is engine-specific but leaks **no** SQLite type through `EventStorePort`; Domain and
 * Application never see it (ADR 0003 §1/§4) — it is wired at a composition root.
 */

import { Database } from 'bun:sqlite';
import { createEventStoreOverDriver, type SqliteEventStore } from './event-store-core';
import type { SqlDriver } from './sql-driver';

export type { SqliteEventStore } from './event-store-core';

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

/**
 * Wrap a `bun:sqlite` `Database` into the engine-neutral {@link SqlDriver}. Bun's prepared statements are
 * reusable and its `get`/`all`/`run` already take positional params; the only adaptations are normalising
 * a missing `get` row from `null` to `undefined`, and turning Bun's deferred `transaction(fn)` factory
 * into the driver's "run `fn` atomically now" semantic by immediately invoking it.
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
 * Create a durable native-SQLite-backed {@link SqliteEventStore}. Behaviour (table shape, optimistic
 * concurrency, exclusive `readStream`/`readAll`, per-aggregate `UNIQUE(aggregate_id, version)`) is defined
 * once in `event-store-core.ts`; this just supplies the `bun:sqlite` driver.
 * @param options  optional database file path (defaults to an in-memory database)
 * @returns        a ready-to-use SQLite event store
 */
export function createSqliteEventStore(options: SqliteEventStoreOptions = {}): SqliteEventStore {
  return createEventStoreOverDriver(createBunSqlDriver(options.filename ?? ':memory:'));
}
