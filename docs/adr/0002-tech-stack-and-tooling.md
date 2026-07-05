# ADR 0002 — Tech stack and tooling

- **Status:** Accepted
- **Date:** 2026-07-05

## Context

Grimora targets Web + iOS/Android + Desktop from one codebase, offline-first with cloud-sync,
Event Sourcing + CQRS, a plugin system for rule systems (first: DSA5), and theme extensibility.
Cost goal: maximize free tiers. The stack was confirmed with the project owner.

## Decision

- **Language / runtime:** Node.js + TypeScript. Keep the production API **node-compatible** (so it
  runs under both node and bun), because bun-as-runtime can still hit edge cases with some native
  libraries.
- **Package manager / monorepo:** **bun** workspaces (replaces pnpm) + **Turborepo** for task
  orchestration, caching and affected-detection.
- **Lint / format:** **biome** (single tool for lint + format, ~25× faster in CI, biome 2.x type
  inference). Keep a **minimal ESLint config only for `eslint-plugin-react-hooks`** in React/Expo
  packages, since biome does not fully cover that rule set yet. Prettier is not used.
- **Backend platform:** **Supabase** (Postgres + Auth + RLS + Storage), EU region.
- **Frontend:** Web = Next.js; Mobile = React Native / Expo; Desktop = Tauri (wraps the web app).
- **Theming:** **modern CSS** (custom properties, `@layer`, `light-dark()`, container queries; no
  runtime CSS-in-JS). Cross-platform via **design tokens (JSON) as the single source of truth**,
  generated per platform (CSS vars for web, RN StyleSheet for native).
- **AI:** multi-provider abstraction (Claude / OpenAI / Ollama), as an *additional* control layer.

## Evaluated alternatives

- **pnpm** — solid, but bun now has first-class Expo monorepo support and is faster; no reason to
  keep pnpm. See Expo monorepo docs and Turborepo+bun+Next+Expo examples.
- **ESLint + Prettier** — unmatched plugin ecosystem, but slower and multi-tool. For a greenfield
  2026 project biome is recommended; we bridge the one gap (react-hooks) with a tiny ESLint config.

## Consequences

- Fast installs and CI; one formatter/linter config.
- One escape-hatch ESLint config to maintain for react-hooks.
- Production API must avoid bun-only APIs to stay node-compatible.

## References

- Expo — Work with monorepos: https://docs.expo.dev/guides/monorepos/
- Turborepo + bun + Next + Expo example: https://github.com/allipiopereira/turborepo-bun-next-expo
- Biome vs ESLint + Prettier (2026): https://www.pkgpulse.com/blog/biome-vs-eslint-prettier-linting-2026
