# Grimora — Project status & next steps

> Living handoff note between working sessions. Last updated: **2026-07-11**.
> The binding architecture lives in the ADRs (`docs/adr/`); this file is only the progress/handoff overview.
> Stable working rules (not the current state) live in `CLAUDE.md`.

## Where we stand

- **Phase 0 (foundation):** ✅ complete — monorepo scaffold (bun + Turborepo + biome),
  `tsconfig.base.json` (strict), CI (`.github/workflows/ci.yml`), `docker-compose` (Postgres + MinIO
  + self-hosted auth via `gotrue` + optional Ollama), `packages/shared-types`, ADR / `docs/legal/` structure.
- **Phase 1 (architecture as ADRs):** ✅ complete — **Epic #1 closed 2026-07-10.** The architectural
  foundation is worked out as ADRs and merged one PR at a time. **21 ADRs Accepted** (0001–0012 + 0014 +
  0015 + 0017 + 0020–0025) in the Phase-1 run; a 22nd, **ADR 0027** (`apps/api` framework/structure), was
  added later in Phase 2. The first implementation ticket (conformance harness, #9) is done and merged
  (`scripts/arch/` + `.dependency-cruiser.cjs`, wired as the CI `arch` step). "Done" here = the
  *architecture-ADR run + the walking-skeleton gate*; the operational carry-overs (#71/#72/#76) continue as
  tracked tickets outside the closed epic (see the close-out cut below).
- **Walking skeleton built (gate passed):** ✅ #61 / PR #64 — the **first real code beyond
  `shared-types`**: provisional-v0 `packages/plugin-sdk` + `packages/core-domain` (with a
  `/testing` fakes subpath) + minimal `plugins/dsa5` + an `apps/skeleton-walk` composition root and
  runnable `walk`. All six ADR 0022 §9 pass criteria green (golden path, replay determinism, sync
  convergence, roll-carry, authz parity, `arch` green on real modules). Kept as the **seed** of the real
  core (0022 R1). The gate surfaced two real refinements (harness: `apps/*` exempt from the
  `src/index.ts` entry rule; SDK: formula `if`-node `then`→`whenTrue`/`whenFalse`).
- **Repo state:** `main` has the skeleton packages, all `.vscode/` workspace settings (#65/#66/#68), and
  ADR 0025 (#69) + ADR 0015 (#70) + ADR 0023 (#81) + ADR 0024 (#85) + ADR 0012 (#87) + ADR 0014 (#88), all
  Accepted, plus owner-authorized amendments from the 2026-07-09 cross-model review (#77–#80: ADR 0021
  formula-AST, 0025 §7, 0004 metadata-PII, 0015 transfer-mechanism; #86: ADR 0021 §2 + 0010 §1 cross-refs)
  and the web-framework decision (#87: ADR 0002 Next.js → **Vite + React**, ADR 0011 §9; #88 also synced
  the stale `hosting.md` web-frontend line to match). Since then a **documentation-hardening** pass landed
  (#95–#97: the refined CLAUDE.md doc rule + a machine-checked `scripts/arch/doc-conformance.test.ts`, now
  part of `bun run arch`, plus the source brought up to the standard), a `Closes #NN` PR-hygiene caveat
  (#98), the `/feierabend` and `/moin` session skills (#99/#101), and the Phase-2 planning pass (#100,
  this section). The Phase-2 planning-pass artefacts then landed (#102 ADR 0012 §13 offline-session
  identity + #108 ports-catalog/STATUS sync), and **Phase 2 implementation has begun** — see the
  "Phase 2 — first slice" section below for the vertical-slice tickets already merged (event store,
  read models, formula nodes, event-payload privacy, the **first browser app shell** —
  `apps/web` scaffold #105-A/PR #121, the **OPFS/WASM SQLite drivers** for both stores, #105-B/PR #124,
  the **offline composition root** #105-C/PR #126, and the **minimal character-sheet view** #105-D/PR #128 —
  **Grimora now runs as a real app in a browser**: create a DSA5 character, edit traits with the derived
  value recomputing live, roll a check, and it all persists across a reload, fully offline). A small tooling
  change also landed: a **curated primary-verb
  script convention** (`check`/`clear`/`refresh`/`serve`/`test:coverage`, documented in CLAUDE.md,
  #122 — `bun run check` runs the full local DoD chain). Post-milestone hardening then landed from the
  owner's own manual test of the app: the Playwright e2e now runs **in CI** (#130), a stale-service-worker
  bug (dev showed an old shell) + a missing `turbo serve` task were fixed (#131), and a **dev-only "Reset
  all"** button that wipes all local state was added (#135, ticket #133; removal-before-launch tracked in
  #134). **No open PRs at time of writing** — everything merged/cleaned up.

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
| 0014 | DevOps: CI/CD, IaC, environments & backup/DR: hardened CI gate (+ ADR 0010 §7 security gates), Cloudflare Pages PWA delivery (per-PR preview + deploy-on-merge, atomic rollback), Local/Preview/Prod (staging trigger-gated), config-in-repo IaC (OpenTofu when triggered), least-privilege CI secrets + rotation runbook, key-store-separate backup (ADR 0023 §5), event-sourced DR (RPO ≤ 24h / RTO ≤ 1 business day) (R1–R4) |
| 0015 | Compliance & data protection (DSGVO ops): event-sourced/scoped consent (ConsentPort), resource-scoped external-AI consent + all-subjects transfer rule (point E), DSAR over crypto-shredding + Art. 12(3) SLA, required RoPA + processor/DPA/TIA register, DPIA screening, ToS ≥16 (R1–R4) |
| 0017 | Testing strategy: 5-layer pyramid, port/plugin-SDK contract tests, `bun test`+Playwright+fast-check, qualitative coverage bar |
| 0020 | Core-vs-plugin boundary (rule-agnostic meta-model) |
| 0021 | Rules Execution: formula AST, generic dice/roll model, seeded-RNG determinism, roll event schema |
| 0022 | Walking Skeleton gate: core/backend vertical slice (not UI E2E), provisional-v0 SDK shapes, deterministic in-memory validation, pass criteria |
| 0023 | Event-payload privacy: declarative per-field classification (validated at load, SDK privacy metadata), metadata pseudonyms, per-subject DEK crypto-shredding (offline-distributed), graceful degradation (Constraint D), external-AI exclusion mechanism (R1–R3) |
| 0024 | Realtime session, presence & sync-trust: durable/ephemeral split, social-contract sync-trust (hard tenancy/provenance, own-aggregate fabrication bounded), visibility-by-stream-routing, on-grant backfill, RealtimePort (Supabase Realtime), deterministic rolls kept (R1–R3) |
| 0025 | Plugin-SDK v0 contract freeze: `0.x` semver line (not permanent), skeleton-validated surface frozen, hard security boundary, 1.0/registry trigger-gated (R1–R3) |
| 0027 | apps/api backend framework & structure (Phase 2): Hono (runtime-portable, OpenAPI-first), code-first generated OpenAPI SSOT, apps/api as a composition root (route↔use-case, problem+json), Bun canonical + node-compatible; a minimal walking-skeleton scaffold validates it — full build trigger-gated to Phase 3+ (R1–R4) |

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
11. ✅ **ADR 0014 — DevOps: CI/CD, IaC, environments & backup/DR** (#16) — Accepted 2026-07-09 (PR #88).
    The operational-delivery layer over the fixed stack (no new package/port/mechanism): the existing CI
    gate is reused and only **hardened** (+ ADR 0010 §7 security gates; SBOM + PR-time `bun audit`
    trigger-gated); web delivery = Vite PWA on **Cloudflare Pages** (per-PR preview + deploy-on-merge,
    atomic rollback); **Local/Preview/Prod** environments with a dedicated **staging trigger-gated** and
    hard prod-data isolation; **config-in-repo IaC** now (OpenTofu at the trigger; Bicep rejected);
    least-privilege CI secrets in GitHub Environments + a **rotation runbook** operationalizing the
    ADR 0023 §5 **key-store-separate-backup** invariant; and **event-sourced backup/DR** (event log +
    master data + object storage + key store are the backup set — read models rebuild by replay) with
    rough RTO/RPO and a go-live backup/DR gate feeding ADR 0015 §6. Owner decisions R1–R4 (staging
    trigger-gated; config-in-repo now + OpenTofu at trigger; RPO ≤ 24h / RTO ≤ 1 business day as targets,
    not SLAs; managed backups + one independent off-Supabase event-log dump). Also synced the stale
    `hosting.md` web line. **Follow-ups opened:** `docs/ops/` rotation + restore runbooks, first verified
    test restore, PR-time `bun audit` step when gate-stable.

    **→ With this, the currently-planned architecture-ADR run (items 1–11) is complete.** What remains is
    the trigger-gated backlog (item 12) — pulled into a real ADR only when its trigger fires.
12. **Trigger-gated backlog** (not blocking now): ADR 0013 perf budgets (#15), ADR 0019 Analytics (#23),
    ADR 0016 a11y/i18n (#18), ADR 0026 user-docs / handbook site (#82, Epic #83 — Diátaxis, in-repo
    static site, i18n; depends on 0012/0016; trigger: a usable product to document). Further
    deferred/trigger-gated topics (asset pipeline, plugin
    registry/signing & DX, authz-matrix depth, conflict/undo UX, search, notifications, monetization +
    Widerrufsbutton, mobile security) are tracked in **Epic #52** — promoted to real tickets only when
    their trigger fires.

Extend the harness rules (#9, merged) in parallel as `core-domain`/adapters/plugins actually appear
(the forward-looking rules then bite automatically).

### Phase-1 close-out & accepted carry-overs into Phase 2 (explicit cut)

**What "Phase 1 done" means here (stated explicitly so it is not ambiguous):** the **architecture-ADR
run is complete** (21 ADRs Accepted) and the **walking-skeleton gate passed** — the *design* is decided
and validated on a single-device slice. Phase 1 is **not** claimed to mean "every ADR invariant is
implemented/enforced." A second, **code-verified** cross-model review (2026-07-09; ChatGPT + Claude
Fable, findings verified against source — logged in `docs/meta/agent-collaboration-log.md`) confirmed the
design is strong but surfaced enforcement/doc gaps, now triaged. The following are **deliberately carried
into Phase 2** as accepted, tracked carry-overs (not silently dropped):

- **#76 — remaining ADR-mandated fitness functions** (default-deny `PolicyPort`, consent gate, no-`Math.random`,
  SDK re-export, privacy-classification presence, UI-reads-read-models-only, realtime-never-persisted,
  per-aggregate `version` uniqueness, `/testing` production-import guard). Until these land, "green `arch`"
  means *import boundaries hold*, not *every ADR invariant is machine-checked*.
- **#92 — apply ADR 0023 privacy classification to the skeleton event seed** (the first mandatory Phase-2
  refactor: per-field classification + fail-fast loader + `describe()` redactable degradation).
- **#71 — RoPA / processor / DPA / TIA / DPIA register**; **#72 — Impressum / ToS** (the *only already-triggered*
  legal item — the public repo plausibly triggers §5 DDG today, ADR 0015 R2 — highest non-technical priority).
- **Authz-matrix depth** (Epic #52) — the skeleton policy is owner-only by design; the concrete
  roles×actions×resources matrix + the existence-before-authz unification (use-cases inline note) are Phase-2.
- **Offline-session semantics** (cold-start offline: who is the local user? guest/local-only? multi-user
  per device?) — a real ADR 0012/0009 gap, to be settled (small amendment/ADR) when the web shell is built.

**Fixed immediately in this batch (2026-07-09 review):** conformance-harness scope holes (PR #89:
plugin→plugin, plugin→node-builtins, deep-import scope, secrets-port layout contract); CI reproducibility
(PR #90: bun/action pinning); ADR amendments for the roll×visibility seam + the 0014 §2 erratum (PR #91);
and inline-doc accuracy + explicit skeleton boundaries (this PR). None of the carry-overs above blocks
starting Phase 2 — but the Phase-2 slice should stay a **real vertical slice** (local store, projections,
web shell, authz, privacy envelope), not "core engine in general", so the enforcement catches up with the
ADRs rather than lagging them.

### Phase 2 — first slice: in progress (planning done 2026-07-10; implementation underway)

Epic **#10** (Phase 2 — Core engine) is **unblocked** and **implementation has begun**. The planning pass
broke #10 into a small, ordered, *testable* ticket set for **one thin vertical slice** (proportionate,
**not** a speculative dump); the first tickets are now **merged**.

**Settled first (it shaped the ticket scoping): offline-session identity.** Who is the local user on a
cold offline start? Owner decision: the **device is an implicit local user** until the first successful
online login binds it to a real account — recorded as an **amendment to ADR 0012 §13** (PR #102, merged).
This is why #105 and #106 below explicitly incorporate it.

**Merged this slice so far (2026-07-10):**
- ✅ **#103 — Local event-store adapter** (PR #109) — real `EventStorePort` on `bun:sqlite`
  (`packages/event-store`): durable append-only log, optimistic concurrency → `Conflict`, exclusive
  `readStream`/`readAll`, real `UNIQUE(aggregate_id, version)` (closes the #76 version-uniqueness item at
  the storage layer). **Native-first**; OPFS/WASM web driver **deferred to #105** (needs a browser to
  verify). Shared `eventStoreContract` runs against the fake *and* the adapter.
- ✅ **#104 — Persistent read-model projections** (PR #110) — real `ReadModelStorePort` on `bun:sqlite`
  (`packages/cqrs-read`): checkpointed, `clear()`-rebuildable; the `characterSheet` projection runs
  end-to-end over the real event store + read-model store (build / idempotent / rebuild-from-0 identical).
  Shared `readModelStoreContract`. OPFS web driver also deferred to #105.
- ✅ **#75 — Extended formula-AST nodes** (PR #111) — `floor`/`ceil`/`round`/`mod` added to the SDK AST +
  builder + interpreter (ADR 0021 §1 amendment); `round` ties away from zero, `mod` is floored
  (consistent with integer division = `floor(div)`), div/mod-by-zero fail as errors.
- ✅ **#92 — Event-payload privacy classification** (PR #112) — the first mandatory privacy refactor
  (ADR 0023 §2/§6/§8): additive SDK privacy surface (`PrivacyClass`/`privacy`/`PrivacyClassification` +
  `validateClassification` fail-fast + `Redactable`/`redactView`), core payloads classified, and
  `describe()` degrades ("Character created" when the name is redacted) as a **compile-time** obligation.
  **Pending on `CryptoPort`** (not built): field-encryption + the §8 "no `personal*` plaintext in store"
  guard — status cross-linked on #76.

**Still open in the slice:**
- **#105 — `apps/web` shell** (epic) — **decomposed with the owner (2026-07-11)** into sub-issues
  #116–#120, with two decisions settled: **Milestone-1 is offline-only** (no auth/Supabase — the device
  is the implicit local user per ADR 0012 §13; auth is split out into #120), and the browser store is the
  **real OPFS SQLite adapter** (not an interim store). Progress:
  - ✅ **#116 (A) — scaffold** (PR #121): `apps/web` (Vite + React PWA) + `packages/ui` +
    `packages/design-tokens` — the **first browser-visible app shell**. PWA hand-rolled (manifest + minimal
    SW), not workbox (see PR #121); presentation kept **plain/neutral greyscale** pending a later design
    decision. `packages/design-tokens` is a hand-authored placeholder until the ADR 0007 generation pipeline.
  - ✅ **#117 (B) — OPFS/WASM SQLite drivers** (PR #124): both adapters refactored to an engine-neutral
    `SqlDriver` layer (native `bun:sqlite` + browser `./opfs`), reusing one shared SQL implementation.
    VFS = OPFS **SAHPool** → **no COOP/COEP / no SharedArrayBuffer** (verified at sqlite.org) — simplifies
    the deploy vs. the ticket's original assumption. Native contract tests still green (behaviour preserved);
    OPFS drivers typecheck+build; the **runtime browser smoke + Vite WASM wiring** (handed to #105-C, both
    needing a real browser) **landed in PR #126** — #117's in-browser confirmation is now done.
  - ✅ **#118 (C) — composition root + §13 offline identity** (PR #126): the `apps/web` composition root
    wires the OPFS event/read stores + system `ClockPort` + production **UUIDv7** `IdGeneratorPort` +
    owner-only `PolicyPort` fake + plugin host, around the ADR 0012 §13 implicit device identity (device =
    implicit local user, persisted in `localStorage` as installation config — a documented, reversible
    choice, superseded by #120's account bind). The **OPFS-is-worker-only** constraint surfaced here:
    SAHPool needs a Web Worker, so the stores run in a worker (`apps/web/src/store/`) behind main-thread
    proxies over a typed `postMessage` RPC, with the constraint absorbed at the composition edge (the
    hexagon sees only the ports). **Closes #117's in-browser IOU:** a green Playwright smoke proves event
    persistence *and* §13 identity reuse across a reload in headless Chromium; the prod `vite build` bundles
    the sqlite-wasm module + worker as assets. Also fixed a latent #105-B bug (both OPFS adapters shared one
    SAHPool VFS name → access-handle collision when opened together; now distinct default pools).
  - ✅ **#119 (D) — minimal character-sheet view** (PR #128): **the milestone — Grimora runs as a real app
    in a browser.** Create character → view/edit DSA5 traits with the derived LP recomputing live → roll the
    perception check → **reload and everything persists** (the OPFS proof through the real UI). Built on a
    hand-rolled, dependency-free reactive read-model layer (`useSyncExternalStore`, owner decision) — command
    → projection → notify → re-render (ADR 0012 §3); the view reads **only** through `ReadModelStorePort`
    (ADR 0012 §2/§11). DSA5 plugin now loaded at the composition root; new plain `Button`/`Field` primitives
    in `packages/ui`; a golden-journey Playwright test (create → edit → roll → reload) is green.
  - **#120 (E, deferred)** — auth binding (AuthPort + login + §13 first-bind); the `apps/api`-vs-direct-Supabase
    owner decision lives here.
- **#106 — Real authorization** — `PolicyPort` + the Owner/GM/Player/Spectator role×action×resource
  matrix, replacing the owner-only skeleton policy; the existence-before-authz unification; the ADR 0012
  §13 unbound-device (`Owner`) case (ADR 0009 §3). **Owner-domain design decisions** — do not settle
  silently in code.
- **#107 — Sync adapter** — insert-only replication + domain rebase vs. Supabase, defining the `SyncPort`
  interface (not yet in code) on the existing `sync-harness`. Prereq: a cloud-reachable `EventStorePort`
  (Postgres/Supabase) distinct from #103's local adapter (i.e. `apps/api`).
- **#73 / #74 — Consent / DSAR** — need `ConsentPort` / `CryptoPort`; partly blocked.

**Ports catalog** — [`docs/ports-catalog.md`](ports-catalog.md) tracks every port's implementation status;
`EventStorePort` and `ReadModelStorePort` are **Real** — native `bun:sqlite` (#103/#104) *and* browser
OPFS/WASM (#105-B), now wired and exercised **in a real browser** at the `apps/web` composition root
(#105-C). Keep it in sync with `packages/core-domain/src/application/ports.ts` as adapters land.

**Clearest next step:** the **offline vertical slice's visible milestone is complete** (#105-A→D merged) —
Grimora boots, persists, and is usable in a browser with no login/network. **The `apps/api` backend question
is now settled:** the boundary was already decided (a modular-monolith `apps/api`, ADR 0003 §8, + the ADR
0011 contract — the earlier "apps/api-vs-direct-Supabase" framing was a mischaracterization; the client talks
to `apps/api`, and to Supabase only for the auth JWT). **ADR 0027** then fixed the deferred framework/structure
(Hono, code-first OpenAPI, `apps/api` as a composition root, Bun/node-compatible), and a **minimal
walking-skeleton scaffold** landed (#137/PR #139) validating it with running code.

What remains — the **cloud half** — is **trigger-gated to Phase 3+** (ADR 0014 §3) and owner-gated:

- **#107 — sync adapter** + the `apps/api` sync endpoints (a cloud Postgres `EventStorePort`), and **#120
  (#105-E) — auth binding** (client → Supabase Auth directly, ADR 0011 §9): both need a **provisioned
  Supabase project + secrets** (owner setup; first external-network integration).
- **#106 — real authorization** (Owner/GM/Player/Spectator matrix replacing the owner-only skeleton policy)
  is **owner-domain design** (ADR 0009 §3) — do not settle in code first.

✅ **Done / not open:** `apps/web` e2e in CI (#130); the `apps/api` framework/structure decision + scaffold
(ADR 0027 / #139). Outstanding trigger-gated follow-up: **#134** — remove/hide the dev-only "Reset all"
button before the first real deployment (acted on at ADR 0014 hosting), not now.

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

## Session tooling (Claude Code skills)

Repeatable procedures under `.claude/skills/` (checked into the repo, invoked as `/<name>`):

- **`grimora-adr-author`** — authoring/reworking an ADR (branch → `Proposed` → PR-with-owner-questions →
  `Accepted`, house style, index/`STATUS` sync).
- **`moin`** — session bring-up / orientation (the counterpart to `feierabend`): brief the project identity
  & goal, standing rules & skills, since-when, the last few work units, the current state and the single
  clearest next step from the living docs, and flag (do not run) any due recurring maintenance, then ask
  whether coffee is ready and whether we continue as planned. Read-only; **orients, does not start work** —
  it ends with a question.
- **`feierabend`** — session wind-down / close-out: tidy git & branch state, finish or safely park
  in-flight work at an honest stopping point, bring the living docs current (this file, the meta-log,
  memory), run any due recurring task, then a hand-off summary + "Schönen Feierabend". Deliberately does
  **not** start new work or merge PRs (the owner merges).
- **`weiterimtext`** — mid-session task transition (the seam between two units of work, warm counterpart
  to `moin`/`feierabend`): after the owner merges a PR, verify it actually landed, tidy git/branch state,
  bring the living docs current (re-checking external state first so a parallel session's changes are not
  duplicated), then re-validate the next task against current reality and start it on a fresh branch
  **only if agent-ready and decision-free** — otherwise surface the decision and stop (gated autonomy).
  Keeps the session context; re-verifies the external world. Does not merge PRs.

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
