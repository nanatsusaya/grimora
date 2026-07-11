# @grimora/api

The Grimora backend — a **modular-monolith** HTTP service and the long-lived public integration boundary
(ADR 0003 §8, ADR 0011). This directory currently holds a **minimal walking-skeleton scaffold** that
validates the framework and structure decisions of **ADR 0027** with running code.

> **Status: scaffold only.** The *real* backend — the Postgres sync `EventStorePort` (#107), the `AuthPort`
> adapter, deployment, and the full endpoint surface (sync / AI proxy / online services / full reads) — is
> **trigger-gated to Phase 3+ (cloud sync)** per ADR 0014 §3. There is nothing to deploy yet. This scaffold
> exists to prove the choices, not to serve real traffic.

## What ADR 0027 decided (and this scaffold demonstrates)

| Decision | Choice | Where you see it |
| --- | --- | --- |
| **Framework** (ADR 0011 R5) | **Hono** — runs on Bun/Node/edge, OpenAPI-first, thin | `src/app.ts` |
| **OpenAPI authoring** | **code-first** — typed Zod routes → generated OpenAPI 3.1 (the published SSOT) | `src/app.ts`, `GET /api/v1/openapi.json` |
| **Structure** | `apps/api` is a **composition root**; routes are thin inbound adapters (1 route → 1 use case/port), DTOs on the wire, `problem+json` errors | `src/composition/`, `src/http/`, `src/app.ts` |
| **Runtime** | **Bun** canonical, **node-compatible** (no bun-only APIs) | `src/server.ts` |

The full rationale, alternatives (Fastify/Elysia/NestJS) and the reused ADRs are in
[`docs/adr/0027-apps-api-framework-structure.md`](../../docs/adr/0027-apps-api-framework-structure.md).

## Structure

```
src/
  server.ts                     # entry: builds the composition + app, exports Bun's { port, fetch }
  app.ts                        # the Hono OpenAPI app: typed routes → generated spec
  composition/composition-root.ts  # the ONE place wiring core-domain + adapters + plugins (ADR 0003 §8)
  http/problem.ts               # AppError → RFC 9457 application/problem+json (ADR 0011 §4)
  app.test.ts                   # in-process walking-skeleton tests (Hono app.request)
```

The layering mirrors the hexagon (ADR 0003): the HTTP layer is an **inbound adapter**, it calls **ports**
wired at the composition root, and it never contains domain logic or emits domain objects. Authorization
(when real endpoints land) is enforced in the **Application layer** (`AuthorizationPort`), never in a route
handler; JWTs are **validated** at this inbound adapter (ADR 0009 §3, ADR 0011 §9) — `apps/api` does not
issue them (the client gets them from Supabase).

## Endpoints (scaffold)

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness. |
| `GET` | `/api/v1/rule-systems/{id}` | Read a rule system from the plugin catalog (master-data read, ADR 0011 §1.5/§6). `404` → `problem+json`. |
| `GET` | `/api/v1/openapi.json` | The generated OpenAPI 3.1 document (the published contract SSOT). |

## Run it

```bash
bun install                       # from the repo root
bun run --filter=@grimora/api dev # watch mode (or `start` for a one-shot run)
# → http://localhost:3001/health , /api/v1/rule-systems/dsa5 , /api/v1/openapi.json
bun run --filter=@grimora/api test
```

## Deferred to the real build (trigger-gated, ADR 0014 §3)

- The Postgres sync `EventStorePort` adapter + the `POST/GET /api/v1/sync/*` endpoints (#107, ADR 0011 §7).
- The `AuthPort` adapter (Supabase/GoTrue) + real authorization enforcement (#106, #120).
- Commit + CI drift-check of the generated `openapi.json` as the published SSOT (ADR 0027 §3).
- Config/secrets via `SecretsPort` (ADR 0010 §4); deployment as a Fly.io/Hetzner container (ADR 0014 §3).
