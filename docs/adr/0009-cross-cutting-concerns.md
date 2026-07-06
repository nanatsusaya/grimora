# ADR 0009 — Cross-cutting: error handling, logging/observability, auth & security boundaries

- **Status:** Proposed
- **Date:** 2026-07-06
- **Deciders:** project owner + AI agents
- **Depends on:** [ADR 0003](0003-overall-architecture.md) (ports, §5 error convention, §6 security
  principle, §7 ports catalog), [ADR 0004](0004-event-sourcing-cqrs.md) (events as the log),
  [ADR 0006](0006-plugin-system.md) (plugin least-privilege), [ADR 0008](0008-ai-provider-abstraction.md)
  (AI authorization parity)

## Context

Advanced error handling and logging are required in both frontend and backend, plus secure login and
user management (vision.md), under EU/German compliance (DSGVO/BDSG, DDG/TTDSG, EU AI Act, CRA, BFSG).
ADR 0003 already named the shape of the solution (a `Result` type for cross-boundary errors, a
`LoggerPort`/`AuthPort`/`AuthorizationPort` in the ports catalog, "adapters are the trust boundary")
but deferred the concrete design to this ADR.

Repo state at the time of writing: only `packages/shared-types` exists, with a bare
`Result<T, E> = { ok: true, value: T } | { ok: false, error: E }` (no error taxonomy yet). There is no
`core-domain` package, no port interfaces, no logging code, and no auth/session code anywhere. This
ADR designs against that blank slate; it is a decision record, not an implementation — Phase 2 (core
code) builds against it.

`docs/hosting.md` already names **pino** + **Sentry** for logging/observability and **Supabase**
(Postgres + Auth + RLS + Storage, EU region) as the backend platform. It also states the app must be
**Docker-based and self-hostable**, which surfaces a gap this ADR must close: the local
`docker-compose.yml` today has no Auth substitute (only Postgres + MinIO + optional Ollama).

## Decision

### 1. Error model

- **`Result<T, E>` (from `shared-types`, already decided in ADR 0003 §5) stays the mechanism for
  expected/recoverable failures** crossing Application/Port boundaries. This ADR does not replace it,
  it gives `E` a defined shape.
- **`AppError` base class + per-bounded-context subclasses.** Each bounded context (Characters,
  Bestiary, Campaigns, Rules, Identity — ADR 0003 §9) defines its own `AppError` subclasses. Every
  error instance carries:
  - a **stable, namespaced error code** (e.g. `characters.not_found`, `dsa5.invalid_attribute` for
    plugin-surfaced errors — namespaced by plugin id per ADR 0006 §9 isolation rules),
  - an **i18n message key** (never a hardcoded user-facing string in the domain — actual translated
    text is resolved at the presentation adapter, keeping i18n a presentation concern per ADR 0016),
  - a **category** (below), used for both `Result`-based domain logic and the API adapter's response
    shape.
- **Error categories** (closed set for now, extend only by amendment/superseding ADR):
  | Category | Meaning | Typical HTTP mapping (detail: ADR 0011) |
  | --- | --- | --- |
  | `Validation` | Malformed/invalid input | 400 |
  | `NotFound` | Referenced entity doesn't exist | 404 |
  | `Conflict` | State/business-rule conflict (e.g. optimistic concurrency) | 409 |
  | `Unauthorized` / `Forbidden` | Missing/insufficient authentication or authorization | 401 / 403 |
  | `Infrastructure` | Unexpected adapter/dependency failure | 500 |

  The category set is owned here; the exact HTTP status mapping table is ADR 0011's to fix (API
  contract format), so the two ADRs don't duplicate ownership.
- **Unexpected (programmer) errors still throw**, are never modeled as `Result` errors, and are only
  caught at the **composition root** (reaffirms ADR 0003 §5) — logged as `Infrastructure` via the
  `LoggerPort` (§2) and turned into a generic, non-leaking response at the adapter boundary.
- **Plugins surface errors through the same `AppError` taxonomy**, namespaced by plugin id — never a
  raw exception crossing the SDK boundary uncaught, consistent with ADR 0006's "pure functions, no
  ambient authority, capability-scoped context" contract.

### 2. Structured logging & observability

