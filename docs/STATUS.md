# Grimora — Project status & next steps

> Living handoff note between working sessions. Last updated: **2026-07-12**.
> The binding architecture lives in the ADRs (`docs/adr/`); this file is only the progress/handoff overview.
> Stable working rules (not the current state) live in `CLAUDE.md`.
>
> **Maturity legend** (so "decided" is never read as "built"): each capability sits at one of —
> **planned** (ticketed, not yet designed) · **designed** (an Accepted ADR, no code) · **prototype**
> (walking-skeleton / in-memory fake only) · **tested-against-fakes** (real domain/application logic
> exercised over in-memory adapters) · **real-adapter** (a production adapter, exercised end-to-end).
> **An Accepted ADR is `designed`, not `built`.** Per-port adapter status (Real/Fake) is tracked in
> [`ports-catalog.md`](ports-catalog.md); the ✅ / phase markers below are feature-level progress.

## Where we stand

- **Phase 0 (foundation):** ✅ complete — monorepo scaffold (bun + Turborepo + biome),
  `tsconfig.base.json` (strict), CI (`.github/workflows/ci.yml`), `docker-compose` (Postgres + MinIO
  + self-hosted auth via `gotrue` + optional Ollama), `packages/shared-types`, ADR / `docs/legal/` structure.
