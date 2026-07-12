/**
 * Domain/application error shape for the skeleton — a minimal slice of the ADR 0009 §1 taxonomy
 * (namespaced code + closed category + i18n key). Expected failures cross boundaries as `Result`
 * errors (never thrown); this is the `E` in `Result<T, E>`.
 *
 * **Provisional v0** (ADR 0022 §3): the full per-bounded-context `AppError` hierarchy (ADR 0009 §1)
 * is not built here — the skeleton uses one flat shape.
 */

/**
 * The closed error-category subset the skeleton uses (ADR 0009 §1). `Unauthorized` (401 — missing/invalid
 * authentication, distinct from `Forbidden`/403 authorization) is drawn from the same ADR-owned set as its
 * first consumer, the `AuthPort` sign-in path (#120), appears — the subset grows toward the full taxonomy,
 * never beyond it.
 */
export type ErrorCategory =
  | 'Validation'
  | 'NotFound'
  | 'Conflict'
  | 'Unauthorized'
  | 'Forbidden'
  | 'Infrastructure';

/** A typed, expected failure carried in `Result`'s error channel. */
export interface AppError {
  /** Stable, namespaced code, e.g. "character.not_found". */
  readonly code: string;
  /** Closed category (drives HTTP mapping later, ADR 0011 §4). */
  readonly category: ErrorCategory;
  /** i18n message key; translated at the presentation layer, never here (ADR 0009 §1). */
  readonly messageKey: string;
}

/**
 * Construct an {@link AppError}.
 * @param code        stable namespaced code
 * @param category    closed error category
 * @param messageKey  i18n key (defaults to the code if omitted)
 */
export function appError(
  code: string,
  category: ErrorCategory,
  messageKey: string = code,
): AppError {
  return { code, category, messageKey };
}

/** The stable `code` carried by {@link EventIdMismatchError}, so callers/tests match it without an `instanceof`. */
export const EVENT_ID_MISMATCH_CODE = 'store.event_id_mismatch';

/**
 * Thrown when an event whose `id` is already stored is appended with **different content** (issue #151) —
 * a genuine data-integrity violation, never a normal outcome. Per ADR 0009 §1 such corruption is
 * **thrown**, not returned as a `Result` error (which is reserved for *expected* failures like the
 * optimistic-concurrency `Conflict`): the event log's core invariant is that an `id` immutably identifies
 * one event, so the same id with a different body means a bug or tampering upstream, not a rebase. It is
 * distinct from re-delivering the *identical* event, which is an idempotent no-op success (ADR 0005 §3).
 * Carries a stable {@link EVENT_ID_MISMATCH_CODE} so every store adapter signals it identically and the
 * shared `eventStoreContract` can assert it across engines without depending on the class itself.
 */
export class EventIdMismatchError extends Error {
  /** Stable discriminator ({@link EVENT_ID_MISMATCH_CODE}) so callers match without cross-package `instanceof`. */
  readonly code = EVENT_ID_MISMATCH_CODE;
  /**
   * @param id  the event id whose re-append carried a different body (included for diagnostics — an id is
   *            an opaque UUID, not personal data, so it is safe to name in the message)
   */
  constructor(id: string) {
    super(`event id ${id} already stored with different content (append is not idempotent for it)`);
    this.name = 'EventIdMismatchError';
  }
}
