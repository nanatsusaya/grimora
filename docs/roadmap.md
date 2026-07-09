# Grimora — Roadmap

Built step by step. Each phase is broken into GitHub issues (**bugs before features**). A phase is
"done" when `bun run lint` + `typecheck` + `test` + `build` (+ `arch` from Phase 1 on) are green and
the local stack runs.

> **Architecture-first.** Feature/core-engine implementation is deliberately gated behind a proper
> architecture phase (ADRs + automated conformance), so the codebase stays extensible and
> refactorable for years and keeps its technologies swappable.

> **This file is the stable, high-level phase map.** The living, detailed handoff / next-steps snapshot
> (current focus, open PRs, the Phase-2 slice breakdown) is `docs/STATUS.md`.

## Phase 0 — Foundation ✅ (done 2026-07-05)

- Monorepo scaffold: bun workspaces + Turborepo; biome; strict `tsconfig.base.json`; root scripts.
- CI (GitHub Actions: install → lint → typecheck → test → build).
- `docker-compose.yml` for the local stack (Postgres + MinIO, optional Ollama).
- Docs: ADRs + `docs/legal/`, plus vision/roadmap/hosting/access/naming.
- First package `@grimora/shared-types` validates the toolchain end to end.

## Phase 1 — Architecture foundation & conformance ✅ (done 2026-07-10, Epic #1)

Established the architecture as a whole and in specifics, recorded as **21 Accepted ADRs** (0001–0012 +
0014 + 0015 + 0017 + 0020–0025; index: `docs/adr/README.md`), made it **continuously testable** via
architecture fitness functions in CI, then validated it on a **walking-skeleton** vertical slice (the
Phase-1 → Phase-2 gate).

- Hexagonal / Ports & Adapters; enforced module boundaries (`domain ← application ← adapters`).
- Architecture conformance harness in CI: dependency-cruiser + arch unit tests (#9), plus the
  documentation-conformance check.
- Walking skeleton (#61): first real code beyond `shared-types` — `plugin-sdk` + `core-domain` +
  `plugins/dsa5` + `apps/skeleton-walk`; all ADR 0022 §9 pass criteria green.
- Open carry-over: the **ports catalog** doc (swappable-port map) — produced during Phase-2 planning.

## Phase 2 — Core engine (offline-first) 🚧 unblocked, planning (Epic #10)

First job: break Epic #10 into a **thin vertical slice** of ordered, testable tickets (see
`docs/STATUS.md` → "Phase 2 — first slice"). Implemented against the Phase 1 ports — building blocks:
`event-store` (SQLite/OPFS) + `core-domain` (seeded by the skeleton) + `cqrs-read` projections +
`plugin-sdk` v0 (frozen, ADR 0025) + `design-tokens` + base theme + an **`apps/web` shell (Vite + React**
PWA, ADR 0012 — *not* Next.js), running fully locally (no cloud yet).

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

✅ done · 🚧 in progress · ⛔ blocked · ⬜ not started (Phases 3–7)
