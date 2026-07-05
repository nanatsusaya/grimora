# Grimora — Roadmap

Built step by step. Each phase is broken into GitHub issues (bugs before features). A phase is
"done" when `bun run lint` + `typecheck` + `test` + `build` are green and the local stack runs.

## Phase 0 — Foundation ✅ (done 2026-07-05)

- Monorepo scaffold: bun workspaces + Turborepo.
- biome (lint + format); minimal ESLint-for-react-hooks to be added when React packages arrive.
- `tsconfig.base.json` (strict), root scripts, CI (GitHub Actions: install → lint → typecheck →
  test → build).
- `docker-compose.yml` for local stack (Postgres + MinIO, optional Ollama).
- Docs structure: ADRs + `docs/legal/`, plus vision/roadmap/hosting/access/naming.
- First package `@grimora/shared-types` (Brand types, `EntityId`, `EventEnvelope`, `Result`) —
  validates the toolchain end to end.

## Phase 1 — Core engine (offline-first)

- `packages/event-store` — local append-only event log (SQLite), append/read/subscribe interfaces.
- `packages/core-domain` — aggregates + command handlers on top of Event Sourcing.
- `packages/cqrs-read` — projections → local read models for the UI.
- `packages/plugin-sdk` v0 — stable contract (TS interfaces + JSON Schema) for rule definitions,
  generators, UI slots, theme tokens, AI tools.
- `packages/design-tokens` + base theme (modern CSS).
- `apps/web` — Next.js skeleton that runs fully locally (no cloud yet). Auth wiring stubbed.

## Phase 2 — DSA5 plugin (reference; mechanics only)

- `plugins/dsa5` — schema + probe/roll/formula logic (no copyrighted content).
- Create/manage characters via UI + generator (fixed + random values).

## Phase 3 — Cloud sync + enemies/assets

- Connect Supabase (Auth + sync of the event log); conflict resolution via event order/idempotency.
- Enemies/monsters (characters + monsters, fixed + random).
- Asset library + storage (Cloudflare R2 / MinIO): images for characters/enemies/monsters/maps.

## Phase 4 — Mobile

- `apps/mobile` (Expo) with local store + sync.
- Design tokens → RN theming.

## Phase 5 — AI chat (additional control layer)

- `packages/ai-agent` multi-provider abstraction (Claude/OpenAI/Ollama).
- Tool/function-calling against the public API; AI output labelled (AI Act).

## Phase 6 — Desktop + hardening

- `apps/desktop` (Tauri) wrapping the web app.
- Further themes/plugins; compliance hardening (CRA / AI Act / DSGVO / BFSG).

## Status legend

✅ done · 🚧 in progress · ⬜ not started (Phases 1–6 = ⬜)
