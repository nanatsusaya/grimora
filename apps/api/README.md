# @grimora/api

The Grimora backend — a **modular-monolith** HTTP service and the long-lived public integration boundary
(ADR 0003 §8, ADR 0011). It began as a walking-skeleton scaffold for **ADR 0027**, and as of Phase 2 (closed
2026-07-12) carries the **real auth→cloud-sync vertical**.

> **Status: real (dev).** Built and live-verified against the `grimora-dev` Supabase project: the **auth
> proxy** (`/api/v1/auth/*`, #120 — access token in the response, refresh token in an `HttpOnly` cookie,
> ADR 0012 §5), the **sync endpoints** (`POST/GET /api/v1/sync/*`, #107 — per-event push results + owner-scoped
> pull), the **Postgres event store** (`pg-sync-store`), and **JWKS JWT verification** with server-side
> actor-binding (ADR 0024 §2). Not yet done: deployment/IaC (ADR 0014 §3), a `SecretsPort`, the committed
> OpenAPI drift-check, and the AI proxy / full online-read surface. **Audit follow-ups** (server-ingress
> trust gates, limits/pagination, structured logging) are tracked in #187/#189/#194. Runs locally; no public
> deployment yet.

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

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness. |
| `GET` | `/api/v1/rule-systems/{id}` | Read a rule system from the plugin catalog (master-data read, ADR 0011 §1.5/§6). `404` → `problem+json`. |
| `GET` | `/api/v1/openapi.json` | The generated OpenAPI 3.1 document (the published contract SSOT). |
| `POST` | `/api/v1/auth/sign-in` · `/sign-out` · `/refresh` | Auth proxy over Supabase Auth (#120). Access token in the body; refresh token in an `HttpOnly` cookie (ADR 0012 §5). |
| `POST` | `/api/v1/sync/push` | Insert-only event push, **per-event** results (accepted/duplicate/conflict, ADR 0011 §7). Bearer-authenticated; `owner_id` from the verified JWT (ADR 0024 §2). |
| `GET` | `/api/v1/sync/pull` | Owner-scoped events after a `?since=` checkpoint. Bearer-authenticated. |

## Run it

```bash
bun install                       # from the repo root
bun run --filter=@grimora/api dev # watch mode (or `start` for a one-shot run)
# → http://localhost:3001/health , /api/v1/rule-systems/dsa5 , /api/v1/openapi.json
bun run --filter=@grimora/api test
```

## Deferred to the real build (trigger-gated, ADR 0014 §3)

- Deployment as a Fly.io/Hetzner container + IaC/restore tests (ADR 0014 §3); config/secrets via a
  `SecretsPort` (ADR 0010 §4).
- Commit + CI drift-check of the generated `openapi.json` as the published SSOT (ADR 0027 §3).
- The AI proxy + full online-read surface (later phases).
- **Sync-ingress hardening** — server-side schema/provenance/privacy-classification gates (#187), request
  limits + pull pagination (#189), and a `LoggerPort` adapter (#194) — audit follow-ups, before public deploy.
