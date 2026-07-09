# Grimora — Project status & next steps

> Living handoff note between working sessions. Last updated: **2026-07-09**.
> The binding architecture lives in the ADRs (`docs/adr/`); this file is only the progress/handoff overview.
> Stable working rules (not the current state) live in `CLAUDE.md`.

## Where we stand

- **Phase 0 (foundation):** ✅ complete — monorepo scaffold (bun + Turborepo + biome),
  `tsconfig.base.json` (strict), CI (`.github/workflows/ci.yml`), `docker-compose` (Postgres + MinIO
  + self-hosted auth via `gotrue` + optional Ollama), `packages/shared-types`, ADR / `docs/legal/` structure.
- **Phase 1 (architecture as ADRs):** 🟡 in progress — the architectural foundation is worked out as
  ADRs and merged one PR at a time. **20 ADRs Accepted** (0001–0012 + 0015 + 0017 + 0020 + 0021 + 0022 +
  0023 + 0024 + 0025) — the count was off by one in earlier revisions; corrected here against the index.
  The first implementation ticket (conformance harness, #9) is done and merged (`scripts/arch/` +
  `.dependency-cruiser.cjs`, wired as the CI `arch` step).
- **Walking skeleton built (gate passed):** ✅ #61 / PR #64 — the **first real code beyond
  `shared-types`**: provisional-v0 `packages/plugin-sdk` + `packages/core-domain` (with a
  `/testing` fakes subpath) + minimal `plugins/dsa5` + an `apps/skeleton-walk` composition root and
  runnable `walk`. All six ADR 0022 §9 pass criteria green (golden path, replay determinism, sync
  convergence, roll-carry, authz parity, `arch` green on real modules). Kept as the **seed** of the real
  core (0022 R1). The gate surfaced two real refinements (harness: `apps/*` exempt from the
  `src/index.ts` entry rule; SDK: formula `if`-node `then`→`whenTrue`/`whenFalse`).
