/**
 * `SqlDriver` — a tiny engine-agnostic SQLite surface so the read-model store's SQL logic runs on both
 * native SQLite (`bun:sqlite`) and SQLite-WASM over OPFS in the browser (issue #105-B).
 *
 * This is the read-side twin of `@grimora/event-store`'s driver. It is **duplicated** here on purpose:
 * adapters must not import each other (`adapters-no-cross-adapter`, ADR 0003 §2.3), and the interface is
 * a handful of lines — a shared low-level package is not worth inventing outside the ADR 0003 module map.
 * It contains **no** engine import, so pulling it in loads neither `bun:sqlite` nor the WASM module.
 */

/**
 * A value bound to a `?` placeholder or read back from a column: text/JSON → `string`, numeric → `number`,
 * absent optional → `null`. Narrow so a non-serialisable value cannot silently reach the DB.
 */
export type SqlValue = string | number | null;

/** A reusable prepared statement — fetch one row, fetch all rows, or execute for effect. */
export interface SqlStatement {
  /**
   * Run with the given bind params and return the first row, or `undefined` if none.
   * @param params  positional bind values for the statement's `?` placeholders
   * @returns       the first matching row as a column-keyed object, or `undefined`
   */
  get(...params: SqlValue[]): Record<string, unknown> | undefined;
  /**
   * Run with the given bind params and return every matching row.
   * @param params  positional bind values for the statement's `?` placeholders
   * @returns       all matching rows as column-keyed objects (empty when none match)
   */
  all(...params: SqlValue[]): Record<string, unknown>[];
  /**
   * Run for effect (INSERT/UPDATE/DELETE), ignoring result rows.
   * @param params  positional bind values for the statement's `?` placeholders
   */
  run(...params: SqlValue[]): void;
}

/** The minimal SQLite handle the read-model store drives — implemented once per runtime. */
export interface SqlDriver {
  /**
   * Execute SQL for effect without bind params — used for DDL (`CREATE TABLE`).
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
   * Run `fn` atomically now (BEGIN … COMMIT, rolling back if it throws).
   * @param fn  the work to run inside the transaction
   */
  transaction(fn: () => void): void;
  /** Release the underlying database handle. After this the driver must not be used again. */
  close(): void;
}
