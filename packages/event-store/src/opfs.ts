/**
 * `@grimora/event-store/opfs` (browser entry) — the durable `EventStorePort` adapter backed by
 * **SQLite-WASM over OPFS** for the web runtime (ADR 0005 §1, issue #105-B). It reuses the exact SQL and
 * invariants of the native adapter via the shared `event-store-core.ts` logic; only the driver differs.
 *
 * **VFS choice — OPFS SAHPool (no COOP/COEP):** this uses the `opfs-sahpool` VFS, which — per the SQLite
 * WASM docs — needs **no** `SharedArrayBuffer` and **no** COOP/COEP cross-origin-isolation headers (only a
 * Web Worker + an OPFS-capable browser). That deliberately avoids the header requirement the default
 * `opfs` VFS imposes, simplifying the Cloudflare Pages deploy. The trade-off is single-connection access
 * (no multi-tab concurrent DB writes), which is fine for a single-device offline store.
 *
 * **Import boundary:** only browser code (`apps/web`, bundled by Vite) imports this entry — it pulls in
 * the WASM module. The Node/Bun runtime imports `@grimora/event-store` (the native `bun:sqlite` entry),
 * which never loads this file, so the WASM module never reaches the test runtime.
 *
 * **Verification status:** the SQL logic is the same shared layer the native `eventStoreContract` pins in
 * Node; the OPFS binding itself is browser-only and is confirmed by a browser smoke (persist → reload),
 * not by the Node test run (the agreed #105-B test strategy — full in-browser contracts land with #105-D).
 */

import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { createEventStoreOverDriver, type SqliteEventStore } from './event-store-core';
import type { SqlDriver, SqlStatement } from './sql-driver';

export type { SqliteEventStore } from './event-store-core';

/**
 * Construction options for {@link createOpfsEventStore}.
 */
export interface OpfsEventStoreOptions {
  /** why: the DB file *within* the SAHPool — SAHPool requires an absolute path, so it must start with `/` */
  readonly filename?: string;
  /** why: names (and, by default, the OPFS directory of) this app's VFS pool, isolating its storage from
   * any other SQLite-WASM engine on the same origin. MUST be **distinct** from the read-model store's pool
   * name: opening two SAHPool VFSes of the *same* name in one worker collides on OPFS access handles, so
   * the two stores use separate pools (see the distinct defaults here vs. `cqrs-read`). */
  readonly vfsName?: string;
}

/**
 * Open an OPFS SAHPool database and adapt it to the engine-neutral {@link SqlDriver}. Async because both
 * loading the WASM module and installing the SAHPool VFS are asynchronous; the returned driver is then
 * used synchronously by `event-store-core.ts` (its `exec`/`prepare`/`transaction` map onto the SQLite-WASM
 * OO1 API — a prepared statement is reset+rebound per call, and `transaction` runs the OO1 immediate
 * transaction which rolls back and re-throws on error, matching the native driver's semantics).
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
      // OO1's transaction runs the callback immediately inside BEGIN…COMMIT, rolling back and re-throwing
      // if it throws — exactly the "run fn atomically now" contract the SqlDriver defines.
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
 * Create a durable OPFS-backed {@link SqliteEventStore} for the browser. Behaviour (table shape,
 * optimistic concurrency, exclusive reads, per-aggregate `UNIQUE(aggregate_id, version)`) is the shared
 * `event-store-core.ts` logic; this only supplies the SQLite-WASM/OPFS driver.
 * @param options  optional OPFS filename + VFS name (sensible defaults for a single-store device)
 * @returns        a promise of a ready-to-use OPFS-backed event store
 */
export async function createOpfsEventStore(
  options: OpfsEventStoreOptions = {},
): Promise<SqliteEventStore> {
  const driver = await createOpfsSqlDriver(
    options.filename ?? '/grimora-events.sqlite3',
    // Distinct from the read-model store's pool (see the `vfsName` doc) — same-named pools collide.
    options.vfsName ?? 'grimora-events-opfs',
  );
  return createEventStoreOverDriver(driver);
}
