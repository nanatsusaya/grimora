# Grimora — Hosting

**Principles (owner-approved):** offline-first, maximize free tiers, EU region (DSGVO),
Docker-based and self-hostable. The device is the primary source of truth; the cloud is a sync
target / backup. Because of offline-first, running "completely on localhost" is the normal case.

## Components

| Component | Recommendation (free-tier start) | Notes |
| --- | --- | --- |
| Code + CI/CD + Issues | **GitHub** (`nanatsusaya/grimora`) + Actions | tickets for AI agents; Actions are bun-capable |
| DB / event-sync / Auth / Storage | **Supabase** (Free → Pro $25/mo), EU region | Postgres + Auth + RLS + Storage in one |
| Object storage (asset library) | **Cloudflare R2** (10 GB free, no egress fee) | many images/maps; alt: Supabase Storage |
| CDN / DNS / WAF | **Cloudflare** (Free) | protects assets + API (CRA-relevant) |
| Web frontend | **Cloudflare Pages** or Vercel Hobby (Free) | Next.js; bun build |
| API (only where needed) | **Fly.io** / Railway (bun-native) or Hetzner ~€4/mo | Supabase covers most; add a service only if needed |
| Mobile (iOS/Android) | **Expo EAS** (free build quota) | one codebase |
| Desktop (Win/Mac/Linux) | **Tauri** (wraps the web app) | light/cheap vs. Electron |
| Offline sync (core) | local event log (SQLite/IndexedDB) ↔ Supabase | candidates: PowerSync / ElectricSQL / RxDB |
| AI (multi-provider) | adapters for Claude / OpenAI / **Ollama** (local, free) | default adapter swappable via config |
| Monitoring / logging | Sentry (Free) + structured logs (pino) | error handling FE + BE |

## Completely local ("komplett Localhost")

`docker compose up -d` starts the whole stack without any cloud:

- **Postgres** (data), **MinIO** (S3-compatible object storage in place of R2),
- optional **Ollama** (`docker compose --profile ai up -d`) for a fully local AI chat, no API key.

The same containers can later run on a single EU VM (e.g. Hetzner ~€4/mo) for "everything in one box".

## Cost outlook

- **Phase 0–2:** €0/month (local only / free tiers).
- **From cloud sync (Phase 3+):** ~€0–25/month (Supabase Pro when needed + AI usage).
- **App stores (one-off):** Apple Developer €99/year, Google Play €25 one-time.
