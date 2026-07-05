# Grimora — Roadmap

Built step by step. Each phase is broken into GitHub issues (**bugs before features**). A phase is
"done" when `bun run lint` + `typecheck` + `test` + `build` (+ `arch` from Phase 1 on) are green and
the local stack runs.

> **Architecture-first.** Feature/core-engine implementation is deliberately gated behind a proper
> architecture phase (ADRs + automated conformance), so the codebase stays extensible and
> refactorable for years and keeps its technologies swappable.

## Phase 0 — Foundation ✅ (done 2026-07-05)

- Monorepo scaffold: bun workspaces + Turborepo; biome; strict `tsconfig.base.json`; root scripts.
- CI (GitHub Actions: install → lint → typecheck → test → build).
- `docker-compose.yml` for the local stack (Postgres + MinIO, optional Ollama).
- Docs: ADRs + `docs/legal/`, plus vision/roadmap/hosting/access/naming.
- First package `@grimora/shared-types` validates the toolchain end to end.

## Phase 1 — Architecture foundation & conformance 🚧 (Epic #1)

Establish the architecture as a whole and in specifics, recorded as **ADRs 0003–0009**, and make it
**continuously testable** via architecture fitness functions in CI.

- Hexagonal / Ports & Adapters; enforced module boundaries (`domain ← application ← adapters`).
- ADRs: overall architecture (#2), Event Sourcing & CQRS (#3), persistence & sync (#4), plugin
  system (#5), theming (#6), AI provider (#7), cross-cutting concerns (#8).
- Architecture conformance harness in CI: dependency-cruiser + arch unit tests (#9).
- Deliverable: a **ports catalog** proving each external technology is swappable behind a port.

## Phase 2 — Core engine (offline-first) ⛔ blocked by #1 (Core-engine Epic)

Implemented against the Phase 1 ports: `event-store`, `core-domain`, `cqrs-read`, `plugin-sdk` v0,
`design-tokens` + base theme, `apps/web` skeleton (runs fully locally, no cloud yet).

## Phase 3 — DSA5 plugin (reference; mechanics only)

`plugins/dsa5`: schema + probe/roll/formula logic (no copyrighted content). Create/manage characters
via UI + generator (fixed + random values).

## Phase 4 — Cloud sync + enemies/assets

Connect Supabase (Auth + event-log sync; conflict resolution via event order/idempotency).
Enemies/monsters (fixed + random). Asset library + storage (Cloudflare R2 / MinIO).

## Phase 5 — Mobile

`apps/mobile` (Expo) with local store + sync; design tokens → RN theming.

## Phase 6 — AI chat (additional control layer)

`packages/ai-agent` multi-provider abstraction (Claude/OpenAI/Ollama); tool/function-calling against
the public API; AI output labelled (AI Act).

## Phase 7 — Desktop + hardening

`apps/desktop` (Tauri) wrapping the web app; further themes/plugins; compliance hardening
(CRA / AI Act / DSGVO / BFSG).

## Status legend

✅ done · 🚧 in progress · ⛔ blocked · ⬜ not started (Phases 2–7)
