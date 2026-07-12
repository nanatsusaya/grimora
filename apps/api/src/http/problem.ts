/**
 * Maps a domain {@link AppError} to an RFC 9457 `application/problem+json` document — the single error
 * boundary for `apps/api` (ADR 0011 §4). Handlers never invent error shapes; they translate the
 * `Result` error channel from the Application layer through here, so the HTTP surface reuses ADR 0009's
 * error taxonomy instead of a second scheme.
 *
 * The scaffold uses the skeleton's 5-category subset (ADR 0009 §1); the full category set + fields
 * (`correlationId`, field-level `errors[]`) arrive with the real backend build (trigger-gated, ADR 0014 §3).
 */

import type { AppError, ErrorCategory } from '@grimora/core-domain';

/**
 * ADR 0011 §4 category → HTTP status. Fixed here so every error maps deterministically; an unmapped
 * category can only mean a programming error, so it falls through to 500 at the call site.
 */
const CATEGORY_STATUS: Readonly<Record<ErrorCategory, number>> = {
  Validation: 400,
  Unauthorized: 401,
  Forbidden: 403,
  NotFound: 404,
  Conflict: 409,
  Infrastructure: 500,
};

/** An RFC 9457 problem document, carrying ADR 0009's `AppError` fields (ADR 0011 §4). */
export interface ProblemDocument {
  /** why: RFC 9457 `type` — a stable URI reference; the code namespace is enough for the scaffold */
  readonly type: string;
  /** why: RFC 9457 `title` — a short, human-readable summary (the stable code here) */
  readonly title: string;
  /** why: RFC 9457 `status` — mirrors the HTTP status, so the body is self-describing */
  readonly status: number;
  /** why: ADR 0009 stable, namespaced error code (e.g. `rule_system.not_found`) */
  readonly code: string;
  /** why: ADR 0009 closed error category, carried through for clients that branch on it */
  readonly category: ErrorCategory;
  /** why: i18n key — translated text is resolved at the presentation layer, never server-side (ADR 0011 §4) */
  readonly messageKey: string;
}

/**
 * Translate an {@link AppError} into an HTTP status + problem document.
 * @param error  the Application-layer error to surface
 * @returns      the HTTP `status` and the `application/problem+json` `body`
 */
export function toProblem(error: AppError): {
  readonly status: number;
  readonly body: ProblemDocument;
} {
  const status = CATEGORY_STATUS[error.category] ?? 500;
  return {
    status,
    body: {
      type: `about:blank#${error.code}`,
      title: error.code,
      status,
      code: error.code,
      category: error.category,
      messageKey: error.messageKey,
    },
  };
}
