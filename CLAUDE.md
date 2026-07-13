# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Grimora is an **engine-agnostic tabletop RPG platform**: the core is independent of any rule system;
concrete rule systems (first *Das Schwarze Auge 5* / DSA5) are **plugins**. See `docs/vision.md` for
the full product vision — including the **North Star** (Grimora as a personal DSA *campaign assistant*:
AI agents helping run games over the public API) and the deliberate **public/private split**: this public
project stays **mechanics-only**, while the owner keeps a **separate private** DSA worldbuilding
knowledge-base project and plans a private, content-rich DSA plugin on the SDK for personal use (which is
*why* the content boundary and the SDK contract are load-bearing). **Phase 1 (architecture-as-ADRs) is closed**, and **Phase 2 (core engine / first
vertical slice) closed 2026-07-12** (close-out epic #181): the offline-first core runs as a real app with
an end-to-end **auth → cloud-sync** vertical. Real (non-skeleton) code lives in `packages/core-domain`,
`packages/plugin-sdk`, `packages/rules-contract`, `plugins/dsa5`, `packages/event-store`/`cqrs-read`,
`packages/offline-sync` (the client sync adapter), and both `apps/web` (a real offline-first PWA in a
browser, syncing to the cloud) and `apps/api` (a real backend: the auth proxy + sync endpoints against
Supabase) — alongside the original `apps/skeleton-walk` validation harness; the remaining `apps/`/`packages/`
are still scaffold-only. **Phase 3** opens from here. Check `docs/STATUS.md` for the current
phase/next-step snapshot before starting work.

## Commands

Scripts follow a **curated set of primary verbs**; everything else is a derived/detail command. Prefer
the primary verb; reach for a detail command only when you need it.

```bash
# Primary verbs
bun install                 # install workspace deps (bun workspaces)
bun run dev                 # turbo dev server(s) with HMR (Vite for apps/web)
bun run serve               # turbo serve — serve the *built* app (vite preview; apps/web)
bun run build               # turbo build (all workspaces)
bun run test                # turbo test (all workspaces)
bun run lint                # biome check (lint + format check)
bun run format              # biome format --write
bun run typecheck           # turbo typecheck (all workspaces)
bun run arch                # architecture conformance harness (dependency-cruiser + fitness tests)
bun run check               # the full local DoD chain, in CI order: lint → typecheck → arch → test → build
bun run refresh             # clean slate: remove node_modules + build/cache, then reinstall
bun run clear               # remove node_modules + build outputs + .turbo cache (then `bun install`/`refresh`)

# Derived / detail
bun run lint:fix            # biome auto-fix
bun run test:coverage       # bun test --coverage across workspaces (report-only, ADR 0017 R2)
docker compose up -d        # Postgres + MinIO (add --profile ai for local Ollama)
```

Scope to one workspace with turbo's `--filter=@grimora/<pkg>`. Run a single colocated `*.test.ts`
directly from inside its package: `bun test src/index.test.ts` (add `-t "name"` to filter by test name).

CI (`.github/workflows/ci.yml`) runs, in order: install (frozen lockfile) → lint → typecheck → arch →
test → build → **Playwright E2E** (`apps/web`, #130) — keep all green before work is done. **`bun run
check` runs the lint→build chain locally** (same order, minus the browser E2E), so it is the one command
to confirm the local Definition of Done; also run `bun run e2e` when a change touches the web app. `arch`
is the conformance harness (`scripts/arch/`, issue #9) enforcing the ADR 0003 §2 dependency rule +
security boundaries (`scripts/arch/README.md`).

## Architecture (read the ADRs before changing structure)

Every architectural decision is recorded in `docs/adr/` (index: `docs/adr/README.md`) and is
**normative** — this section is a map to help you find the right ADR, not a substitute for reading it.

**Hexagonal / Ports & Adapters + DDD** (ADR 0003) is the top-level shape:

```
Domain (pure, no I/O)  ←  Application (use cases, declares Ports)  ←  Ports (interfaces)
                                                                          ↑
                                                              Adapters implement them
Composition root (apps/*) wires adapters → ports; only place allowed to depend on everything.
Presentation (UI/API) calls Application via input ports.
```

Dependency rule (enforced by the Phase-1 conformance harness, issue #9): Domain depends on nothing but
`shared-types`; Application depends only on Domain + Ports, never adapters; plugins depend **only** on
`@grimora/plugin-sdk`, never core internals; no deep imports (`@grimora/x/src/...`), no cycles.

Module map (`packages/`, `apps/`, `plugins/` — see ADR 0003 §3 for the authoritative version):
`shared-types` (leaf types) · `core-domain` (domain+application+ports) · `plugin-sdk` (published
plugin contract) · `design-tokens` (theming SSOT) · `ui` (presentation) · `event-store` /
`cqrs-read` / `offline-sync` / `ai-agent` (adapters) · `apps/api` (backend composition root + public
API) · `apps/web|mobile|desktop` (frontend composition roots) · `plugins/dsa5` (first rule plugin).

**Core vs. plugin boundary** (ADR 0020): core = the rule-agnostic *meta-model* (generic
attribute/skill/ability/resource/derived-value slots, campaign/session/GM tooling, assets, the
formula/dice **abstraction**) + orchestration. A plugin = the *concrete* rule system (which
attributes, the actual formulas, **the dice mechanic itself**, templates). When in doubt: if it's true
for DSA5, D&D5e, Shadowrun and Vampire alike, it's core; if it varies per system, it's plugin.

**Plugin system** (ADR 0006): a plugin is a bounded context whose only core dependency is
`@grimora/plugin-sdk` — declarative (JSON-Schema-validated) Definition APIs + pure Behaviour APIs (no
ambient I/O/network/DOM), each capability namespaced by plugin id. Multiple plugins run at once; one
rule system binds per character (never two), themes/content packs/AI tools are additive.

**Event Sourcing + CQRS** (ADR 0004/0005): user aggregates (characters, campaigns, NPCs) are
event-sourced — immutable, past-tense, intention-revealing events (`character.attributeRaised`, not
generic field-setters), folded to state; read models are rebuildable projections (the UI never reads
the event store directly). Master/reference data (plugin catalogs, auth) stays relational. Local SQLite
(native/OPFS) ↔ Supabase Postgres (RLS); sync is insert-only, conflict-free event replication with
git-like domain **rebase** for real concurrent-edit conflicts.

**Theming** (ADR 0007): design tokens (JSON, `packages/design-tokens`) generated to per-platform
artifacts — no runtime CSS-in-JS; UI consumes only **semantic** tokens, never primitives. Cascade
(most specific wins): character › player per-campaign › GM campaign › player global › rule-system
default › app base.

**AI provider abstraction** (ADR 0008): a *non-privileged* control layer over the same public API —
`AiProviderPort` (Claude/OpenAI/Ollama, swappable); tools are descriptors over existing use-cases (same
authz/validation as the UI, no special AI path), contributed by core **and** plugins into one
namespaced registry. A future MCP server is just *another* inbound adapter over that registry.

**Cross-cutting: errors, logging, auth** (ADR 0009): `Result<T,E>` (from `shared-types`) for expected
failures + an `AppError` hierarchy (namespaced codes, i18n keys, closed category set incl.
`RateLimited`). `LoggerPort` → pino (BE) / Sentry (FE), PII redaction enforced at the adapter.
`AuthPort` (Supabase Cloud + self-hosted GoTrue) is separate from `AuthorizationPort` (RBAC
Owner/GM/Player/Spectator, enforced in the Application layer); RLS is defense-in-depth, never the sole gate.

## Working conventions specific to this repo

- **Bugs before features** — always prioritize fixing a bug over new work.
- **ADRs are the source of truth for architecture.** An `Accepted` ADR is immutable **except with
  explicit owner authorization**, recorded in that ADR's *Amendments* section (ADR 0001). Otherwise a
  new decision needs a superseding ADR, not an edit.
- **Per-ADR workflow**: branch `adr/NNNN-slug` from `main` → write the ADR (`Status: Proposed`, update
  `docs/adr/README.md`) → open a PR with open review questions for the owner → owner merges → sync
  `main`, flip `Proposed → Accepted` (ADR file + index) as a direct follow-up commit on `main`, delete
  the branch. See recent history (ADR 0008/0009) for the pattern in practice.
- **`plugins/dsa5` ships self-implemented rule mechanics/structure only** — abstract game mechanics
  aren't copyrightable, so we re-implement formulas/logic in our own code (i18n-key labels); but **no**
  verbatim rule/flavour text, tables, artwork, official logos/look-and-feel, or **data-rich
  compilations** — descriptions/values/effects (those come via user import/content packs; the bare
  mechanical **roster** — names + attribute triples + category + improvement factor — *does* ship), and
  DSA-derived content is **not** placed under our OSS/CC license. Grimora is a **free, non-commercial fan project**; a comprehensive
  database/character-generator, any commercial turn, or shipping DSA data in the OSS repo each require
  **written Ulisses permission first** (`docs/legal/dsa5-content-boundary.md` — the binding, revised
  boundary). `rulebooks/` is git-ignored (only its README is tracked) — never commit rulebook PDFs.
- **Secrets only at the composition root** (`apps/*`) — never in Domain, Application, plugins, or logs.
- **AI**: external providers (Claude/OpenAI) are opt-in after explicit user consent; local Ollama is
  the no-consent default. AI output is always labelled as AI-generated (EU AI Act Art. 50).
- **EU/German legal compliance** is tracked centrally in `docs/legal/eu-de-compliance-matrix.md` —
  check it before ADR work that touches a legal deadline or obligation, rather than re-deriving it.
- Current phase/handoff status lives in `docs/STATUS.md` (updated frequently); treat this file
  (`CLAUDE.md`) as the stable operating rules, not the current-state tracker.
- **Recurring maintenance tasks** are tracked in `docs/recurring-tasks.md` (device-independent, in the
  repo). At the start of a working session, check that list and run any task whose interval has elapsed
  since its "last checked" date, then update the date there. (Currently: a weekly check of whether the
  Dependabot `bun.lock` workspace bug is fixed, to re-enable JS dependency updates.)
- **Agent-collaboration meta-log** (`docs/meta/agent-collaboration-log.md`): a running journal — separate
  from the ADRs (architecture) and `STATUS.md` (project state) — of *how* the owner and AI agents work
  together: cross-checks against another model/agent, owner corrections with their rationale, and
  workflow experiments, each with its trigger, method and observed impact. This exists because a stated
  goal of the project is the owner's own skill-building in AI-agent collaboration, not only the RPG
  platform itself. It is a **living doc**: direct commits to `main` are allowed for it (a second
  documented exception alongside the ADR accept-flip, below) — log only genuinely methodological
  moments, not routine task execution.

### Delivery workflow & PRs

- **Every change goes on a branch and through a PR — never commit directly to `main`** (the two
  documented exceptions are the ADR `Proposed → Accepted` status flip above and the agent-collaboration
  meta-log). **The owner merges every PR.** After a merge, sync `main`, prune, and delete the merged
  branch.
- **One concern per PR** — split unrelated changes so each stays reviewable in isolation; don't fold
  refactors, formatting churn, or dependency/toolchain upgrades into unrelated work (a major upgrade
  gets its own PR with rationale + check results).
- **Commits & PRs:** Conventional Commits (`type(scope): summary`, imperative subject, body explains the
  *why*); end commit messages with the `Co-Authored-By` trailer and PR bodies with the Claude Code line.
  A PR body states **what**, **why**, **which issue/ADR it follows**, **architecture impact**, how it
  was **verified**, any **merge-order** caveats, and known **follow-ups**. Branch prefixes: `adr/…`,
  `feat/…`, `fix/…`, `chore/…`, `docs/…`.
- **Definition of Done (before handing work back):** the full local chain is green — `lint`,
  `typecheck`, `arch`, `test`, `build`; for anything with runtime behaviour, **verify by exercising it
  end-to-end**, not just via tests; the PR's CI is green. **Report outcomes faithfully**, including
  failures or skipped steps.
- **Only hand a task back when you are ≥ 95 % confident it is correct, complete, and safe.** The owner
  delegates and reviews mainly essential questions and the PRs, so the bar for "done" is high — if you
  are not that confident, keep working or raise the specific uncertainty instead of returning it.
- **Dependency hygiene:** commit any `package.json` change together with a regenerated `bun.lock`
  (`bun install`), and ensure `bun install --frozen-lockfile` passes. Never adopt a major dependency
  bump without running the full chain and noting it. (Dependabot manages GitHub Actions only — see
  `docs/recurring-tasks.md`.)

### Working with the owner

- **Surface owner-domain decisions before acting** — roadmap/sequencing, legal, licensing, config
  trade-offs, and anything hard to reverse or outward-facing. Recommend a default, but let the owner
  choose. **Stop and ask** in particular before: amending an Accepted ADR; defining or changing a
  public API/SDK contract; altering the core-vs-plugin boundary; introducing external network calls,
  secrets, telemetry or AI-provider data transfer; adding copyrighted rule-system content; or a major
  dependency/toolchain upgrade.
- **Verify external facts from primary sources** (library/tool capabilities, legal deadlines, API
  details) rather than asserting from memory; cite the source.
- **Scale decisions to the project's actual stage** (solo, pre-revenue, no public launch): prefer a
  trigger-gated backlog over speculative up-front work and avoid over-engineering — but record deferred
  concerns so nothing is lost.
- **Language:** **all repository artefacts are written in English** — code, code comments, ADRs and
  every file under `docs/`, `README`s, `SECURITY.md`, commit messages, PR titles/bodies and issues.
  **Direct conversation with the owner is in German.** The only exception is user-facing UI strings,
  handled later via i18n (German and other languages) — never by writing project docs in German.

### Code documentation & comments

Comments explain **why**, not **what** — the purpose, who needs it, the preconditions/constraints —
never a paraphrase of what the code obviously does. Verbose is fine: clarity (especially for AI agents)
outweighs brevity, even though it enlarges the code. Keep docs **current**: whenever code changes,
update the affected inline docs **and** the relevant Markdown (ADRs, `STATUS.md`, `README`s, `docs/…`)
in the *same* change — stale documentation is a defect.

- **Every file, class, and exported function/type carries a block header** documenting its purpose.
  **File / class / function headers are always the multi-line JSDoc form** (never a single-line
  `/** … */`), and a function header documents **every parameter** with `@param` (plus `@returns` /
  throws where relevant):

  ```
  /**
   * Why this exists / what it is for / who needs it / the conditions.
   * @param foo  what it means and any constraints
   * @returns   what the caller gets back
   */
  ```

- **Type / interface *properties*** are documented too, but here a **single-line `/** why … */`** is
  fine when one line suffices — **as long as it gives the why / the contract**, not a paraphrase of the
  type. Write `/** kept a string so the event envelope stays JSON-serializable */`, not
  `/** an ISO-8601 timestamp string */`. A **purely structural** property whose meaning is fully carried
  by its type header (e.g. an AST node's `left` / `right` operands) need not repeat it. The goal is
  **why-coverage, never doc-for-doc's-sake** — a wall of "what" comments dilutes the load-bearing "why"s
  and is worse than a focused header.

- **This discipline is machine-checked** (a lightweight `scripts/arch` doc-conformance test —
  `doc-conformance.test.ts`, part of `bun run arch`): every **exported** symbol must carry a doc block, and every
  **exported function** with parameters must have a `@param` for each, so the rule cannot silently erode
  as Phase 2 grows. The check asserts **presence**, not quality — the why-vs-what judgement stays a
  review responsibility.

- **Notably complex code gets an extra inline comment.** Short (1–3 lines) use `// …`; longer
  explanations use a block comment:

  ```
  /*
   * First line of the explanation.
   * Second line …
   */
  ```

### Tickets (issues) — Definition of Ready / Done

Agents write the tickets too; hold them to the same bar as code.

- **Definition of Ready** (before a ticket is worked): a scoped title with priority; **Context** (the
  problem/goal and *why* it exists); concrete scope — "decisions to make" for an ADR, or **testable
  acceptance criteria** for implementation; links to the parent epic and related ADRs/issues; and any
  constraints (legal/security/ADR references).
- **Definition of Done** (before closing): acceptance criteria met and **verified**; code **and docs**
  updated; CI green; the PR merged; for ADR tickets the ADR is `Accepted` and the index/`STATUS.md`
  synced; the ticket closed via a `Closes #NN` line in the PR body — written as **plain text**, never
  inside a code span/backticks, or GitHub silently won't auto-close the issue (this bit us on issue #16).

### Agent guardrails

- **Read before writing.** Before changing code in a package/app/plugin, check `docs/STATUS.md`, the
  owning ADR(s), the affected manifests, and existing tests. Do not invent packages, folders or
  abstractions that no Accepted ADR covers.
- **Do not implement ahead of a decision.** If a task would settle in code something a still-*Planned*
  ADR owns — realtime/presence (0024), personal-data event payloads (0023), telemetry (0019),
  compliance/consent flows (0015) — write or update the ADR/issue first; don't decide it silently in
  code. (ADR 0011 and ADR 0021 were `Planned` when this list was written; both are now `Accepted` —
  check `docs/adr/README.md` for the current set rather than trusting this parenthetical over time.)
- **Never commit real sensitive data.** No real personal data, secrets, API keys, tokens, or
  copyrighted rulebook text in tests, fixtures, snapshots, or logs — use obvious fakes.
- **Domain commands and events express intent** — no generic `setField`/`updateEntity` commands or
  events for event-sourced aggregates; events are past-tense and intention-revealing (ADR 0004).
- **Tests are deterministic** — abstract time, randomness, storage, network, AI and secrets behind
  ports/fakes; prefer pure Domain/Application tests over adapter/E2E. (Full strategy: ADR 0017.)
