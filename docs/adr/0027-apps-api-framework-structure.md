# ADR 0027 — apps/api backend: framework, structure & local runtime

- **Status:** Proposed
- **Date:** 2026-07-11
- **Deciders:** project owner + AI agents
- **Depends on:** [ADR 0003](0003-overall-architecture.md) (§8 modular-monolith `apps/api` as the primary
  integration boundary + composition root; §1/§2 dependency rule), [ADR 0011](0011-api-design.md) (the full
  REST/OpenAPI 3.1 contract — §1 route↔use-case, §4 `problem+json`, §7 sync, §8 AI/tools, §9 auth-in-contract,
  §11 plugin composition, **§12/R5 framework deferred to "when `apps/api` is built"**),
  [ADR 0014](0014-devops-and-delivery.md) (§3 `apps/api` build/deploy **trigger-gated to Phase 3+**, Fly.io/
  Hetzner container, bun-native + node-compatible), [ADR 0009](0009-cross-cutting-concerns.md) (§3 `AuthPort`
  Supabase Cloud/self-hosted GoTrue, JWT validated at the inbound adapter; `AuthorizationPort` in the
  Application layer), [ADR 0002](0002-tech-stack-and-tooling.md) (bun + Supabase; node-compatible runtime),
  [ADR 0010](0010-security-and-privacy-by-design.md) (§4 secrets only at the composition root). Relates to
  [ADR 0005](0005-persistence-and-sync.md) (§7 RLS defense-in-depth; §3 the Postgres sync target `apps/api`
  serves), issues #107 (sync adapter), #120 (#105-E auth binding).

## Context

The backend **boundary** is already decided and must **not** be re-opened here: ADR 0003 §8 fixes `apps/api`
as a **modular monolith** and *the* primary integration boundary; ADR 0011 fixes its **REST/OpenAPI 3.1
contract** (sync push/pull, AI proxy, online services, reads, auth-in-header); ADR 0014 §3 fixes its
**deployment** (a container on Fly.io/Hetzner, bun-native but node-compatible) and **trigger-gates the whole
`apps/api` build/deploy to Phase 3+ (cloud sync)** — *"there is no server to deploy until then."* Auth
mechanics are ADR 0009 §3 (Supabase/GoTrue JWT, validated at the inbound adapter); secrets are ADR 0010 §4
(composition root only).