- **Phase 1 (architecture as ADRs):** ✅ complete — **Epic #1 closed 2026-07-10.** The architectural
  foundation is worked out as ADRs and merged one PR at a time. **21 ADRs Accepted** (0001–0012 + 0014 +
  0015 + 0017 + 0020–0025) in the Phase-1 run; a 22nd (**ADR 0027**, `apps/api` framework/structure) and
  23rd (**ADR 0028**, rules-execution contract dependency) were added later in Phase 2. The first implementation ticket (conformance harness, #9) is done and merged
  (`scripts/arch/` + `.dependency-cruiser.cjs`, wired as the CI `arch` step). "Done" here = the
  *architecture-ADR run + the walking-skeleton gate*; the operational carry-overs (#71/#72, #76 done
  2026-07-11) continue as tracked tickets outside the closed epic (see the close-out cut below).
- **Phase 2 (core engine / first vertical slice):** ✅ **closed 2026-07-12** (epic #10; close-out tracked in
  #181). The rule-agnostic offline-first core is a real app, built one PR at a time against the Phase-1
  ports: local **event store** + rebuildable **read-model projections** (#103/#104, native `bun:sqlite` +
  browser OPFS), the **`apps/web` PWA** with the DSA5 character-sheet flow + a character picker (#105), real
  **authorization** (#106), **auth binding** (#120, email+password over the `apps/api` proxy, ADR 0012 §5 +
  the §13 device→account first-bind), and **cloud sync end-to-end** (#107 — `apps/api` sync endpoints +
  Postgres event store + JWKS actor-binding; the client `@grimora/offline-sync` push **and** pull with
  idempotent local apply; a character index/picker for a visible cross-device view), all live-verified
  against the real `grimora-dev` Supabase project. The owner-approved **Option A** (push + pull + visible
  cross-device view) is fully delivered; cross-device **co-editing** + the domain **rebase** are the
  deliberately-deferred next step (#176). **Deferred/gated, carried into the backlog** (not Phase-2 blockers):
  #176, consent #73, DSAR #74, Impressum #72, the dev "Reset all" removal #134, the architecture-backlog
  ADRs (#15/#18/#23/#82), the docs site (#82/#83), and the follow-ups this phase surfaced (#182 worker
  structured errors, #183 stream-scoped pull). **Phase 3** opens from this audited baseline — see #181 for
  the close-out checklist and the Phase-3 framing.
- **External audit follow-up (2026-07-12):** two independent AI audits of the auth→sync vertical (both at
  `738abf8`) were **verified against the code** (not taken at face value) and triaged into DoR tickets
  **#185–#196**. No critical code defect; the local DoD chain stays green. Highest-priority items: **#185**
  (P1 — a same-browser **account-switch** could misattribute local events to the wrong cloud account; a
  defensive binding-gate ships as the interim mitigation, full model tracked there); **#187** (server
  sync-ingress trust gates — owner-approved as a **named, triggered ADR-0024 deviation**); and **#186** (the
  persistence-boundary integrity family — batch validation + id-content compare on the replicate/cloud paths).
  Client robustness #188, limits/pagination #189, worker lifecycle #190, atomic char-create #191, the
  ephemeral-Postgres test #192, migration hardening #193, LoggerPort #194, multi-tab #195, and tooling #196
  round out the backlog. The root `README.md` + `apps/api/README.md` (which still described auth/sync as
  unbuilt) and the migration's crypto-shredding comment were corrected in the same pass.
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
  #134). The `apps/api` framework/structure decision then landed (ADR 0027, #137/PR #139), **real
  authorization** landed (#106/PR #141), and the remaining ADR-mandated **conformance fitness functions**
  landed (#76 — default-deny, determinism, SDK re-export, privacy-classification completeness,
  UI-reads-read-models-only, `/testing` production-import guard, the `plugin-sdk` boundary/language-leak
  rule, and the per-aggregate version-uniqueness skeleton-fidelity fix). Then a long **2026-07-11/12
  session** (driven by a three-way cross-model review) cleared a whole correctness/doc backlog and, its
  landmark, **re-homed the shared rules-execution contract into a new `@grimora/rules-contract` leaf**
  (ADR 0028 — fixes the `Domain→plugin-sdk` boundary violation + the event-payload durability hazard at the
  root) and scaffolded the **Art. 30 RoPA** legal doc (#71). Details in the *Cross-model review* +
  *What's next* sections below.

### Auth → cloud-sync vertical (2026-07-12 session)

The **first cloud vertical** landed this session — the app now authenticates against a real Supabase
project and replicates its offline events to the cloud:

- **Supabase provisioned** (owner) — project `grimora-dev`, new-style publishable/secret keys, asymmetric
  ES256 JWTs (JWKS), Data API off (the client never queries Postgres directly; `apps/api` uses a direct
  connection). Reproducible runbook: `docs/ops/supabase-setup.md` (#167).
- **#120 — auth binding (email+password):** the `AuthPort` contract (E1), the `apps/api` auth proxy
  (E2 — access token in memory, refresh token in an `HttpOnly` cookie, ADR 0012 §5), the web `AuthPort`
  adapter + login UI (E3), and the ADR 0012 §13 device→account **first-bind** (E4). OAuth-only is the
  deferred end state (email+password first — owner, 2026-07-12).
- **#107 — cloud sync**, delivered in slices: **slice 1** the `events` table migration (#174, RLS as
  defense-in-depth), **slice 2** the `apps/api` sync endpoints + Postgres event store + JWKS JWT
  verification with hard actor-binding (#175, ADR 0024 §2), **slice 3a** the client `@grimora/offline-sync`
  adapter (HTTP `SyncPort`) + push orchestration + the "Sync now" trigger (#177), and **slice 3b** the
  **pull** half — `pullPending` + the durable event-store `replicate` (idempotent local apply, on top of
  the #151 idempotency fix) + the OPFS worker plumbing + the view re-projecting after a pull. Each slice was
  live-verified end-to-end against real `grimora-dev` (login → JWKS → Postgres push/pull/dedup/conflict; the
  client stack pushing real events attributed to the account; and a two-"device" round-trip: A pushes, B
  pulls + applies).

**Scope decision — "Option A" (owner-approved 2026-07-12), and its consequences.** Cloud sync ships in two
capability steps rather than all at once:

- **Push (slice 3a, done):** offline → cloud. *Consequence:* a signed-in device durably backs up its
  locally-created events to the cloud, attributed to the account by the server (JWT → `owner_id`).
- **Pull (slice 3b, done):** cloud → local **pull** + idempotent local apply (`replicate`) + the view
  re-projects, so a signed-in device receives the account's cloud events into its local log and an open
  character reflects cloud updates.
- **Visible cross-device view (slice 3c, done):** a read-model **character index** + a **picker** in the UI
  (plus a "New character" affordance), so a character that arrived via pull — which has a sheet but was never
  this device's local "current" one — can be browsed and opened. Browser-verified (Playwright). **With this,
  Option A is fully delivered**: push, pull, and a visible cross-device view.
- **Deferred (issue #176):** cross-device **co-editing** (editing an aggregate created on another device). *Consequence to be aware of:* under the ADR 0012
  §13 "Reading 2" device-principal model, a device can *view* an aggregate created on another device (the
  cloud attributes it to the account) but **cannot edit** it, because local owner-only authorization
  (ADR 0009 / #106) sees the other device's pseudonym as owner. Resolving this needs the Reading 1↔2
  identity decision — tracked in **#176**, not silently decided in code. Until then, the rebase
  re-application on a `conflict` is also deferred: slice 3a **parks** any `conflict` (never drops it), and
  under Option A conflicts do not arise in normal single-device use (only the origin device writes a stream).

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
| 0028 | Rules-execution contract dependency & event-payload type stability (Phase 2): re-home the shared rules-execution contract (formula/dice/roll/RNG + privacy helpers) into a new stable `@grimora/rules-contract` leaf that both `core-domain` and `plugin-sdk` depend on; SDK re-exports (plugin surface unchanged); fixes the Domain→plugin-sdk drift + the payload-typing durability hazard at the root; owner-authorized amendments to ADR 0003 §2.1/§3 + ADR 0025 §2 (R1–R4) |

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

- ✅ **#76 — remaining ADR-mandated fitness functions — done** (2026-07-11): default-deny `PolicyPort`
  (`default-deny.test.ts`), no-`Math.random`/`Date.now`/wall-clock in the formula interpreter, seeded RNG
  *and* plugin Behaviour code (`determinism.test.ts`), the SDK re-export boundary (`sdk-reexport.test.ts`,
  derived live from `ports.ts`, never hardcoded), privacy-classification completeness
  (`privacy-classification.test.ts`), UI-reads-read-models-only and the `/testing` production-import
  guard (both now `.dependency-cruiser.cjs` rules), plus the `sdk-no-plugin-leak` import rule closing the
  ADR 0003 §9 boundary/language-leak gap for `plugin-sdk`. The **per-aggregate `version` uniqueness**
  skeleton-fidelity gap (ADR 0024 §3 amendment) is also closed: `InMemoryEventStore.replicate` now
  rejects a duplicate `(aggregateId, version)` exactly like the real SQLite adapter already did, so a
  version-collision bug fails in tests too, not only in production. Two items remain genuinely
  unassertable and are explicit `test.skip` placeholders, not silently missing: the **consent gate**
  (ADR 0015 §10, needs `ConsentPort` — #73) and **realtime-never-persisted** (ADR 0024 §9, needs a
  realtime adapter — after #107). So "green `arch`" now means every *assertable* ADR-mandated fitness
  function holds, with the two port-gated exceptions named above.
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

### Phase 2 — first slice: ✅ complete (closed 2026-07-12; the log below is the record)

> **Status:** Epic **#10** is **done** — the vertical slice is complete through cloud sync (see the
> *Phase 2 … closed* bullet under *Where we stand* and the close-out epic **#181**). The detailed
> ticket-by-ticket log below is kept as the historical record of how the slice was built; it is no longer a
> "next up" list.

Epic **#10** (Phase 2 — Core engine) was **unblocked** and **implemented** one PR at a time. The planning
pass broke #10 into a small, ordered, *testable* ticket set for **one thin vertical slice** (proportionate,
**not** a speculative dump).

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
  - ✅ **#120 (E) — auth binding** (PRs #169/#171/#172/#173-era E1–E4) — `AuthPort` + the `apps/api` auth
    proxy (access token in memory, refresh token in an `HttpOnly` cookie, ADR 0012 §5) + the web login UI +
    the ADR 0012 §13 device→account first-bind. Owner decision settled: **email+password now** over a local
    **`apps/api`** (OAuth-only is the deferred end state). Live-verified against real Supabase.

**✅ Merged this slice, since (2026-07-11):**
- ✅ **#106 — Real authorization** (PR #141) — `createRoleMatrixPolicy`
  (`packages/core-domain/src/application/policy.ts`) replaces the owner-only `createOwnerPolicy` fake at
  the `apps/web` composition root (the fake stays for tests, ADR 0017 R1). Two owner decisions settled
  first (2026-07-11): **only the character owner may write** — a GM does *not* get write access to a
  player's character through this port, not even for a campaign they run (a future GM table-assist tool
  would be its own named `PolicyAction`, not a blanket grant folded into these two); and
  **existence-before-authz is NotFound-uniform** — an unauthorized actor on an *existing* character now
  gets the identical `character.not_found` error a genuinely absent one would (never a distinguishable
  `Forbidden`), closing the id-enumeration oracle ADR 0010 §1 names. The full `Role` vocabulary
  (owner/gm/player/spectator) is part of the `PolicyResource.actorRole` port surface and unit-tested
  across all four roles (`policy.test.ts`), but only the `owner` branch is reachable in production until a
  campaign-membership read model exists (#107/#120) — spectator read-scoping is deliberately left to the
  query/sync layer, not this command port. The ADR 0012 §13 unbound-device identity needed no special
  case: it already satisfies the ordinary owner check for everything it creates locally.

**✅ Completed since (2026-07-12) — the slice's final piece:**
- ✅ **#107 — Sync adapter** (PRs #168/#174/#175/#177/#178/#179/#180) — the full cloud-sync vertical:
  `apps/api` sync endpoints + Postgres event store + JWKS actor-binding (ADR 0024 §2); the client
  `@grimora/offline-sync` adapter with **push** + **pull** (idempotent local apply via `replicate`, on the
  #151 idempotency fix); a character index/picker for a visible cross-device view. Owner-approved **Option
  A** delivered; co-editing + rebase deferred to **#176**. Stream-scoped pull → **#183**.

**Still deferred / gated (carried into the backlog, not slice blockers):**
- **#176** co-editing + Reading 1↔2 identity + rebase · **#73 / #74** Consent / DSAR (need
  `ConsentPort` / `CryptoPort`) · **#182** worker structured errors · **#183** stream-scoped pull.

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

**#106 (real authorization) and #76 (remaining conformance fitness functions) are both done and merged**
(2026-07-11, PR #141 / PR #143) — the two Phase-2/Phase-1-carry-over pieces that could move without the
owner's cloud setup did, per the two owner decisions recorded above (#106) and the ticket's own
implement-what's-assertable-now scope (#76). **With this, the *original* Phase-2 slice work that could
move without cloud setup was done** — a 2026-07-11 cross-model review has since reopened an agent-ready
correctness/doc backlog (see *Cross-model review* below). What remains from the *original* slice is
either **trigger-gated to Phase 3+** (ADR 0014 §3) or genuinely **owner-gated**:

- **#107 — sync adapter** + the `apps/api` sync endpoints (a cloud Postgres `EventStorePort`), and **#120
  (#105-E) — auth binding** (client → Supabase Auth directly, ADR 0011 §9): both need a **provisioned
  Supabase project + secrets** (owner setup; first external-network integration). #107 also unblocks
  #106's deferred `gm`/`player`/`spectator` `actorRole` resolution (needs campaign membership), and the
  two `pending-fitness-functions.test.ts` placeholders (consent gate needs `ConsentPort`/#73; realtime-
  never-persisted needs a realtime adapter, after #107).
- **#73 / #74 — Consent / DSAR**: blocked on `ConsentPort`/`CryptoPort`, not yet built.

### What's next (2026-07-12) — Phase 2 closed; Phase 3 opens from an audited baseline

**Phase 2's vertical slice is complete** (the whole auth → cloud-sync path shipped this session: Supabase
provisioned; #120 auth binding; #107 sync push/pull/view; #151 idempotency fix). The **close-out pass is
tracked in #181** (docs current, completed epics closed, deferred concerns each ticketed). What remains is
**deliberately deferred or owner-gated** — nothing agent-ready and decision-free is waiting:

1. **#176 — cross-device co-editing** + the Reading 1↔2 identity resolution + the domain **rebase** on
   conflict/divergence. The deferred half of Option A and the natural first Phase-3 feature; needs the
   identity decision before code (a CLAUDE.md "stop and ask"). Related tech follow-ups: **#182** (worker
   structured errors), **#183** (stream-scoped pull, ADR 0024 §4).
2. **#72 — Impressum + ToS.** The **only already-triggered** legal item (§5 DDG plausibly triggers on the
   public repo today, ADR 0015 R2/§9); **highest non-technical priority.** Owner/legal content, not code.
3. **#71 legal TODOs.** The RoPA scaffold is merged; it needs owner legal input — controller identity,
   signed DPAs per processor, DPF/TIA per US AI provider, retention periods. **Go-live-gated** (no processor
   handles real personal data yet — the dev Supabase holds only fake smoke data).
4. **#73 / #74 — Consent (`ConsentPort`) / DSAR (`CryptoPort`).** Blocked on those ports (not built); the
   cloud/auth prerequisite they shared now exists, so these become buildable once their ports are designed.
5. **Trigger-gated ADRs** (owner decides whether the trigger has fired): **#18 ADR 0016 A11y/i18n** is the
   most plausibly-relevant now (a real UI exists); then #15 (0013 perf), #23 (0019 analytics), #82 (0026
   user docs).
6. **Housekeeping:** **#134** — remove the dev-only "Reset all" button before the first real deployment.

**The clearest single next step is an owner decision** — most likely the **#176 identity model** (to open
Phase 3's co-editing work) or **#72 Impressum** (the already-triggered legal obligation).

✅ **Done / not open (this phase):** the full Phase-2 vertical (see the *Phase 2 … closed* bullet above);
**#151** closed via #178; the completed epics **#10 / #105 / #107 / #120** closed at the 2026-07-12
close-out. Live smoke scripts (`apps/{web,api}/scripts/*-smoke.ts`) are intentionally **out of CI** (they
need `grimora-dev` secrets) and are run manually against real Supabase — their headers document this.

### Cross-model review (2026-07-11) — derived backlog

The owner ran three external whole-repo reviews (2× ChatGPT of differing vintage + Claude Fable,
code-verified against `main`); each checkable claim was verified against source before triage (method
logged in `docs/meta/agent-collaboration-log.md`). It produced **8 issues (#147–#154)**:

- **Docs/hygiene (agent-ready):** #147 README refresh + `bun run dev` quickstart fix (**merged**, PR #155)
  · #148 doc/config hygiene batch (`clear` glob, `.env`/comment drift, lint warnings — **merged**, PR #161)
  · #149 maturity-labeling pass (the "Accepted ADR ≠ implemented" note + a STATUS maturity legend —
  **merged**, PR #164).
- **Core-correctness (agent-ready, on the path to #107):** #150 character-sheet projection idempotency
  under re-delivery — per-sheet `lastPosition` watermark (ADR 0004 §5, **merged**, PR #157) · #152 guard
  non-finite (NaN/Infinity) numeric inputs in the domain (**merged**, PR #159) · #151 event store maps a
  duplicate event-`id` to `Conflict` instead of an idempotent no-op — **deferred to #107/#154**: the
  SQLite `replicate` path does not exist yet (it lands with the sync adapter) and its idempotency /
  same-id-different-content semantics are exactly what the sync-protocol ADR must decide, so fixing it now
  would front-run that decision.
- **Owner-decision tickets:** #153 reconcile the **Domain→`plugin-sdk`** import vs ADR 0003 §2.1 +
  SDK-`0.x` payload stability — **decided & implemented** (ADR 0028 Accepted; the shared rules-execution
  contract now lives in the new `@grimora/rules-contract` leaf, SDK re-exports; ADR 0003 §2.1/§3 + 0025 §2
  amended, owner-authorized; a `domain-only-shared-types-and-rules-contract` fitness function enforces it)
  · #154 a sync-protocol design ADR — **closed as redundant**: the protocol is already owned by ADR 0005
  (§3/§4) + ADR 0024 (§2/§3/§5/§9); the real remaining work is #107 (implementation, owner-gated).

The reviews' **strategic** layer (Event-Sourcing-as-default, over-architecture, SDK-freeze timing) was
assessed as owner-roadmap opinion colliding with Accepted ADRs and deliberately **not** converted to
tickets; RNG-predictability, plugin sandboxing and DoS-limits are documented-accepted (ADR 0024 R3) or
trigger-gated to third-party plugins.

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
