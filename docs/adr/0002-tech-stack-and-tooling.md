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
- **Frontend:** Web = **Vite + React** (SPA / offline-first PWA — see ADR 0012); Mobile = React Native /
  Expo; Desktop = Tauri (wraps the web app). *(Amended 2026-07-09 — was `Next.js`; see Amendments.)*
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

## Amendments

- **2026-07-09** — *Authorized by the project owner.* **Web framework: Next.js → Vite + React.** The
  original stack listed `Web = Next.js` with **no recorded rationale or alternatives** (the
  Evaluated-alternatives section covered only pnpm and ESLint). When ADR 0012 fixed the frontend as an
  **offline-first PWA** — the authenticated app is **client-rendered against the local store** (the
  device is the source of truth, ADR 0005), so **SSR of user data is neither possible nor wanted** —
  Next.js's headline strength (SSR/RSC) goes unused while its weight and static-export/offline friction
  remain. **Decision: Vite + React** for `apps/web` — lean, first-class PWA tooling (`vite-plugin-pwa`),
  no SSR baggage, fast DX, and it **keeps React alignment** with Mobile (Expo/RN, for shared
  view-model/hook logic) and the largest ecosystem + AI-assist corpus; Tauri (desktop) wraps it
  unchanged; deploys to Cloudflare Pages (ADR 0012 R1). The **router** (TanStack Router or React
  Router 7 in SPA/data mode) is an `apps/web` implementation detail, not a stack pillar; public/marketing
  pages may use a small static generator (e.g. Astro — ties to ADR 0026). **Alternatives weighed
  (2026-07 review):** *keep Next.js* (safe, biggest ecosystem, but SSR unused, heavier) — rejected as a
  poorer offline-first fit; *React Router 7 / TanStack Start* (React, Vite-based, client-first) — viable,
  folded into the Vite+React family as the router choice; *SvelteKit* (leanest, best DX) — rejected
  because it **breaks React/RN alignment** and shrinks the AI-assist corpus; *Nuxt/Vue, SolidStart, Qwik,
  Angular* — rejected (non-React alignment cost, or maturity/fit). ADR 0012 §1/§9 reflect this choice.
  The **full framework-by-framework comparison** (every option with its pros/cons, the Grimora-specific
  evaluation criteria, and the shortlist) is recorded in
  [`docs/research/frontend-framework-comparison.md`](../research/frontend-framework-comparison.md) —
  mirroring the ADR 0020 ↔ `rule-systems-comparison.md` decision/evidence split (added 2026-07-09 as the
  owner-requested durable home for the comparison that previously lived only in the review conversation).
- Biome vs ESLint + Prettier (2026): https://www.pkgpulse.com/blog/biome-vs-eslint-prettier-linting-2026