- **Repo state:** `main` has the skeleton packages, all `.vscode/` workspace settings (#65/#66/#68), and
  ADR 0025 (#69) + ADR 0015 (#70) + ADR 0023 (#81) + ADR 0024 (#85) + ADR 0012 (#87), all Accepted, plus
  owner-authorized amendments from the 2026-07-09 cross-model review (#77–#80: ADR 0021 formula-AST,
  0025 §7, 0004 metadata-PII, 0015 transfer-mechanism; #86: ADR 0021 §2 + 0010 §1 cross-refs) and the
  web-framework decision (#87: ADR 0002 Next.js → **Vite + React**, ADR 0011 §9). No open PRs at time of
  writing — everything merged/cleaned up.

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
| 0011 | API design & contracts |
| 0012 | Web rendering & frontend state: offline-first PWA (client-rendered vs. local read-models, no SSR of user data), Vite+React (ADR 0002 amended from Next.js), thin state (domain in core-domain), secure token storage, consent UI, Cloudflare Pages (R1–R3) |
| 0015 | Compliance & data protection (DSGVO ops): event-sourced/scoped consent (ConsentPort), resource-scoped external-AI consent + all-subjects transfer rule (point E), DSAR over crypto-shredding + Art. 12(3) SLA, required RoPA + processor/DPA/TIA register, DPIA screening, ToS ≥16 (R1–R4) |
| 0017 | Testing strategy: 5-layer pyramid, port/plugin-SDK contract tests, `bun test`+Playwright+fast-check, qualitative coverage bar |
| 0020 | Core-vs-plugin boundary (rule-agnostic meta-model) |
| 0021 | Rules Execution: formula AST, generic dice/roll model, seeded-RNG determinism, roll event schema |
| 0022 | Walking Skeleton gate: core/backend vertical slice (not UI E2E), provisional-v0 SDK shapes, deterministic in-memory validation, pass criteria |
| 0023 | Event-payload privacy: declarative per-field classification (validated at load, SDK privacy metadata), metadata pseudonyms, per-subject DEK crypto-shredding (offline-distributed), graceful degradation (Constraint D), external-AI exclusion mechanism (R1–R3) |
| 0024 | Realtime session, presence & sync-trust: durable/ephemeral split, social-contract sync-trust (hard tenancy/provenance, own-aggregate fabrication bounded), visibility-by-stream-routing, on-grant backfill, RealtimePort (Supabase Realtime), deterministic rolls kept (R1–R3) |
| 0025 | Plugin-SDK v0 contract freeze: `0.x` semver line (not permanent), skeleton-validated surface frozen, hard security boundary, 1.0/registry trigger-gated (R1–R3) |

### New: EU/DE compliance matrix

`docs/legal/eu-de-compliance-matrix.md` (PR #32) — living table of every researched EU/DE regulation
(DSGVO transfers, AI Act Art. 50, Cyber Resilience Act, BFSG, DSA, NIS2, Data Act, Widerrufsbutton,
JMStV, Digital Fairness Act) with an applicability assessment, deadline and lead ADR. Two deadlines
are near-term: **AI Act Art. 50** (chatbot disclosure) on **2 Aug 2026**, **Widerrufsbutton** from
**19 Jun 2026**. Both formerly-unowned topics now have a lead ADR: **Widerrufsbutton → ADR 0015 §9**
(trigger-gated to a paid tier), **JMStV → ADR 0010 §8** (private-campaign-scoped visibility + reserved
age-gate hook, reaffirmed by ADR 0015 R4's ToS ≥16).

## Next steps (revised order)

Order **reprioritized** after the external ADR review (2026-07-07, see below) — no longer strictly
numeric, but implementation-blocking ADRs first. All under **Epic #1**; Epic #10 = Phase 2 core engine
(blocked).

1. ✅ **ADR 0011 — API design & contracts** (#13) — Accepted 2026-07-07; unblocks UI/AI/sync/MCP/error mapping.
2. ✅ **ADR 0021 — Rules Execution: formula/dice/deterministic runtime** (#41) — Accepted 2026-07-07;
   unblocks plugin-SDK v0 & DSA5. Formula AST + generic roll model + seeded-RNG determinism (see index).
3. ✅ **ADR 0017 — Testing strategy** (#19) — Accepted 2026-07-07; 5-layer pyramid, `bun test` +
   Playwright + fast-check, port/plugin-SDK contract tests, qualitative (not numeric) coverage bar.
4. ✅ **ADR 0022 — Walking Skeleton / Golden Use Cases** (#42) — Accepted 2026-07-07; **gate defined.**
   Scoped to a core/backend vertical slice (not UI E2E — resolves the 0017↔0012 tension), provisional-v0
   SDK shapes, deterministic in-memory validation, concrete pass criteria. Preceded by a full
   architecture-validation pass across all 14 accepted ADRs (findings F1–F7 folded into the ADR).
5. ✅ **Build the walking skeleton** (#61, PR #64) — the **Phase-1 → Phase-2 gate** passed; first real
   code beyond `shared-types`, kept as the **seed** of the real core (0022 R1). All 6 pass criteria green.
6. ✅ **ADR 0025 — plugin-SDK v0 contract freeze** (#62, from 0022 R3) — Accepted 2026-07-09 (PR #69).
   Freezes the SDK as a `0.x` semver line (real & depended-on, but not a permanent freeze): the
   skeleton-validated surface is stable within `0.x`; the security boundary is frozen hard; the five
   unvalidated trait kinds, plugin AI-tools and themes are *reserved*. Owner decisions R1–R3: 1.0 gated on
   DSA5 Phase 3 + a second rule system; JSON-Schema validation deferred to before the third-party registry
   opens; the third-party registry itself gated on 1.0.
7. ✅ **ADR 0015 — Compliance ops + consent** (#17) — Accepted 2026-07-09 (PR #70). The operational DSGVO
   layer over ADR 0010/0009: event-sourced/versioned/scoped consent (`ConsentPort`); resource-scoped
   external-AI consent + all-affected-subjects transfer rule (resolves constraint E); DSAR use-cases over
   crypto-shredding with the Art. 12(3) SLA; required RoPA + processor/DPA/TIA register; DPIA screening;
   AI-Act Art. 50 detail; trigger-gated Impressum / ToS / cookie (→0019) / Widerrufsbutton. Owner
   decisions R1–R4 (max-utility external AI once *all* affected subjects consent + Ollama as an opt-in
   sovereignty alternative; imprint timing; no DPIA now; ToS ≥16 for Art. 8). **Operational follow-up
   tickets opened** (RoPA/processor-register doc, ToS+imprint content, ConsentPort/consent-gate at Phase 2).
8. ✅ **ADR 0023 — Event-payload privacy (classification, per-subject keys, crypto-shredding)** (#43) —
   Accepted 2026-07-09 (PR #81). Pulled forward ahead of 0012/0014 (2026-07-09 cross-model review gate).
   Declarative per-field privacy classification (validated at load; additive SDK privacy metadata),
   metadata pseudonyms erased via the account mapping, per-subject DEK crypto-shredding
   (offline-distributed), graceful degradation (Constraint D), and the concrete external-AI exclusion
   mechanism resolving ADR 0015 §3/R1. Owner decisions R1–R3 (free-text all-members consent; residual
   erasure boundary accepted; minimal high-sensitivity encrypted subset).
9. ✅ **ADR 0024 — Realtime session, presence & sync-trust** (#44) — Accepted 2026-07-09 (PR #85). The
   last of the pulled-forward cross-model-review gates. Durable/ephemeral split (event log stays SoT,
   realtime is liveness-only); **social-contract sync-trust** (hard server enforcement of tenancy /
   actor-binding / provenance / cross-aggregate; own-aggregate fabrication a bounded, attributable
   residual); **visibility by stream routing** (+ per-audience encryption reusing 0023); **additive
   on-grant backfill** (no 0005 change); `RealtimePort` (Supabase Realtime, swappable); presence
   ephemeral / never event-sourced. Owner decisions R1–R3 (social-contract default; Supabase Realtime
   behind a mandatory port; deterministic rolls kept — predictability accepted for a hobby TTRPG).
   The two optional cross-reference amendments (ADR 0021 §2, ADR 0010 §1) were authorized and merged
   (#86); the previously-flagged 0021 §3 seed amendment is dropped (R3).
10. ✅ **ADR 0012 — Web rendering & frontend state** (#14) — Accepted 2026-07-09 (PR #87). Offline-first
    PWA (the authenticated app is client-rendered against local read-models; no SSR of user data),
    **Vite + React** (ADR 0002 amended from Next.js after a framework review), thin frontend state
    (domain stays in `core-domain`), secure token storage (in-memory access + HttpOnly/secure-store
    refresh), consent-capture UI, Cloudflare Pages hosting. Owner decisions R1–R3. Unblocks Playwright E2E
    (ADR 0017).
11. **ADR 0014 — DevOps: CI/CD, IaC, environments, backup/DR** (#16, before cloud sync / real users) —
    **← current focus.** Now has concrete inputs: the key-store-separate-from-data-backups invariant
    (ADR 0023 §5), read-model backup retention (ADR 0015 §4 / ADR 0023 §5), secret/key rotation ops
    (ADR 0010 §4), CI security gates + SBOM (ADR 0010 §7), DPA/TIA go-live gate (ADR 0015 §6).
12. **Trigger-gated backlog** (not blocking now): ADR 0013 perf budgets (#15), ADR 0019 Analytics (#23),
    ADR 0016 a11y/i18n (#18), ADR 0026 user-docs / handbook site (#82, Epic #83 — Diátaxis, in-repo
    static site, i18n; depends on 0012/0016; trigger: a usable product to document). Further
    deferred/trigger-gated topics (asset pipeline, plugin
    registry/signing & DX, authz-matrix depth, conflict/undo UX, search, notifications, monetization +
    Widerrufsbutton, mobile security) are tracked in **Epic #52** — promoted to real tickets only when
    their trigger fires.

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