- **`LoggerPort`** (declared in `core-domain/application/ports`, per ADR 0003 §7): a narrow structured
  logging interface (`debug/info/warn/error` + structured fields), no adapter-specific API leaking
  into Domain/Application.
- **Adapters**: **pino** on the backend (structured JSON logs), and a thin frontend logger adapter
  that forwards errors/exceptions and performance data to **Sentry**. Both sit behind `LoggerPort` so
  Domain/Application code never imports pino or the Sentry SDK directly (ADR 0003 §1 dependency
  rule). This formalizes the tool choice already named in `docs/hosting.md`, it does not pick new
  tools.
- **PII/DSGVO-safe logging**: an explicit **redaction policy** enforced at the adapter (deny-list:
  emails, auth tokens/secrets, freeform user-authored content) — not left to per-call-site
  convention. Domain events (ADR 0004) are the durable record of *what happened*; operational logs are
  for *diagnosing how*, and must not become a shadow copy of personal data.
- **Correlation/request IDs**: generated at the inbound adapter (`apps/api`), propagated through
  Application → Domain (as plain context, not ambient/global state) → emitted events' metadata, so a
  single request/session is traceable across logs without needing to log PII.
- **Roles of the two tools**: pino = structured operational logs (both success and failure paths,
  sampled/leveled); Sentry = exception/crash tracking + performance monitoring, primarily triggered by
  `Infrastructure`-category errors and unhandled exceptions caught at the composition root.
- **Forward-looking note (not decided here):** the namespaced error codes, categories and Sentry
  fingerprinting above are deliberately structured enough to later drive an **automated
  error-ticketing pipeline** (an AI agent files/dedupes a GitHub issue per new error fingerprint;
  another AI agent picks it up and opens a fix PR for owner review) and an analogous flow for
  user-submitted support tickets. That pipeline's design — dedup/threshold policy, the distinct trust
  boundary of repo-writing agents vs. the ADR 0008 in-app AI (§2 there), and prompt-injection handling
  for untrusted strings reaching an LLM twice — belongs in **ADR 0014** (DevOps) and **ADR 0010**
  (threat model), not here; this ADR only ensures the error data those future agents would consume is
  already well-formed.

### 3. Auth & security boundaries

- **`AuthPort`** (authentication: login, session, token issuance/validation) — **one port, two
  adapters**:
  - **Supabase Cloud** (hosted deployments, EU region — ADR 0002/hosting.md), and
  - the **official self-hosted Supabase stack** (GoTrue + supporting services) for local/self-hosted
    Docker deployments — closing the self-hostability gap without introducing a second, divergent
    auth technology. Wiring the self-hosted Supabase containers into `docker-compose.yml` is a
    **follow-up implementation item** (Phase 2 / a dedicated infra ticket), not part of this ADR.
  - Session/token handling follows Supabase's default: JWT access token + refresh token. Token
    validation happens **at the inbound adapter** (`apps/api`); nothing deeper in the stack re-parses
    or re-validates raw tokens.
