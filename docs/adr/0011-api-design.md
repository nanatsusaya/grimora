# ADR 0011 — API design & contracts

- **Status:** Proposed
- **Date:** 2026-07-07
- **Deciders:** project owner + AI agents
- **Depends on:** [ADR 0003](0003-overall-architecture.md) (§8 `apps/api` as the primary integration
  boundary, contract-first principle), [ADR 0004](0004-event-sourcing-cqrs.md) (events, `version`/
  `position`, read models), [ADR 0005](0005-persistence-and-sync.md) (§3 sync push/pull, §4 rebase, §5
  object storage), [ADR 0008](0008-ai-provider-abstraction.md) (§2 authz parity, §7 consent, §8 MCP),
  [ADR 0009](0009-cross-cutting-concerns.md) (error taxonomy, `AuthPort`/`AuthorizationPort`),
  [ADR 0010](0010-security-and-privacy-by-design.md) (rate limits, secrets, authz). Relates to ADR 0006
  (plugin contributions), ADR 0021 (rules payloads), ADR 0024 (realtime — out of scope here).

## Context

`apps/api` is Grimora's **long-lived public boundary** — consumed by the web/mobile/desktop frontends,
by external **plugins**, by the **AI/MCP** tool layer, and for multi-device **sync**. It outlives any
one frontend, so it must be **contract-first and versioned** (ADR 0003 §8 named this ADR as its owner).
Getting its shape wrong is expensive because plugins and AI tools quickly turn it into a stable public
contract.

A framing decision drives everything else: Grimora is **offline-first** (ADR 0005). The device runs the
same Application core locally and is the source of truth; the cloud is a sync target. So the API is
**not** the primary CRUD surface for user aggregates — writes append events **locally** and reach the
server through **sync**, not through direct REST CRUD. This ADR designs the API around that reality.

Repo state: only `packages/shared-types` has code; `apps/api` does not exist yet. This is a decision
record; Phase 2 builds against it. Per the agent guardrails, no API endpoints are implemented before
this ADR is `Accepted`.

## Decision

### 1. Role & shape of the API (offline-first framing)

The public API is an **inbound (driving) adapter** exposing Application use cases; every route maps to
**one use case**, exchanges **DTOs** (never domain objects), and leaks no domain internals (ADR 0003
§1/§8). Its surface is five concerns, **not** CRUD-over-aggregates:

1. **Sync** — batch event push/pull (the primary write path; §7).
2. **Online/shared operations** — campaign membership, sharing/invites, and anything that is inherently
   server-side rather than local.
3. **AI proxy + tool calls** — provider calls run server-side (keys never leave the server; §8).
4. **Auth/session** — via `AuthPort` (§9).
5. **Reads** — master/reference data (plugin catalog) and read-model projections as the shared/online/
   fallback path (the UI normally reads *local* projections; §6).

Writes to user aggregates (characters, campaigns, NPCs) are **intent-named** command operations (e.g.
`POST …/attribute-raises`), never generic field-setters — consistent with event sourcing (ADR 0004,
CLAUDE.md guardrail).

### 2. Protocol & contract format — REST + OpenAPI 3.1, contract-first

**REST over HTTP/JSON, with OpenAPI 3.1 as the single source of truth (SSOT)**; typed TypeScript
clients and server route types are **generated** from it. Rationale:

- **Language-agnostic & durable** — external plugins, future non-TS integrations, and a contract that
  outlives the frontend all need a spec-first, non-TS-coupled surface.
- **Contract-first** (ADR 0003 §8), and OpenAPI 3.1 is JSON-Schema-based, aligning with the JSON Schema
  already used for plugin definitions (ADR 0006) and tool descriptors (§8).
- Generated TS clients give our own apps near-tRPC DX **without** making the public contract TS-only.

Rejected: **tRPC** as the public contract (TypeScript-only, couples the contract to our client);
**GraphQL** (CQRS read models + offline-first mean little ad-hoc server querying — not worth the
complexity/caching cost); **gRPC** (browser friction). See Alternatives.

### 3. Versioning & compatibility

- **Major version in the URL path** (`/api/v1/…`). Additive, backward-compatible changes within a
  major; breaking changes → a new major with migration notes. The OpenAPI document is **semver**'d.
- **Public vs. internal**: the versioned `/v1` surface is the stable public/plugin/sync contract;
  purely internal endpoints (if any) live under an `/internal` namespace with **no** compatibility
  guarantee and are never part of the published spec.
- **Plugin-contributed** endpoints/tools are **namespaced by plugin id** and versioned by the plugin's
  own semver (ADR 0006 §4), composed into the core spec under their namespace (§11).

