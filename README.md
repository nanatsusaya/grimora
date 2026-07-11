# Grimora

**Engine-agnostic tabletop RPG platform.** The core engine is rule-system-agnostic; concrete
rule systems are added as **plugins**. The first plugin is *Das Schwarze Auge 5* (DSA5), used as
the reference example — but Grimora aims to support any pen-&-paper rule system.

> **Status:** early Phase 2. The web app **runs offline in a browser today** (create a DSA5
> character, edit traits with derived values recomputing live, roll a check, and it all persists
> across a reload — fully offline). Cloud sync, auth, and the mobile/desktop clients are **planned**,
> not built. `docs/STATUS.md` is the authoritative current-state snapshot; this README is an
> orientation, and where it says *(planned)* the feature is decided but not yet implemented.

- **Engine-agnostic core** — rule systems are plugins (DSA5 first); themes and content extend on top.
- **Offline-first** — the web app runs and persists fully on localhost today (local SQLite);
  cloud sync (Supabase) is *(planned)*.
- **Event Sourcing + CQRS** for all non-master data.
- **Theme- and plugin-extensible** — frontend and backend extend independently.
- **Frontend-first control** — the AI chat is an *additional* layer over the same public API.
- **Multi-platform** *(planned)* — web today; mobile (Expo) and desktop (Tauri) from one core.

## Stack

- **Runtime & tooling:** TypeScript · **Bun** workspaces + **Turborepo** · **biome** (lint + format).
- **Web (today):** **Vite + React** PWA (ADR 0002/0012), offline-first against a local **SQLite** store
  (OPFS/WASM in the browser, `bun:sqlite` natively).
- **Backend & cloud** *(planned)*: **Supabase** (Postgres + Auth + RLS + Storage) for cloud sync; a
  **Hono** backend (`apps/api`, ADR 0027, currently a scaffold).
- **Other platforms** *(planned)*: mobile (React Native/Expo) and desktop (Tauri) from the shared core.
- **Architecture:** hexagonal / ports & adapters + DDD; Event Sourcing + CQRS for user data.

## Repository layout

```
apps/        web   — Vite + React offline-first PWA (the app you can run today)
             api   — Hono backend composition root (scaffold, ADR 0027)
             skeleton-walk — walking-skeleton validation harness (ADR 0022)
packages/    shared-types · rules-contract · core-domain · plugin-sdk · event-store · cqrs-read
             design-tokens · ui
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

Optional — the local backend stack (only needed for backend/sync work, which is *(planned)*, Phase 3+):

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

## Licensing & legal note

The DSA5 plugin ships **only rule mechanics/structure** (schema, roll/formula logic). It contains
**no** copyrighted Ulisses Spiele texts or values — users enter their own content. See
[`docs/legal/dsa5-content-boundary.md`](docs/legal/dsa5-content-boundary.md).
