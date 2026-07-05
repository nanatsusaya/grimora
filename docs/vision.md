# Grimora — Vision & Requirements

Grimora is an **engine-agnostic tabletop RPG platform**. The core is independent of any specific
rule system; concrete rule systems are added as **plugins**. The first plugin implements
*Das Schwarze Auge 5* (DSA5) as the reference example, but the platform is designed so that,
in principle, any pen-&-paper rule system can be supported.

## Product goals

- Manage **characters**, **enemies/monsters**, and **campaigns**; help the game master write and
  run campaigns.
- Make the rule system **viewable, editable and extensible**.
- **Auto-generate** characters and enemies/monsters — both with predefined values and with more
  random values.
- Attach **images and other assets** to characters/enemies/monsters; ship a large library of
  ready-made assets (characters, enemies, monsters, maps, …).
- Everything stored online and hosted; everything behind a backend that is reachable via **API**.
- **Frontend-first control:** every essential function is usable through normal UI input. An
  **AI chat is an additional control layer** over the same public API (create heroes/campaigns,
  manage them, administer the app) — never the only way to do something.

## Platforms

Start with a **website**; later extend to **iOS and Android** apps and a **Desktop/Mac**
application — from one shared codebase.

## Architecture principles

- **Engine-agnostic core; DSA5 as a plugin.** The platform theoretically supports any rule system.
- **Plugin system** so third parties can write their own plugins.
- **Base theme, extensible with further themes.**
- **Backend extensible without changing the frontend; frontend extensible without changing the
  backend.**
- **Offline-first + cloud-sync:** works locally without internet and re-syncs with the server when
  a connection returns.
- **Event Sourcing + CQRS:** aside from master data, data is stored as events; the database
  architecture follows a CQRS pattern.
- **User management** with **secure login**.

## Cross-cutting requirements

- **Legal compliance** with current EU **and German** law: DSGVO/BDSG, DDG/TTDSG (imprint/telemedia),
  EU AI Act, EU Cyber Resilience Act, BFSG (accessibility), and upcoming ratified regulations.
- **Logging** and advanced **error handling** in both frontend and backend.
- **Linting** and extensive **tests** in all essential forms.
- A thorough **architecture plan**.
- **Documentation:** every decision and every technology choice recorded as a markdown file in a
  dedicated folder (see `docs/adr/`).
- **Cost:** hosted as cheaply as possible; runnable completely on localhost.

## Process

- Repository on **GitHub**. **Tickets in GitHub**, workable by **AI agents**.
- The whole project is developed and managed by **AI agents**.
- Built **step by step** via a plan captured as tickets and worked off incrementally.
- **Bugs before features:** always prioritize fixing bugs over new features/changes.

## Confirmed decisions (owner-approved)

- **Name:** Grimora · target domain `grimora.game`. See [naming.md](naming.md).
- **Stack:** Node.js + TypeScript · bun (workspaces) + Turborepo · Supabase · React Native/Expo ·
  biome (lint+format) · modern CSS for theming. See [adr/0002-tech-stack-and-tooling.md](adr/0002-tech-stack-and-tooling.md).
- **AI:** multi-provider (Claude/OpenAI/Ollama), as an additional control layer.
- **DSA5 content:** plugin ships mechanics/structure only — no copyrighted Ulisses content. See
  [legal/dsa5-content-boundary.md](legal/dsa5-content-boundary.md).
- **Hosting:** offline-first, maximize free tiers, EU region, self-hostable. See [hosting.md](hosting.md).
