# ADR 0014 — DevOps: CI/CD, IaC, environments & backup/DR

- **Status:** Accepted
- **Date:** 2026-07-09 (accepted via PR #88, issue #16)
- **Deciders:** project owner + AI agents
- **Depends on:** [ADR 0002](0002-tech-stack-and-tooling.md) (bun/Turborepo/biome toolchain; Supabase
  EU, Cloudflare Pages, Fly.io/Hetzner hosting targets — as amended to Vite + React),
  [ADR 0003](0003-overall-architecture.md) (§2 dependency rule / `arch` conformance harness, §6
  adapters are the trust boundary, §7 ports incl. `SecretsPort` at the composition root only),
  [ADR 0004](0004-event-sourcing-cqrs.md) (immutable, append-only event log — the authoritative record
  DR restores), [ADR 0005](0005-persistence-and-sync.md) (§2 canonical Supabase events table, §5
  object storage, §6 read-models are rebuildable-by-replay, §7 every member device holds a replica),
  [ADR 0010](0010-security-and-privacy-by-design.md) (§4 secrets referenced by handle + rotation ops
  routed here, §7 CI security gates + SBOM), [ADR 0012](0012-web-rendering-and-state.md) (§1/§9
  offline-first PWA build; Cloudflare Pages hosting — R1), [ADR 0015](0015-compliance-and-data-protection.md)
  (§4 backup-retention feeds erasure-completeness, §6 processor/DPA/TIA go-live gate + EU residency),
  [ADR 0023](0023-event-payload-privacy.md) (§5 the key-store-backed-up-separately-from-data
  invariant this ADR operationalizes).
  Relates to [ADR 0011](0011-api-design.md) (API deployment surface — trigger-gated to cloud sync),
  [ADR 0017](0017-testing-strategy.md) (CI runs the test pyramid), [ADR 0024](0024-realtime-presence-sync-trust.md)
  (Realtime infra runs on the same Supabase project), [ADR 0025](0025-plugin-sdk-v0-contract.md) (SDK
  registry publishing is trigger-gated there, not here).

## Context

Operations decisions belong in the design, not after launch: reproducible delivery, environment
separation, and a recovery story that is defined **before** there is anything to lose (issue #16).
Grimora is offline-first, EU-region, free-tier-first, Docker-based and self-hostable
([`docs/hosting.md`](../hosting.md)): the **device is the primary source of truth**, the cloud is a
sync target / backup (ADR 0005). That posture makes several DevOps questions *smaller* than for a
server-of-record product — but it does not remove them, and it adds one they otherwise would not have
(a destroyed key store must not be resurrectable from a data backup — ADR 0023 §5).

**What earlier ADRs already fixed (this ADR operationalizes, it does not re-decide):**
- **CI already exists** and runs, in order, `install (frozen lockfile) → lint → typecheck → arch →
  test → build` ([`.github/workflows/ci.yml`](../../.github/workflows/ci.yml); CLAUDE.md). `arch` is
  the ADR 0003 §2 conformance harness (issue #9, merged).
- **ADR 0010 §7** committed **dependency- and secret-scanning as required blocking checks** and
  **SBOM at release once distributable artifacts exist**; **§4** made secrets **referenced by handle
  and wired only at the composition root** (`apps/*`), with **rotation as an operational procedure
  routed to this ADR**.
- **ADR 0002 / `hosting.md`** fixed the **stack and hosting targets**: GitHub + Actions (CI/CD),
  **Supabase** (Postgres + Auth + Storage, **EU region**), **Cloudflare** (Pages for the web app, R2
  for assets, CDN/DNS/WAF), **Fly.io / Hetzner** for an API service *only where needed*, **Expo EAS**
  (mobile) and **Tauri** (desktop) at their later phases.
- **ADR 0005** fixed the **stores and their recovery properties**: the canonical **append-only events
  table** in Supabase Postgres (§2) is the authoritative record; **read models are rebuildable from
  events by replay** (§6), so they are *derived*, not primary backup targets; **object storage** is a
  separate binary stream (§5); and **every authorized member device already holds a replica** of its
  streams (§7).
- **ADR 0023 §5** fixed the **invariant** that the crypto-shredding **key store is backed up
  *separately* from the event/read-model data**, with a retention policy such that restoring a data
  backup **cannot resurrect a destroyed key** — and explicitly assigned the **backup *ops*** to this
  ADR. **ADR 0015 §4/§6** fixed that **read-model-backup retention** bounds erasure-completeness (the
  residual window is disclosed in the RoPA), and that a **signed DPA (+ TIA for transfers) per active
  processor is a go-live gate**.

**What is genuinely open and owned here** (issue #16): the concrete **CI/CD delivery** (release &
deploy automation, preview deploys, where the security gates plug in); the **environment model** (how
many, how isolated, feature flags, deployment strategy); the **Infrastructure-as-Code** approach for a
deliberately minimal free-tier footprint; **secrets in CI** and the **rotation runbook**; and a
**backup & disaster-recovery** design with rough **RTO/RPO**, tied to the event-sourcing recovery
model and the key-store invariant above.

**Repo state:** Phase 1 — only `packages/shared-types` plus the walking-skeleton seed have real code;
no `apps/api`, no cloud deployment, no real users, no paid tier. This is a decision record against that
state, scaled to the project's actual stage (solo, pre-revenue, no public launch): it fixes **where
things run, how they are released, and how they are recovered**, and it **trigger-gates** everything
that would be speculative to build now, recording the trigger and the owner so nothing is lost
(CLAUDE.md "prefer a trigger-gated backlog … avoid over-engineering", "do not implement ahead of a
decision").

## Decision

### 1. Scope — operational delivery/ops over the fixed stack; no new architecture

This ADR introduces **no new package, port, runtime, or persistence mechanism**. It decides the
**operational envelope** around the already-fixed stack: the CI pipeline, the deploy/release flow, the
environment topology, the IaC posture, CI-secret handling + rotation, and backup/DR. Where a topic is
already owned elsewhere it is **cited, not re-opened**: security-gate *content* is ADR 0010 §7; the
*what/where* of the stores is ADR 0002/0005; the key-store *invariant* is ADR 0023 §5; the
*compliance* go-live gates are ADR 0015 §6. Where a topic would be premature to build (a dedicated
staging tier, full declarative IaC, a DR drill, SBOM tooling, API deployment), it is **trigger-gated**
with the trigger named in-line.

### 2. CI pipeline — the existing ordered gate, hardened with the ADR 0010 §7 security checks

The merge gate stays the **ordered, all-blocking** chain already in
[`ci.yml`](../../.github/workflows/ci.yml) and CLAUDE.md — **`install --frozen-lockfile → lint →
typecheck → arch → test → build`** — running on every PR and on `main`. Ordering is deliberate: cheap
static checks fail fast before the expensive ones. The harness's **import-boundary** rules (ADR 0003 §2)
run in `arch` and are enforced by CI **today**. The **call-graph / content** fitness functions —
default-deny `PolicyPort` (ADR 0010 §7.4), the external-AI consent gate (ADR 0015 §10), per-field
privacy classification (ADR 0023 §8), UI-reads-read-models-only (ADR 0012 §11) — are **not yet
implemented** (tracked in **#76**); CI is the enforcement *point* the moment they land, but a green
`arch` today means "import boundaries hold", **not** "every ADR invariant is machine-checked".
*(Corrected 2026-07-09 — see Amendments; the original wording claimed these were "already enforced by
CI", the same overclaim ADR 0025 §7 was amended for.)*

Added by this ADR (making ADR 0010 §7 operational):

- **Dependency vulnerability scanning** — GitHub **Dependabot alerts** (already enabled org-wide,
  STATUS.md) are the always-on baseline. Because Dependabot cannot open version-bump PRs against a bun
  workspace lockfile ([`dependabot-core#14223`](https://github.com/dependabot/dependabot-core/issues/14223)),
  routine freshening is manual (`bun update`) and **alerts** carry the security signal; a PR-time
  `bun audit`-style step is added **when bun's audit surface is stable enough to gate on** (trigger),
  so a red advisory blocks merge rather than only notifying.
- **Secret scanning + push protection** — GitHub-native, **already enabled org-wide** (STATUS.md);
  push protection **blocks** a secret from ever landing. This satisfies the ADR 0010 §7 secret-scan
  gate without a CI step of our own.
- **SBOM at release** — **trigger-gated to when distributable artifacts exist** (mobile/desktop,
  roadmap Phase 5/7; CRA-relevant per ADR 0010 §1). Not generated for the pure-SaaS web/API today.

Branch protection requires the gate green before merge; **the owner performs every merge** (CLAUDE.md).
Turborepo caching + affected-detection keep CI fast; a remote cache is optional and adopted only if CI
time becomes a felt cost (trigger).

### 3. Delivery — deploy & release automation per deployable, mostly trigger-gated

Delivery is decided **per deployable**, and most deployables do not exist yet:

- **Web app (`apps/web`)** — the only near-term deploy. Built by **Vite** into a static, offline-first
  **PWA** (ADR 0012 §1) and hosted on **Cloudflare Pages** (ADR 0012 R1). **Preview deploy per PR**
  (Pages' native per-PR preview URL) and **production deploy on merge to `main`**. No server runtime is
  needed for the app shell (it is client-rendered against the local store — ADR 0012), so a bad deploy
  cannot corrupt user data (the device is the source of truth, ADR 0005) and **Pages' atomic swap gives
  instant rollback** to the previous immutable deployment.
- **Public/marketing pages** — the small static generator (Astro) reserved by ADR 0002 / ADR 0026 rides
  the **same Pages pipeline**. Trigger: a public landing page actually exists.
- **API service (`apps/api`)** — **trigger-gated to cloud sync (Phase 3+)**; there is no server to
  deploy until then. When needed: a container image deployed to **Fly.io or Hetzner** (bun-native but
  kept **node-compatible** per ADR 0002), rolling deploy, health-checked. The push/pull sync and
  Realtime (ADR 0024) run on the same Supabase project, so the API is thin at first.
- **Plugin-SDK (`packages/plugin-sdk`)** — registry **publishing is trigger-gated to ADR 0025** (1.0 +
  third-party registry). It stays an internal workspace dependency on its `0.x` line until then; no
  publish pipeline now.

**Release model:** apps deploy **continuously from `main`** (no tagged-release ceremony at this
stage); the only semver-versioned artifact is the SDK's `0.x` line (ADR 0025 §1), and it is
workspace-internal until the registry opens. A tag/changelog release flow is trigger-gated to the first
externally-distributed artifact (SDK publish or mobile/desktop store submission).

### 4. Environments — Local / Preview / Production; no dedicated staging yet

Three logical environments, no more than the stage warrants:

- **Local** — `docker compose up -d` runs the whole stack with **no cloud** (Postgres, MinIO for
  object storage, self-hosted GoTrue, optional Ollama; [`docs/hosting.md`](../hosting.md)). Because of
  offline-first this is the **normal development case**, and it is also the **self-hostable
  one-box** deployment (the CRA/self-host promise, ADR 0010 §1).
- **Preview** — per-PR ephemeral Cloudflare Pages deploy, pointed at a **shared non-production**
  Supabase project (never production data).
- **Production** — Cloudflare Pages production + a **separate production** Supabase project, **EU
  region** (ADR 0015 residency).

**No separate long-lived Staging environment is created now** — local + per-PR preview cover
pre-production validation for a solo developer, and a standing staging tier is cost/maintenance the
stage does not warrant. **Trigger:** the first external testers or a paid tier → introduce a dedicated
staging environment then (**R1**).

**Data isolation (hard rule):** the production Supabase project is **separate** from every non-prod
environment, with its **own secrets**; **no non-production environment ever points at production
data**. Real user data lives **only** in production (DSGVO data-minimization, ADR 0010 §6 / ADR 0015).
This is an operational invariant on the go-live checklist, not a code test.

**Feature flags:** lightweight **config/env-driven flags evaluated at the composition root** (`apps/*`)
— not a third-party flag service (over-engineering at this scale). Flags gate **trigger-gated
product features** (paid tier, external-AI enablement, public content) for staged rollout; a flag
**never** stands in for an authorization decision (that is `PolicyPort`, ADR 0010 §2) or a consent gate
(that is `ConsentPort`, ADR 0015 §3). A managed flag service is trigger-gated to needing per-user/%
rollouts (not before).

**Deployment strategy:** **simple atomic/rolling deploy** — Cloudflare Pages atomic-swaps with instant
rollback; an API service (when it exists) uses Fly.io/Hetzner rolling deploys with health checks.
**Blue-green / canary are rejected** as over-engineering for the current scale: offline-first means a
bad web deploy loses no data, and instant rollback covers the failure case. Revisit only if a
zero-downtime SLA is ever promised (trigger).

### 5. Infrastructure as Code — config-in-repo now; declarative IaC trigger-gated

The production footprint is deliberately **a handful of click-configured managed free tiers**
(Supabase, Cloudflare, GitHub). For that, **config-in-repo is the IaC** — the reproducible sources of
truth already live, or will live, in the repository:

- **`docker-compose.yml`** — the IaC for the **local / self-host** stack (already exists,
  [`hosting.md`](../hosting.md)); one command reproduces the whole box.
- **Supabase schema, RLS policies and migrations** — versioned **migration files in-repo** (ADR 0005
  §6): the event/checkpoint tables, RLS, and server-side projections are code-reviewed and replayable,
  not click-configured.
- **Cloudflare Pages / Workers config** — `wrangler.toml` + the CI deploy config in-repo.
- **Repo & CI config** — `.github/workflows/*` and `.github/dependabot.yml` are already code.
  Org-level security toggles (secret scanning, Dependabot, PVR) are one-time click-ops **documented in
  STATUS.md** — acceptable click-config at this scale, not worth a provider IaC binding.

**Full declarative IaC (OpenTofu/Terraform or Pulumi) is trigger-gated.** Wrapping two managed SaaS
free tiers in Terraform is more ceremony than value today. **Trigger:** the infra outgrows click-config
— multiple cloud environments to reproduce identically, a self-managed VM/VM-fleet, or a second person
needing to stand up production from scratch. **When triggered, the recommended tool is OpenTofu** (the
open-source, Terraform-compatible fork — avoids the HashiCorp BSL licence question) with the **Supabase
+ Cloudflare providers**; Pulumi (real-language IaC) is the alternative if typed IaC in TypeScript is
preferred (**R2**). **Bicep is rejected** (Azure-only; we are not on Azure).

### 6. Secrets in CI & rotation — makes ADR 0010 §4 operational

- **CI/deploy secrets** live in **GitHub Actions encrypted secrets, scoped to GitHub *Environments***
  (a `production` environment holds the prod deploy tokens, gated by the environment's protection
  rules), injected as env vars at job time, **never** committed. This is consistent with ADR 0010 §4
  ("secrets only at the composition root"): CI/CD is a **trusted composition-root-adjacent zone**, the
  only non-`apps/*` place allowed to hold deploy credentials.
- **Least privilege:** each deploy token (Cloudflare Pages, Supabase, later Fly.io) is **scoped to the
  minimum** needed and **distinct per environment**; a preview token cannot touch production.
- **Rotation runbook** (the ops procedure ADR 0010 §4 routed here): every secret — JWT signing keys,
  provider API keys, DB credentials, deploy tokens — is **referenced by handle**, so rotation is
  "update the value in the manager + redeploy", **no code change** (ADR 0010 §4). Cadence:
  **routine rotation at least annually**, **immediate rotation on suspected compromise** (rotate +
  invalidate sessions, ADR 0010 §4) and **on contributor off-boarding**. Documented as a
  `docs/ops/` runbook (follow-up), not in this ADR text.
- **Crypto-shredding key store (ADR 0023 §4/§5) — the ops this ADR owns:** the per-subject DEKs and
  their wrapping keys are held in a **key store backed up on its own schedule, separately from the
  event/read-model data**, such that **restoring a data backup can never resurrect a key destroyed by
  an Art. 17 erasure** (ADR 0023 §5 invariant). Concretely: (a) the key-store backup is a **distinct
  backup stream** with its **own, independent retention**; (b) an erasure that destroys `DEK_S`
  destroys it **in the key-store backups too** (or, where a short key-store-backup window makes that
  impractical, that window is the **disclosed residual-erasure window** in the RoPA — ADR 0015 §4/§6).
  This closes the one DR question offline-first crypto-shredding adds.

### 7. Backup & disaster recovery — event-sourced recovery, rough RTO/RPO

**What is backed up (in priority order):**

1. **The canonical append-only events table** (Supabase Postgres, ADR 0004/0005 §2) — the authoritative
   record; the crown jewel. Everything user-facing is derivable from it.
2. **Relational master/auth data** — accounts, the **pseudonym → identity mapping** (ADR 0023 §3), the
   consent source, plugin/asset catalogs. Not event-sourced; must be backed up directly.
3. **Object storage** (assets: images/maps/tokens — ADR 0005 §5) — via bucket versioning / lifecycle on
   Cloudflare R2 / Supabase Storage.
4. **The key store** — backed up **separately**, per §6 / ADR 0023 §5.
5. **Read models are *not* a primary backup target** — they are **rebuildable from events by replay**
   (ADR 0005 §6); DR restores the log and **replays** projections. Where a read-model backup exists for
   restore-speed, its **retention bounds erasure-completeness** and is disclosed in the RoPA (ADR 0015 §4).

**Event sourcing + offline-first shrink the recovery surface.** Because read models are replays and the
event log is append-only/immutable, a restore is "restore the log + master data + keys, then replay" —
no fragile state reconstruction. And because **every active member device already holds a replica** of
its authorized streams (ADR 0005 §7), **total cloud loss is not total data loss**: the surviving device
replicas can re-seed the cloud. This is a genuine resilience property, not a substitute for backups.

**Backup mechanism:** rely primarily on **Supabase's managed backups** (daily automated; PITR on the
Pro tier when real users justify it) for Postgres; **object storage** via bucket versioning/lifecycle;
the **key store** on its own separate schedule. All backups stay **EU-region** (ADR 0015). For the
self-host case, the runbook documents `pg_dump` + volume snapshots. In addition, **one independent,
off-Supabase logical dump** of the (small, precious) event log is kept as vendor-loss insurance, added
**once real users exist** (**R4**) — managed backups alone would concentrate all DR trust in one vendor.

**RTO / RPO (rough, stage-scaled targets — not contractual SLAs pre-revenue):**

| Stage | RPO (max data loss) | RTO (max downtime) |
| --- | --- | --- |
| Phase 1–2 (local, no cloud users) | best-effort (data on dev device + git) | best-effort |
| Phase 3+ (cloud sync, real users) | **≤ 24 h** (daily backup; tighter with PITR) | **≤ 1 business day** (solo operator) |

The **effective** user-visible RPO is often **near-zero** for a user's own recent edits regardless of
cloud cadence, because those edits are still on their device (offline-first). Targets **tighten when a
paid tier / SLA commitment exists** (trigger); the owner accepted these as an **upper bound that may be
loosened rather than tightened** for a hobby project (**R3**).

**Restore procedure & DR drill:** the restore steps (restore events + master data + keys → replay
projections → smoke-test) are documented as a `docs/ops/` runbook (follow-up). A **live DR drill** (a
practised, timed test restore) is **trigger-gated to before the paid tier / real-user onboarding** —
running one drill is the point at which the RTO/RPO targets become verified rather than aspirational.

**Go-live backup/DR gate (this ADR's contribution to the ADR 0015 §6 checklist):** before real users
are onboarded — (a) managed backups verified **enabled** and **one test restore performed**; (b) the
**key-store-separate-backup** invariant (§6 / ADR 0023 §5) in place; (c) the **DPA/TIA processor gate**
(ADR 0015 §6) green.

### 8. Enforcement

- **CI is the single enforcement point:** the ordered gate (§2) is required and blocking on every PR;
  `arch` + the security/consent/privacy fitness functions (ADR 0003 §2, 0010 §7, 0015 §10, 0023 §8) run
  there. A red check blocks the merge the owner performs.
- **Environment/data isolation** (§4) and the **backup/DR go-live gate** (§7) are **operational
  checklist invariants** (separate Supabase projects, distinct least-privilege secrets, verified
  restore), not code tests — they live on the go-live checklist alongside the ADR 0015 §6 gates.
- **No new persistence/crypto/authz mechanism** is added, so no new dependency-cruiser rule is needed;
  the existing rules already forbid a secret leaving the composition root (ADR 0010 §7.1).

## Consequences

**Positive:** delivery, environments and recovery are **decided before there are users to harm**, at a
footprint honestly scaled to a solo/pre-revenue project — the existing CI gate is reused and only
*hardened*, not rebuilt; the offline-first + event-sourcing model makes DR **small and replay-based**
and gives a real "surviving device replicas can re-seed the cloud" resilience property; the **key-store
backup invariant** that makes crypto-shredding trustworthy (ADR 0023 §5) finally has an operational
owner; config-in-repo keeps the whole environment reproducible without premature IaC ceremony; and
every speculative piece (staging, full IaC, DR drill, SBOM, API/SDK deploy) is **trigger-gated with a
named trigger**, so nothing is built early and nothing is lost.

**Negative / costs:** relying on managed backups concentrates DR trust in **Supabase** as a single
vendor until the independent dump is added (**R4**); config-in-repo means some infra (org security
toggles) is **click-configured**, reproducible only via a documented checklist, not a single `apply`
— accepted now, revisited at the IaC trigger (**R2**); **no staging tier** means preview + local must
catch pre-production regressions (accepted for a solo dev, revisited at **R1**); the RTO/RPO targets
(**R3**) are **best-effort, not SLAs**, appropriate only while there is no paid commitment; and several
deliverables here (the `docs/ops/` rotation + restore runbooks, the first verified test restore) are
**follow-up tasks**, so this ADR's *operational* completeness depends on them landing at their triggers.

## Alternatives considered

- **A dedicated always-on staging environment now** — rejected as premature: local + per-PR preview
  cover pre-production for a solo developer; a standing staging tier is cost/maintenance without a user
  base. Trigger-gated (§4 / O1).
- **Full declarative IaC (OpenTofu/Terraform/Pulumi) from day one** — rejected now: more ceremony than
  value for two managed free tiers; config-in-repo + Supabase migrations already give reproducibility.
  Adopted at the named trigger (§5 / O2). **Bicep** rejected outright (Azure-only).
- **Blue-green / canary deployment** — rejected as over-engineering: offline-first loses no data on a
  bad deploy and Cloudflare Pages gives instant atomic rollback; simple atomic/rolling deploy suffices
  until a zero-downtime SLA is promised (§4).
- **Back up read models as primary DR targets** — rejected: read models are rebuildable-by-replay
  (ADR 0005 §6); backing them up as authoritative would duplicate state and *worsen* erasure-hygiene
  (more plaintext copies to age out, ADR 0015 §4). The event log + master data + keys are the backup set.
- **A third-party feature-flag service now** — rejected: config/env flags at the composition root cover
  staged rollout at this scale; a managed service is trigger-gated to per-user/% rollouts (§4).
- **Treat crypto-shredding key backup like any other data backup** — rejected: it would let a data-backup
  restore resurrect a destroyed key, breaking Art. 17 erasure (ADR 0023 §5). The key store is a
  separate backup stream with independent retention (§6).
- **A tagged-release / changelog ceremony for the apps now** — rejected: continuous deploy from `main`
  fits a solo project with no externally-distributed app artifact yet; the release flow is trigger-gated
  to the first published SDK / store submission (§3).

## Resolved questions (owner decisions, 2026-07-09)

- **R1 — Staging environment (§4).** Decided as recommended: **trigger-gated**. No dedicated staging tier
  now — for a solo developer, `Local` + per-PR `Preview` cover pre-production validation, and a standing
  staging Supabase project + Pages environment is cost/maintenance the stage does not warrant. A staging
  environment is stood up at the **first external testers / paid tier** trigger.
- **R2 — IaC commitment (§5).** Decided as recommended: **config-in-repo now** (docker-compose, Supabase
  migration files, `wrangler.toml`, `.github/`), with **full declarative IaC trigger-gated**. When the §5
  trigger fires (multiple reproducible cloud environments, a self-managed VM fleet, or a second person
  standing up production), the tool is **OpenTofu** (Supabase + Cloudflare providers — open-source,
  Terraform-compatible, avoids the HashiCorp BSL licence question); **Pulumi** remains the typed-IaC
  alternative. No pre-commitment beyond "OpenTofu when triggered"; **Bicep** is rejected (Azure-only).
- **R3 — Rough RTO/RPO targets for Phase 3+ (§7).** Decided as recommended: **RPO ≤ 24 h, RTO ≤ 1
  business day** for real cloud users (best-effort until then), explicitly as **targets, not contractual
  SLAs**, tightened only when a paid tier / SLA commitment exists. The owner noted these figures are, if
  anything, **conservative** for a hobby project — so they are treated as an **upper bound that may be
  loosened**, not a floor to invest below. The offline-first replica model already keeps the *effective*
  user-visible RPO near-zero for a user's own recent edits (still on their device), independent of the
  cloud backup cadence.
- **R4 — Independent off-Supabase event-log backup (§7).** Decided as recommended: **Supabase managed
  backups primarily, plus one periodic independent logical dump** of the (small, precious) event log,
  added **once real users exist**, as cheap vendor-loss insurance. Managed-backups-only was rejected —
  it would concentrate all disaster-recovery trust in a single vendor. The dump stays EU-region (ADR 0015).

## References

- [ADR 0002](0002-tech-stack-and-tooling.md) (toolchain + hosting targets, as amended to Vite + React),
  [ADR 0003](0003-overall-architecture.md) (§2 `arch` harness, §6 trust boundary, §7 ports),
  [ADR 0004](0004-event-sourcing-cqrs.md) (immutable event log — the record DR restores),
  [ADR 0005](0005-persistence-and-sync.md) (§2 canonical events table, §5 object storage, §6 replay-rebuild,
  §7 device replicas), [ADR 0010](0010-security-and-privacy-by-design.md) (§4 secrets/rotation routed
  here, §7 CI gates + SBOM), [ADR 0012](0012-web-rendering-and-state.md) (offline-first PWA build,
  Cloudflare Pages), [ADR 0015](0015-compliance-and-data-protection.md) (§4 backup retention → erasure
  completeness, §6 processor/DPA/TIA go-live gate, EU residency), [ADR 0023](0023-event-payload-privacy.md)
  (§5 key-store-separate-backup invariant), [ADR 0017](0017-testing-strategy.md) (CI runs the pyramid),
  [ADR 0024](0024-realtime-presence-sync-trust.md) (Realtime on the same Supabase project),
  [ADR 0025](0025-plugin-sdk-v0-contract.md) (SDK registry publishing trigger-gated),
  [`docs/hosting.md`](../hosting.md) (hosting components & cost outlook),
  [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) (the existing pipeline). Issue #16.

## Amendments

- **2026-07-09** — *Authorized by the project owner.* **§2 erratum (no decision change).** The original
  §2 claimed the ADR 0010 §7 / 0015 §10 / 0023 §8 fitness functions were "**already enforced by CI**".
  A code-verified cross-model review (ChatGPT + Claude Fable; logged in
  [`docs/meta/agent-collaboration-log.md`](../meta/agent-collaboration-log.md)) found this **false**
  against `.dependency-cruiser.cjs`: the harness enforces only the **import-boundary** rules; the
  call-graph/content fitness functions (default-deny `PolicyPort`, the consent gate, privacy
  classification, UI-reads-read-models-only) are **not implemented** (tracked #76). This is the **same
  overclaim** ADR 0025 §7 was amended for the day before. §2 is corrected to state that only import
  boundaries are enforced today and CI is the enforcement *point* for the rest once #76 lands. Fixed in
  the same review batch as the harness scope-hole hardening (PR #89).
