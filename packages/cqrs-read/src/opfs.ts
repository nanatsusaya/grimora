/**
 * `@grimora/cqrs-read/opfs` (browser entry) — the durable `ReadModelStorePort` adapter backed by
 * **SQLite-WASM over OPFS** for the web runtime (ADR 0005 §1, issue #105-B), the read-side twin of
 * `@grimora/event-store/opfs`. It reuses the shared `read-model-store-core.ts` logic; only the driver
 * differs.
 *
 * **VFS choice — OPFS SAHPool (no COOP/COEP):** as with the event store, this uses the `opfs-sahpool`
 * VFS, which needs no `SharedArrayBuffer` and no cross-origin-isolation headers (only a Web Worker + an
 * OPFS-capable browser). Single-connection, which is fine for a single-device offline store.
 *
 * **Import boundary:** only browser code (`apps/web`, bundled by Vite) imports this entry — the Node/Bun
 * runtime imports `@grimora/cqrs-read` (native `bun:sqlite`), which never loads the WASM module.
 *
 * **Verification status:** the SQL logic is the same shared layer the native `readModelStoreContract`
 * pins in Node; the OPFS binding is browser-only and confirmed by a browser smoke, not the Node run
 * (the agreed #105-B test strategy).
 */

import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { createReadModelStoreOverDriver, type SqliteReadModelStore } from './read-model-store-core';
import type { SqlDriver, SqlStatement } from './sql-driver';

export type { SqliteReadModelStore } from './read-model-store-core';

/**
 * Construction options for {@link createOpfsReadModelStore}.
 */
export interface OpfsReadModelStoreOptions {
  /** why: the DB file *within* the SAHPool — SAHPool requires an absolute path, so it must start with `/` */
  readonly filename?: string;
  /** why: names (and, by default, the OPFS directory of) this app's VFS pool, isolating its storage */
  readonly vfsName?: string;
}

/**
 * Open an OPFS SAHPool database and adapt it to the engine-neutral {@link SqlDriver} (see the event-store
 * OPFS driver for the shared rationale). Async because loading the WASM module and installing the SAHPool
 * VFS are asynchronous; the driver is then used synchronously by `read-model-store-core.ts`.
 * @param filename  the absolute (`/`-prefixed) DB file path within the pool
 * @param vfsName   the SAHPool VFS name (and default directory)
 * @returns         a driver backed by SQLite-WASM over OPFS
 */
async function createOpfsSqlDriver(filename: string, vfsName: string): Promise<SqlDriver> {
  const sqlite3 = await sqlite3InitModule();
  const poolUtil = await sqlite3.installOpfsSAHPoolVfs({ name: vfsName });
  const db = new poolUtil.OpfsSAHPoolDb(filename);

  return {
    exec(sql) {
      db.exec(sql);
    },
    prepare(sql) {
      const stmt = db.prepare(sql);
      const wrapped: SqlStatement = {
        get(...params) {
          stmt.reset(true);
          if (params.length > 0) stmt.bind(params);
          const row = stmt.step() ? (stmt.get({}) as Record<string, unknown>) : undefined;
          stmt.reset(true);
          return row;
        },
        all(...params) {
          stmt.reset(true);
          if (params.length > 0) stmt.bind(params);
          const rows: Record<string, unknown>[] = [];
          while (stmt.step()) rows.push(stmt.get({}) as Record<string, unknown>);
          stmt.reset(true);
          return rows;
        },
        run(...params) {
          stmt.reset(true);
          if (params.length > 0) stmt.bind(params);
          stmt.step();
          stmt.reset(true);
        },
      };
      return wrapped;
    },
    transaction(fn) {
      db.transaction(() => {
        fn();
      });
    },
    close() {
      db.close();
    },
  };
}

/**
 * Create a durable OPFS-backed {@link SqliteReadModelStore} for the browser. Behaviour is the shared
 * `read-model-store-core.ts` logic; this only supplies the SQLite-WASM/OPFS driver.
 * @param options  optional OPFS filename + VFS name (sensible defaults for a single-store device)
 * @returns        a promise of a ready-to-use OPFS-backed read-model store
 */
export async function createOpfsReadModelStore(
  options: OpfsReadModelStoreOptions = {},
): Promise<SqliteReadModelStore> {
  const driver = await createOpfsSqlDriver(
    options.filename ?? '/grimora-read-models.sqlite3',
    options.vfsName ?? 'grimora-opfs',
  );
  return createReadModelStoreOverDriver(driver);
}