Two things were deliberately **left open** by those ADRs: ADR 0011 **R5 deferred the framework** ("chosen when
`apps/api` is actually built"), and no ADR yet fixes the **internal structure** of `apps/api` as a composition
root or its **local dev runtime**. This ADR closes those, and only those.

**Scope — a minimal scaffold now, the full build stays trigger-gated.** ADR 0014 §3 keeps the *full* `apps/api`
build/deploy trigger-gated to Phase 3+ (cloud sync). Per the owner's decision (R3), this ADR is validated by a
**minimal walking-skeleton scaffold built now**: a runnable `apps/api` (Hono + the OpenAPI-generation pipeline +
composition-root wiring + a health/example endpoint) that proves the framework and structure choices with
*running code*, addressing the "unvalidated paper decision" risk in the spirit of ADR 0022. What stays
**deferred to the Phase-3+ trigger** is the *real* backend: the Postgres sync `EventStorePort` adapter (#107),
the `AuthPort` adapter, deployment, and the full endpoint surface. The project's local infrastructure already
exists for that eventual build — `docker-compose.yml` runs Postgres 16 + GoTrue (auth) + MinIO. Repo state:
`apps/skeleton-walk` and `apps/web` are the existing composition-root patterns this one follows.

## Decision

### 1. What this ADR does and does not decide

It decides **framework** (§2), **OpenAPI authoring workflow** (§3), **internal structure as a composition
root** (§4), and **local dev runtime** (§5). It **reuses, and does not re-decide**: the boundary/monolith style
(ADR 0003 §8), the wire contract (ADR 0011), the deploy target + Phase-3+ trigger gate (ADR 0014 §3), auth
mechanics (ADR 0009 §3), RLS (ADR 0005 §7/0009 §3), and secrets handling (ADR 0010 §4). A **minimal scaffold**
is built now to validate these choices with running code (R3); the *full* build — the Postgres sync adapter
(#107), the auth adapter, and deployment — stays **trigger-gated to Phase 3+** (ADR 0014 §3).

### 2. Framework — Hono (OpenAPI-first, runtime-portable)

`apps/api` uses **[Hono](https://hono.dev)** as its HTTP framework. Rationale, tied to constraints already
fixed elsewhere:

- **Runtime-portable** — Hono runs unchanged on **Bun, Node, and edge/Workers runtimes**. This satisfies ADR
  0014 §3's *bun-native but node-compatible* container requirement with no runtime-specific code, and keeps
  open ADR 0003 §8's option to *"host individual adapters (e.g. an AI proxy) on serverless/edge functions
  without changing the style."*
- **OpenAPI-first** — `@hono/zod-openapi` defines routes from Zod schemas and **emits the OpenAPI 3.1
  document**, which is exactly the SSOT + generated-clients model ADR 0011 §2 requires.
- **Thin** — a small, middleware-based core matches an intentionally thin API (sync + services + AI + reads,
  ADR 0011 §1); it does not impose a heavyweight DI/module framework over our own hexagon.

Rejected: **Fastify** (mature and JSON-Schema-native, but node-first — weaker on the bun/edge uniformity ADR
0003 §8/0014 want — and heavier; a close second, see Alternatives); **Elysia** (bun-only — violates ADR 0014
§3's node-compatibility hard requirement); **NestJS** (a heavy DI framework, over-engineered for a thin API and
duplicating the hexagon we already own). Framework choice is an owner question (**O1**).

### 3. OpenAPI authoring — code-first, spec generated as the published SSOT

Routes are authored **code-first** with typed (Zod) request/response schemas; the **OpenAPI 3.1 document is
generated** from them and **committed + validated in CI** as the published artifact. This reconciles with ADR
0011 §2 ("OpenAPI 3.1 as the single source of truth, typed clients generated from it"): the *published spec*
remains the external/plugin/sync contract SSOT, and the CI check that the emitted spec matches the committed
one makes it authoritative — while internally the typed routes are the single place a route and its schema are
written (no hand-maintained YAML drifting from the handlers). Typed clients for our own apps and external
consumers are generated **from the emitted spec** (ADR 0011 §2). Authoring direction is an owner question
(**O2**).

### 4. Internal structure — `apps/api` as a composition root

`apps/api` is a **composition root** (ADR 0003 §8), the one place allowed to import `core-domain` + concrete
adapters + plugins together (ADR 0003 §2), mirroring `apps/skeleton-walk` / `apps/web`. Its internal layering:

- **HTTP/route layer = thin inbound adapters.** Each route maps to **exactly one Application use case** (ADR
  0011 §1), exchanges **DTOs** (never domain objects), validates input against its schema, and leaks no domain
  internals (ADR 0003 §1). No business logic in handlers.
- **Composition/wiring.** Assembles the ports the use cases need from concrete adapters — the Postgres
  `EventStorePort` the sync endpoints serve (built in #107; `apps/api` only *hosts* it here), the plugin host,
  `ClockPort`/`IdGeneratorPort`, and `AuthPort` (Supabase/GoTrue **token validation** at the inbound adapter,
  ADR 0009 §3 — `apps/api` validates JWTs, it does not issue them; the client obtains them from Supabase per
  ADR 0011 §9).
- **Authorization in the Application layer.** `AuthorizationPort`/`PolicyPort` is enforced per use case in the
  Application layer, **never in the route handler** (ADR 0009 §3, ADR 0011 §9); Postgres RLS is
  defense-in-depth only (ADR 0005 §7). The AI tool path runs the **same** use case + authz (ADR 0008 §2 /
  0011 §8).
- **Error mapping.** A single boundary mapper turns `AppError` (ADR 0009) into RFC 9457 `application/
  problem+json` using ADR 0011 §4's category→HTTP table; handlers never invent error shapes.
- **OpenAPI assembly.** The published document composes core routes + plugin-namespaced contributions through
  the host (ADR 0011 §11); plugins never open their own network listener (ADR 0006 §5).

### 5. Local development runtime

`apps/api` runs on **Bun** locally (matching the monorepo toolchain) against the **existing `docker-compose`
stack** (Postgres 16 + GoTrue + MinIO — already wired). Configuration and secrets are injected **only at the
composition root** via `SecretsPort` (ADR 0010 §4) from the environment (`.env`, git-ignored) — never in code,
logs, or the domain. A `bun run dev` script starts it with a health endpoint; it is added to the workspace as a
composition-root app (the `arch` harness already exempts `apps/*` from the `src/index.ts` entry rule and
permits composition-root imports, so no new conformance rule is required). All code stays **node-compatible**
(no bun-only APIs) so the same source runs in the ADR 0014 §3 container. Bun-as-canonical-runtime is an owner
question (**O4**).

## Consequences

**Positive:** the framework + structure decisions are made **once, coherently**, so when the Phase-3+ cloud-sync
trigger fires the build starts from a settled plan rather than an ad-hoc choice under delivery pressure; Hono's
runtime portability keeps ADR 0003 §8's edge-adapter option open and satisfies ADR 0014 §3's bun/node
requirement with one codebase; OpenAPI-first authoring gives our apps near-tRPC DX while still publishing the
language-agnostic contract ADR 0011 mandates; `apps/api` as a composition root reuses the exact pattern already
proven by `apps/skeleton-walk`/`apps/web` and the existing `arch` rules; local infra already exists
(docker-compose), so there is nothing to provision to start when triggered.

**Negative / costs:** this is a decision **made ahead of the build** (ADR 0014 §3 gate), so the framework choice
should be **revalidated** when `apps/api` is actually built — a young-ish framework (Hono) or an ecosystem shift
could change the call, and no running code validates it today (unlike the walking-skeleton discipline of ADR
0022); code-first OpenAPI needs a spec-emission + CI drift-check step to keep the published contract
authoritative; choosing Hono over the more battle-tested Fastify trades some maturity for portability.

## Alternatives considered

- **Fastify** — mature, fast, JSON-Schema-native with a strong plugin ecosystem; the closest alternative.
  Rejected as the default because it is **node-first** (weaker on the Bun/edge uniformity ADR 0003 §8/0014
  favour) and heavier than needed for a thin API; revisit at build time if Hono's maturity is a concern (O1).
- **Elysia** — excellent Bun-native DX and performance, but **Bun-only**, which violates ADR 0014 §3's
  node-compatibility hard requirement. Rejected.
- **NestJS** — batteries-included structure, but a heavy DI/module framework that **duplicates the hexagon we
  already own** (ADR 0003) and is over-engineered for sync + services + AI + reads. Rejected.
- **Spec-first OpenAPI** (hand-write the YAML, generate server types + clients) — maximally contract-first, but
  double-maintenance (spec and handlers drift) and worse DX than generating the spec from typed routes;
  rejected as the default, kept as the O2 alternative.
- **Deferring this ADR entirely to build time** (ADR 0011 R5's literal wording) — legitimate under the project's
  trigger-gating discipline, but the owner chose to fix the framework/structure now so the eventual build is
  unblocked and the deferred concern is recorded rather than rediscovered.
- **Decision-only, no scaffold** (the recommended option under O3) — purest trigger-gating, but leaves the
  framework/structure choice unvalidated by running code. Rejected by the owner (R3) in favour of a minimal
  walking-skeleton scaffold now, precisely to validate the choice (ADR 0022 spirit).

## Resolved questions (owner decisions, 2026-07-11)

All four review questions were answered by the owner; the Decision sections above reflect them.

- **R1 — Framework.** **Hono** (§2) — runtime-portable (Bun/Node/edge), OpenAPI-first, thin. The considered
  alternatives (Fastify as the mature node-first fallback; Elysia rejected for being bun-only; NestJS rejected
  as over-engineered) are kept in *Alternatives* so the choice **and** the option space stay documented (owner
  ask: document both).
- **R2 — OpenAPI authoring.** **Code-first** (§3): routes authored with typed Zod schemas; the OpenAPI 3.1
  document is generated, committed, and CI-checked as the published SSOT.
- **R3 — Scope.** **A minimal scaffold is built now** (Option B): a runnable, well-documented `apps/api`
  walking-skeleton (Hono app + OpenAPI generation + composition-root wiring + health/example endpoint) validates
  the framework/structure choices with running code. The *full* backend — the Postgres sync `EventStorePort`
  (#107), the auth adapter, deployment, and the full endpoint surface — stays **trigger-gated to Phase 3+**
  (ADR 0014 §3).
- **R4 — Canonical runtime.** **Bun** as the canonical dev + prod runtime, with **node-compatibility enforced**
  in code (no bun-only APIs), so the same source runs in the ADR 0014 §3 container (§5).

## References

- [ADR 0003](0003-overall-architecture.md) §8 (modular monolith, integration boundary, composition root),
  [ADR 0011](0011-api-design.md) (§1/§4/§7/§8/§9/§11, §12+R5 framework deferred),
  [ADR 0014](0014-devops-and-delivery.md) §3 (deploy target + Phase-3+ trigger gate),
  [ADR 0009](0009-cross-cutting-concerns.md) §3 (auth/authz mechanics),
  [ADR 0002](0002-tech-stack-and-tooling.md) (bun/Supabase, node-compatible),
  [ADR 0010](0010-security-and-privacy-by-design.md) §4 (secrets at the composition root),
  [ADR 0005](0005-persistence-and-sync.md) §3/§7 (sync target, RLS). Issues #137 (this ADR), #107 (sync), #120
  (#105-E auth).
