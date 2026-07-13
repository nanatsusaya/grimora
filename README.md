# Grimora

**Engine-agnostic tabletop RPG platform.** The core engine is rule-system-agnostic; concrete
rule systems are added as **plugins**. The first plugin is *Das Schwarze Auge 5* (DSA5), used as
the reference example — but Grimora aims to support any pen-&-paper rule system.

> **Status:** Phase 2 closed (2026-07-12). The web app **runs offline in a browser today** (create a DSA5
> character, edit traits with derived values recomputing live, roll a check, and it all persists
> across a reload — fully offline) **and syncs to the cloud**: email+password **auth** and offline→cloud
> **sync** (push + pull + a visible cross-device view) are **built and live-verified** against a real
> Supabase project, via the `apps/api` backend. Still **planned**: cross-device *co-editing* (#176) and
> the mobile/desktop clients. `docs/STATUS.md` is the authoritative current-state snapshot; this README is
> an orientation, and where it says *(planned)* the feature is decided but not yet implemented.

- **North Star** *(direction)* — a campaign-management **AI assistant**: agents help the game master
  build enemies/NPCs, keep adventure logs and spark creative ideas — always over the *same* public API,
  never a privileged path. The public project stays **mechanics-only**; richer rule content is
  user-supplied (see the licensing note). Full vision in [`docs/vision.md`](docs/vision.md).
- **Engine-agnostic core** — rule systems are plugins (DSA5 first); themes and content extend on top.
- **Offline-first** — the web app runs and persists fully on localhost, and replicates to **cloud sync**
  (Supabase) through the `apps/api` backend; local-first always works, cloud is additive.
- **Event Sourcing + CQRS** for all non-master data.
- **Theme- and plugin-extensible** — frontend and backend extend independently.
- **Frontend-first control** — the AI chat is an *additional* layer over the same public API.
- **Multi-platform** *(planned)* — web today; mobile (Expo) and desktop (Tauri) from one core.

## Stack

- **Runtime & tooling:** TypeScript · **Bun** workspaces + **Turborepo** · **biome** (lint + format).
- **Web (today):** **Vite + React** PWA (ADR 0002/0012), offline-first against a local **SQLite** store
  (OPFS/WASM in the browser, `bun:sqlite` natively).
- **Backend & cloud (today):** a **Hono** backend (`apps/api`, ADR 0027) providing the auth proxy + sync
  endpoints, against **Supabase** (Postgres + Auth + RLS) for cloud sync. Object **Storage** is *(planned)*.
- **Other platforms** *(planned)*: mobile (React Native/Expo) and desktop (Tauri) from the shared core.
- **Architecture:** hexagonal / ports & adapters + DDD; Event Sourcing + CQRS for user data.

## Repository layout

```
apps/        web   — Vite + React offline-first PWA (the app you can run today)
             api   — Hono backend: auth proxy + cloud-sync endpoints (ADR 0027)
             skeleton-walk — walking-skeleton validation harness (ADR 0022)
packages/    shared-types · rules-contract · core-domain · plugin-sdk · event-store · cqrs-read
             offline-sync · design-tokens · ui
plugins/     dsa5 (mechanics/structure only — no copyrighted content)
docs/        adr/ (architecture decision records) · legal/ · meta/
```

## Getting started

The offline-first web app runs fully on localhost — **no cloud and no Docker needed**:

```bash
bun install
bun run dev          # builds the workspace packages, then serves the web PWA with HMR
```

Open the localhost URL printed by Vite. `bun run dev` builds the workspace packages first (they are
consumed from their `dist/` output), then starts the dev server(s).

Optional — the local backend stack (for self-hosted backend/sync work; the cloud path runs against a real
Supabase project, see `docs/ops/supabase-setup.md`):

```bash
docker compose up -d                 # Postgres + MinIO (S3) + GoTrue (self-hosted auth)
docker compose --profile ai up -d    # additionally start a local Ollama for the AI chat
```

## Scripts

Scripts follow a curated set of **primary verbs** (see `CLAUDE.md` for the full list and the derived
detail commands).

| Command | Purpose |
| --- | --- |
| `bun run dev` | Vite dev server(s) with HMR |
| `bun run serve` | serve the *built* web app (Vite preview) |
| `bun run build` | build all workspaces |
| `bun run test` | run tests |
| `bun run lint` / `bun run format` | biome check / format |
| `bun run typecheck` | TypeScript project checks |
| `bun run arch` | architecture conformance harness (ADR 0003 dependency rule + security boundaries) |
| `bun run check` | full local DoD chain, in CI order: lint → typecheck → arch → test → build |

## Documentation

Every significant technology/architecture decision is recorded as an ADR in
[`docs/adr/`](docs/adr/). The living project-state snapshot is [`docs/STATUS.md`](docs/STATUS.md);
legal boundaries (e.g. DSA5 content) live in [`docs/legal/`](docs/legal/).

## Contributing & conduct

Grimora is currently developed by its owner with AI agents and is **not yet open to outside
contributions**. The working conventions (branch/PR flow, Conventional Commits, Definition of Done) live
in [`CLAUDE.md`](CLAUDE.md); all interaction is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).
For security issues, use **private vulnerability reporting** (see [`SECURITY.md`](SECURITY.md)) — never a
public issue.

## Licensing & legal note

The DSA5 plugin ships **only rule mechanics/structure** (schema, roll/formula logic). It contains
**no** copyrighted Ulisses Spiele texts or values — users enter their own content. See
[`docs/legal/dsa5-content-boundary.md`](docs/legal/dsa5-content-boundary.md).
