# Grimora

**Engine-agnostic tabletop RPG platform.** The core engine is rule-system-agnostic; concrete
rule systems are added as **plugins**. The first plugin is *Das Schwarze Auge 5* (DSA5), used as
the reference example — but Grimora aims to support any pen-&-paper rule system.

- **Offline-first + cloud-sync** — the device is the primary source of truth; the cloud is a sync
  target / backup. Runs fully on localhost.
- **Event Sourcing + CQRS** for all non-master data.
- **Web + iOS/Android + Desktop** from one codebase.
- **Theme- and plugin-extensible** — frontend and backend can be extended independently.
- **Frontend-first control**; the AI chat is an *additional* layer over the same public API.

## Stack

Node.js + TypeScript · **bun** (workspaces) + **Turborepo** · **Supabase** (Postgres + Auth + RLS +
Storage) · **React Native/Expo** · **biome** (lint + format) · **modern CSS** for theming.

## Repository layout

```
apps/        web (Next.js) · mobile (Expo) · desktop (Tauri) · api (optional)
packages/    core-domain · event-store · cqrs-read · offline-sync · plugin-sdk
             design-tokens · ui · shared-types · ai-agent
plugins/     dsa5 (mechanics/structure only — no copyrighted content)
docs/        adr/ (architecture decision records) · legal/
```

## Getting started (local, no cloud needed)

```bash
bun install
docker compose up -d        # Postgres + MinIO
bun run dev
```

## Scripts

| Command | Purpose |
| --- | --- |
| `bun run lint` | biome check (lint + format check) |
| `bun run lint:fix` | biome auto-fix |
| `bun run typecheck` | TypeScript project checks |
| `bun run test` | run tests |
| `bun run build` | build all workspaces |

## Documentation

Every significant technology/architecture decision is recorded as an ADR in
[`docs/adr/`](docs/adr/). Legal boundaries (e.g. DSA5 content) live in [`docs/legal/`](docs/legal/).

## Licensing & legal note

The DSA5 plugin ships **only rule mechanics/structure** (schema, roll/formula logic). It contains
**no** copyrighted Ulisses Spiele texts or values — users enter their own content. See
[`docs/legal/dsa5-content-boundary.md`](docs/legal/dsa5-content-boundary.md).