### 4. Error format

**RFC 9457 `application/problem+json`**, carrying ADR 0009's `AppError` shape — do **not** invent a
second scheme:

- `code` (stable, namespaced, e.g. `characters.not_found`, `dsa5.invalid_attribute`),
- `category` (ADR 0009 closed set), `title`, `detail`,
- `messageKey` (i18n key; translated text is resolved at the presentation layer, never server-side),
- `correlationId` (from ADR 0009 §2), and structured `errors[]` for field-level validation.

This ADR **fixes the category → HTTP status mapping** that ADR 0009 delegated here:

| Category | HTTP |
| --- | --- |
| `Validation` | 400 |
| `Unauthorized` | 401 |
| `Forbidden` | 403 |
| `NotFound` | 404 |
| `Conflict` | 409 |
| `RateLimited` | 429 (+ `Retry-After`) |
| `Infrastructure` | 500 |

### 5. Commands — idempotency & optimistic concurrency

- Command and sync-push requests accept an **`Idempotency-Key`** header; the server dedupes retries so
  offline replay never double-applies (matches ADR 0005 §4 "idempotency by `id`").
- Optimistic concurrency uses the per-aggregate **`version`** (ADR 0004). A stale write returns **409**
  (`Conflict`) with the current version, so the client **rebases** (ADR 0005 §4) rather than clobbering.

### 6. Reads & pagination

- Read endpoints serve **read-model projections** (CQRS, ADR 0004) — never the event store directly.
- **Cursor-based pagination** (opaque forward/backward cursors), **not** offset — stable under inserts
  and offline-friendly; plus standard `filter`/`sort` query conventions and `ETag`/conditional requests
  where useful.
- These are the shared/online/fallback read path; the UI normally reads local projections.

### 7. Sync endpoints (primary write path)

Concrete surface for ADR 0005 §3, behind `SyncPort`; RLS (ADR 0005 §7) bounds authorized streams:

- **`POST /api/v1/sync/push`** — a batch of event envelopes (ADR 0004). Returns a **per-event result**:
  accepted (+ canonical cloud `position`), duplicate `id` (idempotent no-op), or `version` conflict
  (→ client rebase). **Partial success** returns per-item results — not all-or-nothing.
- **`GET /api/v1/sync/pull?since={position}&streams=…`** — events with cloud `position` greater than
  the client checkpoint for authorized streams; returns the new checkpoint. Erasure/redaction events
  (ADR 0010 crypto-shredding) propagate through the **same** pull (ADR 0005 §7).
- **Batch-size / backpressure** limits are enforced (oversize → `413`/`RateLimited`); concrete numeric
  budgets are ADR 0013's.

### 8. AI & tool-call surface (ADR 0008 §8, MCP-ready)

- **AI proxy**: provider calls run **server-side** (provider keys stay at the composition root, ADR
  0010 §4), gated by the caller's authorization **and** consent (ADR 0008 §2/§7 — external providers
  only after consent; local Ollama otherwise).
- **Tool descriptors are the registry unit**, defined **once here** so the future **MCP server is just
  another inbound adapter** over the same registry (ADR 0008 §8) — plugins never expose their own
  network API (ADR 0006 §5): `{ name (namespaced `core.*` / `<pluginId>.*`), description, inputSchema
  (JSON Schema), outputSchema, → target use case }`. A tool call is validated against its schema and
  executed through the **same use case + authz/validation as the UI** — no special AI path.
- **Streaming**: AI responses stream via **SSE** (server-sent events) over HTTP; everything else is
  request/response. **Bidirectional realtime/presence transport is out of scope → ADR 0024.**

### 9. Auth in the contract

- **Bearer JWT** (Supabase access token) in `Authorization`, validated **only** at the inbound adapter
  (ADR 0009 §3); refresh via Supabase.
- Because the API is **token-in-header, not cookie-session, CSRF does not apply to it**. If the Next.js
  web app uses any cookie-based session at its own layer, it applies standard SameSite/CSRF there.
- **Authorization** is enforced in the Application layer (`AuthorizationPort`, ADR 0009/0010), never in
  the route handler; Postgres RLS is defense-in-depth (ADR 0005 §7), never the sole gate.

### 10. Uploads & binaries

