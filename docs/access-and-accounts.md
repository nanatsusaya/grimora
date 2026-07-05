# Grimora — Access & accounts

What is needed to build and operate Grimora, grouped by when it becomes necessary.

## Now (Phase 0–1, local)

- **GitHub** repo `nanatsusaya/grimora` — exists ✔. For AI agents that create/work tickets, the
  **GitHub connector (MCP)** must be authorized in Claude Desktop (Settings → Connectors → GitHub →
  OAuth), or a GitHub App / PAT provided. Status: authorized ✔ (verified as user `nanatsusaya`).
- **bun** toolchain locally — installed ✔ (`~/.bun/bin`, not on PATH; call by full path or add to PATH).
- Optional: **Docker Desktop** — needed to actually run `docker-compose` (Postgres + MinIO). Not yet
  installed; the compose file is ready.

## When cloud sync is wanted (Phase 3+)

- **Supabase** project (URL, `anon key`, `service_role key`), EU region.
- **Cloudflare** account (+ R2); optionally **Fly.io** / Railway; a web host (Cloudflare Pages / Vercel).
- At least **one AI API key** (e.g. Anthropic) for the default adapter — or Ollama locally, no key.
- DNS management for **`grimora.game`**.

## Later (stores / legal / design)

- **Apple Developer Program** ($99/year), **Google Play Developer** ($25 one-time), **Expo/EAS** account.
- **Imprint + privacy policy** details (responsible entity, hosting region) for DSGVO/DDG.
- Branding/theme direction (base theme, logo), AI Act transparency texts, terms of use.

## Not needed

Other Claude connectors (Asana, Linear, Notion, Atlassian/Jira, Slack, Datadog, PagerDuty) are not
required for Grimora and are left unauthorized.