- **`AuthorizationPort` / `PolicyPort`** — kept **separate from `AuthPort`** (authentication answers
  *who*; authorization answers *what they may do*; ADR 0003 §7 lists them as distinct ports).
  Enforced in the **Application layer**, as an explicit policy check per use case — never scattered
  across adapters or left implicit.
  - **Minimum role set: Owner, GM, Player** (extensible by later amendment/ADR as new needs surface —
    e.g. a read-only "Spectator" role is plausible but not decided here).
  - **Resource-level checks layer on top of roles** (e.g. "is this user the GM *of this specific
    campaign*"), not just global role membership.
  - This is the **concrete port/layer home** for the authorization principle already stated at
    ADR 0003 §6 and relied upon by ADR 0008 §2 ("AI tool calls use the same authorization as the UI") —
    those ADRs named the principle; this ADR fixes where it lives in code.
- **RLS strategy**: Postgres **Row-Level Security** on read-model/master-data tables is
  **defense-in-depth**, applied *in addition to*, never *instead of*, `AuthorizationPort` checks in
  the Application layer. The Application layer is the **authoritative** gate (it can express
  cross-aggregate and business-rule-aware policy that RLS cannot); RLS exists to contain the blast
  radius if something ever reaches the database directly, bypassing the application.
- **CRA-relevant hardening baseline** (principle-level only — the full threat model is **ADR 0010**,
  not duplicated here): input validation at adapters (ADR 0003 §6.2), dependency + secret scanning in
  CI (already required, ADR 0003 §6.7), no ambient authority in the core (ADR 0003 §6.1), secrets only
  at the composition root (ADR 0003 §6.4).

### 4. Adapter-side discipline (how this stays out of the domain core)

- `LoggerPort`, `AuthPort`, `AuthorizationPort`/`PolicyPort` are declared as interfaces in
  `core-domain/application/ports` — Domain and Application depend only on the interface, never on
  pino, Sentry, or the Supabase SDK (ADR 0003 §1–2 dependency rule; enforced by the conformance
  harness, issue #9).
- **Domain aggregates never log.** What happened is recorded as **domain events** (ADR 0004); calling
  `LoggerPort` from inside a Domain aggregate would duplicate that record and is disallowed by
  convention and by the harness's boundary-leak check (ADR 0003 §9 enforcement hint, extended to this
  ADR's ports).
- Error classes (`AppError` and subclasses) live in each bounded context's Domain/Application layer
  (or `shared-types` for the small common base), not in an adapter — they are part of the ubiquitous
  language of the context, not a logging/HTTP concern.

## Consequences

**Positive:** a defined, closed error-category set with per-context error classes gives every future
use case (and every plugin) a consistent, typed way to fail without inventing ad-hoc shapes; PII-safe
structured logging is enforced at the adapter instead of relying on developer discipline; auth and
authorization are cleanly separated ports with a concrete home in the Application layer; the
self-hosted Supabase decision closes the self-hostability gap without a second auth technology to
maintain; RLS + Application-layer authorization gives defense-in-depth without ambiguity about which
is authoritative.

**Negative / costs:** a full error-class hierarchy per bounded context is more upfront design than the
bare `Result` type alone — mitigated by keeping the category set small and closed for now (extend only
via amendment/superseding ADR). Running/maintaining the self-hosted Supabase stack for local dev adds
operational complexity beyond the current Postgres+MinIO+Ollama compose file — deferred to a follow-up
infra ticket rather than blocking this ADR. Two Supabase deployment modes (cloud vs self-hosted) must
be kept in sync as Supabase evolves.

## Alternatives considered

- **Bare `Result<T, E>` with `E = Error`, no taxonomy** — simplest, but leaves every use case to invent
  its own error shape, and gives the API adapter nothing consistent to map to HTTP status; rejected as
  under-specified for a multi-context, plugin-extensible system.
- **Exceptions only, no `Result` type** — contradicts ADR 0003 §5 (already decided); would also make
  expected failures (validation, not-found) indistinguishable from programmer errors at the type
  level. Rejected.
- **A second, non-Supabase auth adapter for self-hosting** (e.g. a custom JWT service or Ory/Lucia) —
  avoids any Supabase dependency for local/self-hosted runs, but doubles the auth surface to build and
  maintain and diverges from ADR 0002's chosen backend platform. Rejected in favor of the official
  self-hosted Supabase stack (same technology, two deployment modes).
- **RLS as the sole authorization mechanism** (no `AuthorizationPort` in the Application layer) —
  simpler, but RLS policies can't easily express cross-aggregate or business-rule-aware authorization,
  and would leak authorization logic into SQL instead of the Application layer where ADR 0003 places
  it. Rejected; kept as defense-in-depth instead.

## References

- [ADR 0003](0003-overall-architecture.md) (ports, §5 error convention, §6 security principle, §7
  ports catalog, §9 DDD/enforcement), [ADR 0004](0004-event-sourcing-cqrs.md) (events as the log),
  [ADR 0006](0006-plugin-system.md) (plugin error/permission model), [ADR 0008](0008-ai-provider-abstraction.md)
  (authorization parity for AI tool calls), ADR 0010 (detailed threat model, plugin sandbox,
  prompt-injection for agent-driven ticket/PR automation), ADR 0011 (API contract format, HTTP status
  mapping), ADR 0014 (DevOps — future automated error/support-ticketing pipeline), ADR 0015
  (DSGVO/consent detail), ADR 0016 (i18n), `docs/hosting.md` (pino/Sentry/Supabase tool choice).
  Issue #8.
