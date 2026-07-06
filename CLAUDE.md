# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Grimora is an **engine-agnostic tabletop RPG platform**: the core is independent of any rule system;
concrete rule systems (first *Das Schwarze Auge 5* / DSA5) are **plugins**. See `docs/vision.md` for
the full product vision. The project is currently in **Phase 1 (architecture-as-ADRs)** — most of
`apps/` and `packages/` are still scaffold-only; only `packages/shared-types` has real code today.
Check `docs/STATUS.md` for the current phase/next-step snapshot before starting work.

## Commands

```bash
bun install                 # install workspace deps
docker compose up -d        # Postgres + MinIO (add --profile ai for local Ollama)
bun run dev                 # turbo dev (all workspaces)
bun run lint                # biome check (lint + format check)
bun run lint:fix            # biome auto-fix
bun run typecheck           # turbo typecheck (all workspaces)
bun run arch                # architecture conformance harness (dependency-cruiser + fitness tests)
bun run test                # turbo test (all workspaces)
bun run build                # turbo build (all workspaces)
```

Scope to one workspace with turbo's filter, e.g. `bunx turbo run test --filter=@grimora/shared-types`.
To run a single test file directly, `cd` into the package and use Bun's test runner (tests are
colocated `*.test.ts`, e.g. `packages/shared-types/src/index.test.ts`):

```bash
bun test src/index.test.ts          # from inside the package dir
bun test src/index.test.ts -t "ok"  # filter by test name
```

CI (`.github/workflows/ci.yml`) runs, in order: install (frozen lockfile) → lint → typecheck → arch →
test → build. Keep changes green against all of these before considering work done. The `arch` step is
the architecture conformance harness (`scripts/arch/`, issue #9): it enforces the ADR 0003 §2
dependency rule and related security boundaries — see `scripts/arch/README.md`.

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
`@grimora/plugin-sdk` — declarative Definition APIs (JSON-Schema-validated) + pure Behaviour APIs (no
ambient I/O/network/DOM). Capabilities: rule system, theme, content pack, UI extension, AI tools,
import/export — each namespaced by plugin id. Multiple plugins run simultaneously; one rule system
binds per character (never two), themes/content packs/AI tools are additive.

**Event Sourcing + CQRS** (ADR 0004/0005): user-generated aggregates (characters, campaigns, NPCs) are
event-sourced — immutable, past-tense, intention-revealing events (`character.attributeRaised`, not
generic field-setters), folded to derive state. Read models are rebuildable projections; the UI never
reads the event store directly. Master/reference data (plugin catalogs, auth records) is classic
relational, *not* event-sourced. Local store = SQLite (native/OPFS); cloud = Supabase Postgres with
RLS; sync is custom event-log replication (insert-only, conflict-free) with git-like domain **rebase**
for genuine concurrent-edit conflicts.

**Theming** (ADR 0007): a theme is design tokens (JSON, `packages/design-tokens`), generated to
per-platform artifacts (CSS custom properties / RN theme objects) — no runtime CSS-in-JS. UI consumes
only **semantic** tokens, never primitives. Resolution cascade, most specific wins: character override
› player's per-campaign override › GM's campaign theme › player's global preference › rule-system
default › app base.

**AI provider abstraction** (ADR 0008): the AI chat is an *additional, non-privileged* control layer
over the same public API — `AiProviderPort` (Claude/OpenAI/Ollama, swappable), tools are descriptors
over existing use-cases (same authz/validation as the UI, no special AI path). Tools are contributed
by core **and** plugins into one namespaced registry. A future MCP server (§8 of ADR 0008) is planned
as *another* inbound adapter over that same registry — plugins never need their own network API for
this.

**Cross-cutting: errors, logging, auth** (ADR 0009): `Result<T,E>` (from `shared-types`) for expected
failures + an `AppError` hierarchy (per-bounded-context subclasses, namespaced error codes, i18n
keys, closed category set incl. `RateLimited`). `LoggerPort` → pino (BE) / Sentry (FE), PII-redaction
enforced at the adapter, never by convention. `AuthPort` (Supabase Cloud + self-hosted Supabase/GoTrue,
wired in `docker-compose.yml`) is separate from `AuthorizationPort` (RBAC: Owner/GM/Player/Spectator,
enforced in the Application layer); Postgres RLS is defense-in-depth, never the sole gate.

## Working conventions specific to this repo

- **Bugs before features** — always prioritize fixing a bug over new work.
- **ADRs are the source of truth for architecture.** An `Accepted` ADR is immutable **except with
  explicit owner authorization**, recorded in that ADR's *Amendments* section (ADR 0001). Otherwise a
  new decision needs a superseding ADR, not an edit.
- **Per-ADR workflow**: branch `adr/NNNN-slug` from `main` → write the ADR (`Status: Proposed`, update
  `docs/adr/README.md`) → open a PR with open review questions for the owner → owner merges → sync
  `main`, flip `Proposed → Accepted` (ADR file + index) as a direct follow-up commit on `main`, delete
  the branch. See recent history (ADR 0008/0009) for the pattern in practice.
- **`plugins/dsa5` ships mechanics/structure only** — no copyrighted Ulisses Spiele text or values
  (`docs/legal/dsa5-content-boundary.md`). `rulebooks/` is git-ignored (only its README is tracked) —
  never commit rulebook PDFs.
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

### Delivery workflow & PRs

- **Every change goes on a branch and through a PR — never commit directly to `main`** (the one
  documented exception is the ADR `Proposed → Accepted` status flip above). **The owner merges every
  PR.** After a merge, sync `main`, prune, and delete the merged branch.
- **One concern per PR** — split unrelated changes so each stays reviewable in isolation.
- **Commits & PRs:** Conventional Commits (`type(scope): summary`, imperative subject, body explains the
  *why*); end commit messages with the `Co-Authored-By` trailer and PR bodies with the Claude Code line.
  A PR body states **what**, **why**, how it was **verified**, and any **merge-order** caveats. Branch
  prefixes: `adr/…`, `feat/…`, `fix/…`, `chore/…`, `docs/…`.
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
  choose.
- **Verify external facts from primary sources** (library/tool capabilities, legal deadlines, API
  details) rather than asserting from memory; cite the source.
- **Scale decisions to the project's actual stage** (solo, pre-revenue, no public launch): prefer a
  trigger-gated backlog over speculative up-front work and avoid over-engineering — but record deferred
  concerns so nothing is lost.
- **Language:** code, code comments, ADRs, and normative docs (e.g. `SECURITY.md`), plus commit
  messages, PR titles/bodies and issues, are written in **English**; operational handoff notes
  (`docs/STATUS.md`, `docs/recurring-tasks.md`) are currently kept in **German**; direct conversation
  with the owner is in **German**.

### Code documentation & comments

Comments explain **why**, not **what** — the purpose, who needs it, the preconditions/constraints —
never a paraphrase of what the code obviously does. Verbose is fine: clarity (especially for AI agents)
outweighs brevity, even though it enlarges the code. Keep docs **current**: whenever code changes,
update the affected inline docs **and** the relevant Markdown (ADRs, `STATUS.md`, `README`s, `docs/…`)
in the *same* change — stale documentation is a defect.

- **Every file, class, and function carries a block header** documenting its purpose and, for functions,
  **every parameter** (plus return/throws where relevant). Always use the multi-line JSDoc form —
  **never** the single-line `/** … */`:

  ```
  /**
   * Why this exists / what it is for / who needs it / the conditions.
   * @param foo  what it means and any constraints
   * @returns   what the caller gets back
   */
  ```

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
  synced; the ticket closed via `Closes #…`.