Large binaries never proxy through the API. The API issues **signed upload/download URLs** to object
storage (`ObjectStoragePort`, ADR 0005 §5); assets are content-addressed; the API handles only asset
**metadata** and `assetId` references. Type/size allowlists and media safety (EXIF strip, scanning) are
the **asset-pipeline backlog** (Epic #52), triggered when uploads ship.

### 11. Plugin API/tool extension

Plugins extend the surface **only through the host**: (a) AI/tool descriptors (§8) and (b) optional
read/derived endpoints — all **namespaced by plugin id**, JSON-Schema-validated, and mapped to use
cases by the host. A plugin never opens its own network listener (ADR 0006 §5). The published OpenAPI
document composes plugin contributions under their namespace.

### 12. Framework (deferred to implementation)

The API framework is deliberately **left to implementation** (owner decision, R5) — it is a swappable
detail that must stay behind the boundary (ADR 0003 §1) and **Node-compatible** (ADR 0002, no bun-only
APIs). This ADR fixes the *contract* (§2–§11), not the library; OpenAPI-first, node-compatible
candidates (e.g. Hono, Fastify) are weighed when `apps/api` is actually built.

## Consequences

**Positive:** one **language-agnostic, contract-first** surface that outlives the frontend and serves
sync, AI/plugins and reads uniformly; error handling and authz **reuse** ADR 0009/0010 instead of
re-inventing; the tool-descriptor schema is defined once and is **MCP-ready**; the offline-first framing
avoids building a redundant CRUD API and matches the event-sourced/sync model; generated clients keep
our own DX high.

**Negative / costs:** maintaining an OpenAPI SSOT + codegen pipeline; SSE streaming plumbing; the API is
intentionally **thin** (sync + services + AI + reads), which can surprise contributors expecting REST
CRUD over aggregates — mitigated by this ADR and worked examples in the spec.

## Alternatives considered

- **tRPC as the public contract** — superb TS monorepo DX, but TypeScript-only and couples the durable
  public/plugin contract to our client. Rejected as the *public* surface; equivalent DX is recovered via
  generated TS clients over OpenAPI.
- **GraphQL** — flexible client-shaped queries, but with CQRS read models + offline-first there is little
  ad-hoc server querying to justify the schema/caching/N+1 complexity. Rejected (revisit only if a rich
  server-side query need emerges).
- **gRPC / gRPC-web** — strong contracts + streaming, but browser friction and heavier tooling for
  little gain over REST+SSE here. Rejected.
- **REST CRUD over aggregates** — the "obvious" REST design, but it contradicts offline-first (writes are
  local) and event sourcing (intent, not field-sets). Rejected in favor of the sync-centric shape.
- **Proxying binaries through the API** — simple but wasteful and slow; rejected for signed URLs direct
  to object storage.

## Resolved questions (owner decisions, 2026-07-07)

All five review questions were resolved by the owner; the decisions above reflect them.

- **R1 — Contract choice.** *Confirmed:* **REST + OpenAPI 3.1 as the single public contract**, with
  generated TS clients for our own apps and **no separate tRPC layer** (§2).
- **R2 — Offline-first framing.** *Confirmed:* the API is **sync + online services + AI proxy + reads**,
  **not** the primary CRUD path for user aggregates — writes are local and reach the server via sync
  (§1).
- **R3 — Versioning.** *Confirmed:* URL-path major versioning (`/api/v1`), additive within a major,
  `/internal` for unversioned internal endpoints (§3).
- **R4 — Streaming vs. realtime.** *Confirmed:* **SSE** for AI streaming now; **WebSocket/presence
  deferred to ADR 0024**. 0011 stays request/response + SSE only (§8).
- **R5 — Framework.** *Deferred to implementation:* the framework is **not** named in this ADR; it stays
  a swappable, Node-compatible detail behind the boundary, chosen when `apps/api` is built (§12).

## References

- [ADR 0003](0003-overall-architecture.md) (§8 integration boundary, contract-first),
  [ADR 0004](0004-event-sourcing-cqrs.md) (events, `version`/`position`, read models),
  [ADR 0005](0005-persistence-and-sync.md) (§3 push/pull, §4 rebase, §5 object storage, §7 RLS),
  [ADR 0008](0008-ai-provider-abstraction.md) (§2 authz parity, §7 consent, §8 MCP registry),
  [ADR 0009](0009-cross-cutting-concerns.md) (error taxonomy + category set, `AuthPort`/
  `AuthorizationPort`, correlation IDs), [ADR 0010](0010-security-and-privacy-by-design.md) (secrets,
  rate limits, authz), ADR 0006 (plugin contributions), ADR 0013 (sync/batch/perf budgets), ADR 0024
  (realtime/presence transport), [ADR 0002](0002-tech-stack-and-tooling.md) (Node-compatible runtime).
  Issue #13.
