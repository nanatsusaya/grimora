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

**Scope discipline — decision-only, no code now.** Because ADR 0014 §3 keeps the `apps/api` build trigger-gated
to Phase 3+, this ADR writes **no `apps/api` code and scaffolds no package**. It is a *decision record ahead of
build*: it fixes the framework + structure + local-runtime choices so that when the cloud-sync trigger fires
(#107), the build is unblocked and consistent, and the deferred concern is not lost. The project's local
infrastructure already exists for that eventual build — `docker-compose.yml` runs Postgres 16 + GoTrue
(auth) + MinIO — so no infra decision is pending. Repo state: `apps/api` does not exist; `apps/skeleton-walk`
and `apps/web` are the existing composition-root patterns this one will follow.

## Decision

### 1. What this ADR does and does not decide

It decides **framework** (§2), **OpenAPI authoring workflow** (§3), **internal structure as a composition
root** (§4), and **local dev runtime** (§5). It **reuses, and does not re-decide**: the boundary/monolith style
(ADR 0003 §8), the wire contract (ADR 0011), the deploy target + Phase-3+ trigger gate (ADR 0014 §3), auth
mechanics (ADR 0009 §3), RLS (ADR 0005 §7/0009 §3), and secrets handling (ADR 0010 §4). No `apps/api` code is
produced by this ADR (ADR 0014 §3 gate).

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
  unblocked and the deferred concern is recorded rather than rediscovered. Recorded here; O3 confirms the
  decision-only, no-scaffold scope.

## Open questions (for owner review)

- **O1 — Framework.** Adopt **Hono** (recommended, §2: runtime-portable + OpenAPI-first + thin), or **Fastify**
  (more mature, node-first)? *Recommendation: Hono.*
- **O2 — OpenAPI authoring.** **Code-first** with the spec generated + CI-checked (recommended, §3), or
  **spec-first** (hand-written OpenAPI as SSOT, types generated)? *Recommendation: code-first.*
- **O3 — Scope confirmation.** Confirm this ADR is **decision-only now** — **no `apps/api` scaffold/package is
  created**, and the build stays trigger-gated to Phase 3+ (ADR 0014 §3)? Or should a **minimal `apps/api`
  scaffold** (health endpoint + wiring) be stood up now as a walking-skeleton-style validation of the choice?
  *Recommendation: decision-only now; scaffold when the cloud-sync trigger (#107) fires.*
- **O4 — Canonical runtime.** **Bun** as the canonical dev + prod runtime, with node-compatibility enforced in
  code (recommended, §5), or **Node** canonical with Bun only for local dev? *Recommendation: Bun canonical,
  node-compatible.*

## References

- [ADR 0003](0003-overall-architecture.md) §8 (modular monolith, integration boundary, composition root),
  [ADR 0011](0011-api-design.md) (§1/§4/§7/§8/§9/§11, §12+R5 framework deferred),
  [ADR 0014](0014-devops-and-delivery.md) §3 (deploy target + Phase-3+ trigger gate),
  [ADR 0009](0009-cross-cutting-concerns.md) §3 (auth/authz mechanics),
  [ADR 0002](0002-tech-stack-and-tooling.md) (bun/Supabase, node-compatible),
  [ADR 0010](0010-security-and-privacy-by-design.md) §4 (secrets at the composition root),
  [ADR 0005](0005-persistence-and-sync.md) §3/§7 (sync target, RLS). Issues #137 (this ADR), #107 (sync), #120
  (#105-E auth).
