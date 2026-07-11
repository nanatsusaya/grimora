/**
 * `SqlDriver` — a tiny engine-agnostic SQLite surface so the event-store's SQL logic can run on more
 * than one SQLite build (issue #105-B).
 *
 * Why this exists: `@grimora/event-store` targets two runtimes — native SQLite (`bun:sqlite`, for
 * desktop/Tauri + the Node/Bun test runtime) and **SQLite-WASM over OPFS** in the browser (ADR 0005 §1).
 * Both speak the same plain SQL and expose the same handful of operations, but their JavaScript APIs
 * differ. This interface captures **only** the operations the store needs, so the store logic
 * (`event-store-core.ts`) is written once against it and each runtime supplies a thin driver
 * (`bun:sqlite` in `index.ts`, SQLite-WASM SAHPool in `opfs.ts`). It deliberately contains **no** engine
 * import, so importing it pulls in neither `bun:sqlite` (Node-only) nor the WASM module (browser-only).
 *
 * Kept inside this package (not shared with `@grimora/cqrs-read`) because adapters must not import each
 * other (`adapters-no-cross-adapter`, ADR 0003 §2.3); the read-side has its own copy.
 */

/**
 * A value that can be bound to a `?` placeholder or read back from a column. SQLite's storage classes we
 * use reduce to these three: text/JSON columns are `string`, numeric columns are `number`, and absent
 * optional columns are `null`. Kept narrow so a non-serialisable value cannot silently reach the DB.
 */
export type SqlValue = string | number | null;

/**
 * A prepared statement, reusable across calls. The three shapes mirror the only ways the store runs a
 * statement: fetch one row, fetch all rows, or execute for effect. Rows come back as plain objects keyed
 * by column name (the caller casts to its known row type).
 */
export interface SqlStatement {
  /**
   * Run the statement with the given bind params and return the first row, or `undefined` if none.
   * @param params  positional bind values for the statement's `?` placeholders
   * @returns       the first matching row as a column-keyed object, or `undefined`
   */
  get(...params: SqlValue[]): Record<string, unknown> | undefined;
  /**
   * Run the statement with the given bind params and return every matching row.
   * @param params  positional bind values for the statement's `?` placeholders
   * @returns       all matching rows as column-keyed objects (empty when none match)
   */
  all(...params: SqlValue[]): Record<string, unknown>[];
  /**
   * Run the statement for effect (INSERT/UPDATE/DELETE), ignoring any result rows.
   * @param params  positional bind values for the statement's `?` placeholders
   */
  run(...params: SqlValue[]): void;
}

/**
 * The minimal SQLite handle the event store drives. Implemented once per runtime (native `bun:sqlite`,
 * browser SQLite-WASM/OPFS), so the store's SQL logic stays engine-neutral.
 */
export interface SqlDriver {
  /**
   * Execute one or more SQL statements for effect, without bind params — used for DDL (`CREATE TABLE`).
   * @param sql  the SQL to execute
   */
  exec(sql: string): void;
  /**
   * Prepare a reusable statement from SQL containing positional `?` placeholders.
   * @param sql  the parameterised SQL
   * @returns    a reusable {@link SqlStatement}
   */
  prepare(sql: string): SqlStatement;
  /**
   * Run `fn` **atomically now** (BEGIN … COMMIT, rolling back if `fn` throws). Unifies `bun:sqlite`'s
   * deferred transaction-factory and SQLite-WASM's execute-immediately transaction into one semantic:
   * "execute this function in a transaction, right now".
   * @param fn  the work to run inside the transaction; a throw rolls the whole unit back
   */
  transaction(fn: () => void): void;
  /**
   * Release the underlying database handle. After this the driver must not be used again.
   */
  close(): void;
}
