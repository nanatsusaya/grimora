/**
 * Domain/application error shape for the skeleton — a minimal slice of the ADR 0009 §1 taxonomy
 * (namespaced code + closed category + i18n key). Expected failures cross boundaries as `Result`
 * errors (never thrown); this is the `E` in `Result<T, E>`.
 *
 * **Provisional v0** (ADR 0022 §3): the full per-bounded-context `AppError` hierarchy (ADR 0009 §1)
 * is not built here — the skeleton uses one flat shape.
 */

/** The closed error-category subset the skeleton uses (ADR 0009 §1). */
export type ErrorCategory = "Validation" | "NotFound" | "Conflict" | "Forbidden" | "Infrastructure";

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
