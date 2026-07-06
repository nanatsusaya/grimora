# Grimora — Project status & next steps

> Living handoff note between working sessions. Last updated: **2026-07-07**.
> The binding architecture lives in the ADRs (`docs/adr/`); this file is only the progress/handoff overview.
> Stable working rules (not the current state) live in `CLAUDE.md`.

## Where we stand

- **Phase 0 (foundation):** ✅ complete — monorepo scaffold (bun + Turborepo + biome),
  `tsconfig.base.json` (strict), CI (`.github/workflows/ci.yml`), `docker-compose` (Postgres + MinIO
  + self-hosted auth via `gotrue` + optional Ollama), `packages/shared-types`, ADR / `docs/legal/` structure.
- **Phase 1 (architecture as ADRs):** 🟡 in progress — the architectural foundation is worked out as
  ADRs and merged one PR at a time. **10 ADRs Accepted** (0001–0010 + 0020). The first implementation
  ticket (conformance harness, #9) is done and merged (`scripts/arch/` + `.dependency-cruiser.cjs`,
  wired as the CI `arch` step).
- **Repo state:** `main` in sync with `origin/main`. `LICENSE` (MIT) is at the repo root. All merged
  branches are cleaned up (only `main` remains locally and remote).

### Accepted ADRs

| ADR | Topic |
| --- | --- |
| 0001 | ADR process (+ owner-authorized amendments) |
| 0002 | Tech stack & tooling (bun/biome/Supabase/Expo) |
| 0003 | Overall architecture: Hexagonal / Ports & Adapters + DDD (§9) + security-by-design (§6) |
| 0004 | Event Sourcing & CQRS |
| 0005 | Persistence & offline-first sync |
| 0006 | Plugin system (multi-plugin activation, theme cascade) |
| 0007 | Theming (design-tokens SSOT, GM/Player/Hero cascade) |
| 0008 | AI provider abstraction (default Claude Haiku, external only after consent; §8 MCP as future adapter) |
| 0009 | Cross-cutting: error taxonomy, logging (pino+Sentry), auth (Supabase Cloud + self-hosted GoTrue), RBAC (Owner/GM/Player/Spectator) |
| 0010 | Security & Privacy by Design (STRIDE threat model, plugin sandbox, `SecretsPort`/`CryptoPort`, crypto-shredding for DSGVO erasure, security fitness functions for #9) |
| 0020 | Core-vs-plugin boundary (rule-agnostic meta-model) |

### New: EU/DE compliance matrix

`docs/legal/eu-de-compliance-matrix.md` (PR #32) — living table of every researched EU/DE regulation
(DSGVO transfers, AI Act Art. 50, Cyber Resilience Act, BFSG, DSA, NIS2, Data Act, Widerrufsbutton,
JMStV, Digital Fairness Act) with an applicability assessment, deadline and lead ADR. Two deadlines
are near-term: **AI Act Art. 50** (chatbot disclosure) on **2 Aug 2026**, **Widerrufsbutton** from
**19 Jun 2026**. Two topics (Widerrufsbutton, JMStV) have no lead ADR yet — open gap for ADR 0010/0015.

## Next steps (revised order)

Order **reprioritized** after the external ADR review (2026-07-07, see below) — no longer strictly
numeric, but implementation-blocking ADRs first. All under **Epic #1**; Epic #10 = Phase 2 core engine
(blocked).

1. **ADR 0011 — API design & contracts** (#13) — unblocks UI/AI/sync/MCP/error mapping. **← current focus.**
2. **ADR 0021 — Rules Execution: formula/dice/deterministic runtime** (#41, new) — before plugin-SDK v0
   & DSA5; hinges on the sandbox question (DSL vs. arbitrary TS code).
3. **ADR 0017 — Testing strategy** (#19) — pulled forward; must precede event-store/sync/SDK code.
4. **ADR 0022 — Walking Skeleton / Golden Use Cases** (#42, new) — a thin vertical slice as
   architecture validation, before broad Phase-2 code.
5. **ADR 0015 — Compliance ops + consent** (#17) — early (Impressum gap, AI-consent scoping = constraint E).
6. **ADR 0012** (#14, before `apps/web`) · **ADR 0014** (#16, before cloud sync / real users).
7. **Trigger-gated backlog** (not blocking now): ADR 0023 Event-Payload-Privacy (#43, before real
   aggregates), ADR 0024 Realtime/Presence (#44), ADR 0013 perf budgets (#15), ADR 0019 Analytics (#23),
   ADR 0016 a11y/i18n (#18); further: asset pipeline, plugin registry/signing, authz-matrix depth,
   conflict/undo UX, search, notifications, monetization, mobile security, plugin DX.

Extend the harness rules (#9, merged) in parallel as `core-domain`/adapters/plugins actually appear
(the forward-looking rules then bite automatically).

### External ADR review (2026-07-07) — assessment & consequences

An external review rated the accepted ADRs (0001–0010, 0020) as an **above-average foundation on the
static architecture boundaries**, with real gaps in *runtime behaviour*. Derived from it (deliberately
**not** the full ~10 proposed ADRs — much is trigger-gated backlog for a solo/pre-revenue project):

- **New ADRs created:** 0021 Rules Execution (#41), 0022 Walking Skeleton (#42),
  0023 Event-Payload-Privacy (#43), 0024 Realtime/Presence (#44).
- **Reprioritized:** 0011 API & 0017 Testing pulled forward; Walking Skeleton as the Phase-2 entry gate.
- **Captured constraints:**
  - *A:* conformance harness extended with a `shared-types` leaf guard (no import of other packages) —
    own PR (`feat/arch-shared-types-guard`).
  - *D:* event-description API must **degrade gracefully** for crypto-shredded fields → in #43.
  - *E:* AI consent must be **resource-/group-scoped** (other players' data in the prompt) → in #17.

### Follow-ups from ADR 0010

- ✅ **Private Vulnerability Reporting** enabled (owner, 2026-07-06).
- ✅ **`SECURITY.md`** at the repo root (points to PVR, "no public issues for security bugs", supported
  versions) — PR (chore/adr-0010-followups).
- ✅ **`.github/dependabot.yml`** — **github-actions only** (weekly). JS/TS version updates deliberately
  *not* via Dependabot: it does not update `bun.lock` in bun workspace monorepos
  ([dependabot-core#14223](https://github.com/dependabot/dependabot-core/issues/14223)), so every JS PR
  fails `--frozen-lockfile`. JS security fixes are covered by **Dependabot alerts**; routine freshening
  manually via `bun update`.
- ✅ **Owner toggle:** **Dependabot alerts** + **security updates** enabled (owner, 2026-07-07,
  org-wide). Secret scanning + push protection also on → ADR 0010 §7 dependency-scanning gate covered.

## Per-ADR workflow

1. Branch `adr/NNNN-slug` from current `main`.
2. Write the ADR file; set the index row in `docs/adr/README.md` to **Proposed**.
3. Open a PR (`Closes #<issue>`) with the open review questions for the owner.
4. Owner reviews & merges.
5. Sync `main`, flip status **Proposed → Accepted** (ADR file + index), delete the branch.

## Key constraints (must not be violated)

- **Accepted ADRs** may only be changed with **explicit owner authorization** → recorded in the
  *Amendments* section (ADR 0001).
- **Bugs before features.**
- **DSA5 plugin:** mechanics/structure only, **no** copyrighted Ulisses content
  (`docs/legal/dsa5-content-boundary.md`).
- **`rulebooks/`** is git-ignored (only the README tracked) — **never** commit rulebook PDFs.
- **Secrets/API keys** only at the composition root, never in Domain/plugins/logs.
- **AI:** external providers only after consent; AI has no privileged path (tools = public API).

## References

- Architecture decisions: `docs/adr/` (index: `docs/adr/README.md`)
- Vision/roadmap/hosting: `docs/vision.md`, `docs/roadmap.md`, `docs/hosting.md`
- Rule-systems comparison: `docs/research/rule-systems-comparison.md`
- EU/DE legal situation: `docs/legal/eu-de-compliance-matrix.md`
- Stable working rules for Claude Code: `CLAUDE.md`
- GitHub backlog: Epic #1 (Phase 1), Epic #10 (Phase 2, blocked)
