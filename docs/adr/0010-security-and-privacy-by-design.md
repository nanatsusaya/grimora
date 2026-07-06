# ADR 0010 — Security & Privacy by Design

- **Status:** Proposed
- **Date:** 2026-07-06
- **Deciders:** project owner + AI agents
- **Depends on:** [ADR 0003](0003-overall-architecture.md) (§6 security-by-design principle, §7 ports
  catalog, §1 dependency rule), [ADR 0005](0005-persistence-and-sync.md) (sync/storage surface for
  crypto & retention), [ADR 0006](0006-plugin-system.md) (plugin capability/trust model — §5),
  [ADR 0008](0008-ai-provider-abstraction.md) (AI safety, prompt-injection), [ADR 0009](0009-cross-cutting-concerns.md)
  (auth/authorization/logging boundaries this ADR builds mechanisms on top of)

## Context

Security & privacy are core from day one — both a product value and a legal obligation. ADR 0003 §6
established security-by-design as a **principle** and ADR 0009 gave it a first concrete home
(`AuthPort`, `AuthorizationPort`/`PolicyPort`, PII-safe logging, RLS as defense-in-depth). This ADR
provides the remaining **mechanisms**: a threat model, the plugin permission/sandbox boundary, secrets
and cryptography ports, privacy-by-default rules (DSGVO data-subject rights), and a secure SDLC /
vulnerability-handling process (CRA).

**Legal drivers** (see [`docs/legal/eu-de-compliance-matrix.md`](../legal/eu-de-compliance-matrix.md)
for the authoritative applicability reads and deadlines — not re-derived here):
- **DSGVO Art. 25 & 32** — data protection by design and by default; security of processing. In force,
  applies today (accounts + characters tied to users).
- **EU Cyber Resilience Act (CRA)** — security-by-design + vulnerability handling. Pure SaaS is largely
  out of scope today; **flips in-scope once mobile/desktop apps ship** (roadmap Phase 5/7). Reporting
  obligations start **11 Sep 2026**, full obligations **11 Dec 2027**.
- **EU AI Act Art. 50** — deployer transparency for the in-app chatbot; **2 Aug 2026**, owned by
  ADR 0008 (labelling) with the deployer-obligation detail landing here.
- **Digital Services Act (DSA)** — baseline hosting-service notice-and-action once users upload content;
  the matrix routes this to ADR 0010 as a security/abuse concern.
- **Jugendschutz (JMStV/JuSchG)** — owner-confirmed (2026-07-06) to be decided **here**.

**Repo state at the time of writing:** only `packages/shared-types` exists (bare `Result<T, E>`); no
`core-domain`, no ports, no adapters. This ADR is a decision record against a blank slate; Phase 2
builds against it. It defines *where mechanisms live and what invariants hold*, not their
implementation.

## Decision

### 1. Threat model (STRIDE-oriented)

The trust boundaries are the **adapters** (ADR 0003 §6: "adapters are the trust boundary"). The core
(Domain + Application) is pure and holds no ambient authority; everything crossing an adapter is
untrusted until validated.

**Assets** (what we protect): user credentials & sessions; user personal data (account identity,
character/campaign content tied to a person); the **event log** (the authoritative record — ADR 0004);
secrets (provider API keys, JWT signing keys, DB creds); integrity of rule/formula execution; service
availability.

**Actors / trust zones:**
- **Anonymous / unauthenticated** — internet-facing.
- **Authenticated user** — scoped by RBAC role (Owner/GM/Player/Spectator, ADR 0009).
- **Plugin code** — first-party (trusted, in-process) vs. third-party (untrusted, sandboxed) — §3.
- **External AI provider** — semi-trusted egress; may receive only consented data (ADR 0008 §7).
- **Composition root** (`apps/*`) — fully trusted; the only holder of secrets.

**Trust boundaries:** inbound API adapter (`apps/api`); the plugin SDK boundary (host ↔ plugin); the
sync boundary (local ↔ cloud event replication, ADR 0005); the AI egress boundary (ADR 0008); the
persistence boundary (app ↔ Postgres/SQLite, guarded additionally by RLS).

**Primary threats → mitigations** (STRIDE):

| Threat (STRIDE) | Example in Grimora | Mitigation (owning §) |
| --- | --- | --- |
| **S**poofing | Forged session/JWT; impersonating a GM | `AuthPort` token validation at the inbound adapter only (ADR 0009 §3); short-lived access tokens + refresh |
| **T**ampering | Malicious plugin mutates another character; forged sync events | Plugin sandbox + host-port-only data access (§3); insert-only signed/append event log, per-aggregate authorization on replay (ADR 0004/0005); RLS defense-in-depth |
| **R**epudiation | "I never raised that attribute" | Event sourcing is the immutable, attributable audit trail (ADR 0004); correlation IDs in log metadata (ADR 0009 §2) |
| **I**nformation disclosure | PII in logs; secrets leaking to a plugin/AI; cross-tenant read | PII redaction at the logging adapter (ADR 0009 §2); `SecretsPort` only at composition root (§4); plugins never receive secrets (§3); AuthorizationPort + RLS (ADR 0009 §3); AI egress consent gate (ADR 0008 §7) |
| **D**enial of service | AI token-budget exhaustion; expensive plugin behaviour; sync flooding | `RateLimited` category + per-user/plan budgets (ADR 0009 §1, ADR 0008 §6); sandbox execution limits (§3); input-size caps at adapters |
| **E**levation of privilege | Plugin reaching core internals/secrets/other plugins; AI invoking privileged ops | Capability least-privilege + import rules enforced by the conformance harness (§3, §7); AI tools use the **same** authorization as the UI, no privileged path (ADR 0008 §2) |

This table is the living threat model; new adapters/capabilities must add their rows (enforced as a
review checklist item, not silently expanded).

### 2. Authorization model (mechanisms on top of ADR 0009)

ADR 0009 already fixed *that* authorization lives in the Application layer as `AuthorizationPort` /
`PolicyPort` with roles Owner/GM/Player/Spectator + resource-level checks, and RLS as defense-in-depth.
This ADR adds the **mechanism invariants**:

- **Default deny.** Every use case performs an explicit policy check; the absence of a check is a bug,
  not an implicit allow. A use case with no `PolicyPort` call is flagged by the conformance harness
  (§7) unless annotated as intentionally public (e.g. plugin-catalog read).
- **Ownership & tenancy** are modeled as **resource-scoped policy** (e.g. "GM *of this campaign*"),
  evaluated against the aggregate, not just global role membership — the authoritative gate. RLS
  encodes the same tenancy at the row level as containment if the app is ever bypassed.
- **Policy is pure and testable**: `PolicyPort` decisions are functions of (actor, action, resource
  state) — no I/O — so they can be unit-tested and, later, reused by the AI tool layer unchanged.

### 3. Plugin permission & sandboxing model (supply-chain boundary)

This section makes ADR 0006 §5 ("concrete sandbox + threat model live in ADR 0010") concrete.

- **Capability grants are the permission unit.** A plugin receives *only* the host functions implied by
  the capabilities its manifest declares and the user/host grants (ADR 0006 §2/§5). Requested
  permissions are declared in the manifest; nothing is ambient.
- **What a plugin can *never* reach** (hard boundary, enforced by the harness + runtime): `SecretsPort`
  or any secret; the event store, Postgres/SQLite, or any raw persistence; the network, filesystem,
  DOM, timers, or globals (no ambient authority — ADR 0006 §3); core internals or `@grimora/*` deep
  imports; **another plugin's** namespace/state. All data access is through **host ports**, with the
  host enforcing authorization (§2) and namespacing by plugin id.
- **Isolation phased by trust** (reaffirms ADR 0006 §5):
  - **First-party** (e.g. `plugins/dsa5`) may run **in-process** — trusted, reviewed in this repo.
  - **Third-party / untrusted behaviour** runs in a **sandbox**: a deterministic, capability-scoped
    isolate with **no** network/filesystem/DOM/global access and only granted host functions injected.
    The mechanism is a **Web Worker / isolated JS realm** (e.g. a locked-down `worker_threads` isolate
    on the backend, a Worker in the browser) — **not** `eval`/`vm` in the host realm.
  - **Execution limits** on sandboxed behaviour: CPU/time budget and memory ceiling (DoS mitigation,
    §1); a plugin call that exceeds them fails as an `Infrastructure`/`RateLimited` error (ADR 0009 §1),
    never hangs the host.
- **Determinism as a security property.** Behaviour APIs are pure and receive a seeded `rng` derived
  from `IdGeneratorPort` (ADR 0006 §3) — no wall-clock, no `Math.random`, no network — so plugin output
  is reproducible for replay (ADR 0004) and cannot exfiltrate via timing/entropy side channels.
- **Provenance & revocation.** Events record the producing plugin id + version (ADR 0006 §4). A plugin
  can be disabled per user/campaign without deleting history; a plugin flagged malicious can be
  **blocklisted** by id so it no longer loads, while its past events remain replayable via upcasting.

### 4. Secrets handling

- **`SecretsPort`** (declared in `core-domain/application/ports`) is the only interface for retrieving a
  secret, and it is **wired and called only at the composition root** (`apps/*`). Domain, Application,
  and plugins never import it (ADR 0003 §6.4). This is a conformance-harness invariant (§7).
- **Adapters**: environment/secret-manager on the backend (env vars locally via `docker-compose`, a
  cloud secret manager in hosted deployments); the frontend holds **no** long-lived provider secrets —
  privileged calls (e.g. external AI providers) go through `apps/api`, which holds the key server-side
  (ADR 0008). No secret is ever shipped in a client bundle.
- **No secrets in logs** — enforced by the redaction deny-list at the logging adapter (ADR 0009 §2), not
  by convention.
- **Rotation**: secrets are referenced indirectly (by name/handle), so rotating a value requires no code
  change; JWT signing-key and provider-key rotation are operational procedures (detail: ADR 0014
  DevOps). Compromise response: rotate + invalidate sessions.

### 5. Cryptography

- **`CryptoPort`** (declared in `core-domain/application/ports`) abstracts the crypto primitives the
  Application needs (hashing, symmetric encrypt/decrypt, HMAC/signature verify) so Domain/Application
  never import a concrete crypto library; adapters bind a vetted implementation (WebCrypto / Node
  `crypto` / libsodium) — **no hand-rolled crypto**.
- **In transit**: TLS everywhere (HTTPS for API, TLS for Postgres and sync replication). Enforced at the
  infra/adapter layer.
- **At rest**: rely on the platform's transparent encryption for the primary store (Supabase Postgres
  disk encryption; encrypted device storage for local SQLite/OPFS where the platform provides it —
  ADR 0005). **Application-level field encryption** via `CryptoPort` is applied selectively to
  especially sensitive fields **only where identified** (kept minimal to preserve queryability/search);
  the default is transparent-at-rest, not field-level, to avoid crypto sprawl.
- **Password/credential storage is not ours** — delegated to Supabase Auth/GoTrue (ADR 0009 §3); we
  never store password hashes ourselves.
- **Key management**: keys are secrets (§4) — referenced by handle, rotated operationally. The sync
  event log stays **conflict-free/insert-only** (ADR 0005); any signing of events for integrity uses
  `CryptoPort`, keys held only at the composition root.

### 6. Privacy by default (DSGVO Art. 25)

- **Data minimization**: collect only what a use case needs; the account holds the minimum identity;
  telemetry/analytics is minimized and consent-gated (detail: ADR 0019). Optional data stays optional.
- **PII-aware logging**: operational logs must not become a shadow copy of personal data — deny-list
  redaction at the adapter (ADR 0009 §2). Domain events record *what happened* (ADR 0004); logs record
  *how it ran*.
- **Retention & erasure (data-subject rights).** DSGVO grants access, rectification, and erasure. This
  is architecturally non-trivial because the event log is **immutable** (ADR 0004). The mechanism:
  - **Read models** (projections) are freely rebuildable/deletable — erasing a data subject removes
    their derived state there directly.
  - For the **immutable event log**, use **crypto-shredding**: personal data inside events is encrypted
    with a **per-subject key** (`CryptoPort`, §5); erasure = destroying that key, rendering the
    personal payload unrecoverable while preserving the log's structural integrity and non-personal
    data for replay. Pseudonymization/tombstone events complement this where a field is not
    pre-encrypted.
  - The concrete **operational** procedure (DSAR intake, verification, SLA, records of processing) is
    **ADR 0015**'s (compliance ops); this ADR fixes the *architectural capability* that makes erasure
    possible without breaking event sourcing.
- **Data locality**: EU region for hosted data (ADR 0002/hosting.md); external transfers only via the
  consent-gated AI egress (ADR 0008 §7), with the transfer-impact detail in ADR 0015.

### 7. Secure SDLC & CRA obligations

- **CI security gates** (extend `.github/workflows/ci.yml`): **dependency vulnerability scanning** and
  **secret scanning** on every PR (the principle was already stated in ADR 0003 §6.7; this ADR commits
  it as a required, blocking check). Consider **SBOM** generation at release once distributable
  artifacts exist (CRA-relevant when mobile/desktop ship).
- **Security fitness functions** for the conformance harness (issue #9) — enumerated so they are
  implementable as tests:
  1. No import of `SecretsPort` (or any secrets adapter) outside `apps/*` composition roots.
  2. Plugins import **only** `@grimora/plugin-sdk` — never adapters, persistence, secrets, or core
     internals; no deep imports (`@grimora/x/src/...`).
  3. No Domain/Application import of a concrete crypto/logging/auth library (only the port).
  4. Every Application use case reaches a `PolicyPort` check (or is explicitly annotated public) —
     default-deny lint (§2).
  5. No `Math.random`/wall-clock in plugin behaviour or Domain (determinism, §3).
- **Vulnerability handling / disclosure (CRA).** A **coordinated disclosure** process is established
  **now** (owner decision, R5), ahead of the 11 Sep 2026 CRA reporting date, because it is cheap and
  the matrix flags the date:
  - **Reporting channel = GitHub Private Vulnerability Reporting (PVR)**, not public issues. Public
    issues are the wrong channel for a security report — they disclose the vulnerability to everyone
    before a fix exists (a zero-day window). PVR gives reporters a repo-native **"Report a
    vulnerability"** button that opens a **private** security advisory draft (no email inbox to
    maintain). Enabling PVR (*Settings → Security → Private vulnerability reporting*) is a one-time repo
    setting, tracked as a follow-up task.
  - A **`SECURITY.md`** at the repo root documents: the PVR channel (with an explicit "do **not** file
    public issues for security bugs" instruction), supported/covered versions, and an
    acknowledgement/triage expectation. Fixes ship through the normal update mechanism. Writing
    `SECURITY.md` and enabling PVR are follow-up implementation tasks, not part of this ADR text.

### 8. Content-safety obligations routed here (DSA & Jugendschutz)

The compliance matrix routes two user-generated-content obligations to this ADR as abuse/security
concerns. Both are **architectural hooks now, policy/operations later** — the heavy lifting is ADR 0015
(compliance ops) and product decisions not yet made.

- **DSA notice-and-action.** Once users can upload content (character images, campaign notes, content
  packs — ADR 0006 §8), baseline hosting-service duties apply regardless of size: a point of contact
  and a **notice-and-action** path for illegal content. Architecturally this ADR requires that
  user-uploaded content is **addressable and moderatable** — every upload is an event-sourced,
  attributable, individually removable resource (a takedown is a domain event / read-model removal,
  not a raw DB delete), so a notice-and-action workflow can be built on top without retrofitting. The
  ToS/point-of-contact/process detail is ADR 0015.
- **Jugendschutz (JMStV/JuSchG) — owner-confirmed here.** User-generated campaign content/images could
  be developmentally sensitive. **Decision:** Grimora does not itself publish/broadcast content to the
  public; content is shared within **private campaign groups** the Owner/GM controls (RBAC, §2), which
  keeps it outside classic *Rundfunk/Telemedien an die Allgemeinheit* broadcast scope. The
  **architectural commitment** made here: (a) content visibility is bounded by campaign membership by
  default (no public, unauthenticated content feed exists without a later explicit decision), and
  (b) a **content-labelling/age-rating hook** and **report-content** path are reserved in the model so
  an age gate or maturity flag can be attached to campaigns/content packs if a future feature (public
  sharing, a marketplace) crosses into scope. Concrete age-verification technology, if ever needed, is
  deferred to the ADR that introduces public content — it is explicitly **not** built now.

### 9. Impressum gap (noted, routed — not decided here)

The matrix flags **Impressumspflicht (§5 DDG)** as the highest-priority *unowned* compliance gap, and
notes it may already apply today (offer beyond purely private/family use), independent of
Gewerbe/revenue. This is a **content/operational** obligation (publishing a legally compliant imprint),
**not** a software-architecture decision, so it does **not** belong in this ADR. It is routed to
**ADR 0015** (compliance ops) and to the practical step of adding an imprint when a public
website/service goes live. Recorded here only so the gap is not silently carried forward. The owner
confirmed this routing (R4).

## Consequences

**Positive:** a written STRIDE threat model ties every trust boundary to a concrete mitigation and its
owning port/ADR; the plugin sandbox boundary is now precise enough to implement and to enforce as CI
fitness functions; `SecretsPort`/`CryptoPort` give secrets and crypto a single, testable home outside
the core; crypto-shredding reconciles DSGVO erasure with the immutable event log **by design** rather
than as a later crisis; DSA/JMStV get architectural hooks before they are needed; the CRA disclosure
process and CI security gates are cheap now and mandatory later.

**Negative / costs:** the untrusted-plugin sandbox (isolated realm + execution limits + host-function
injection) is real engineering effort — mitigated by shipping first-party plugins in-process first
(ADR 0006 §5) and maturing the sandbox before opening a third-party registry. Crypto-shredding requires
per-subject key management and disciplined "which fields are personal" tagging up front; getting the
field tagging wrong later is expensive. Field-level encryption is deliberately kept minimal to avoid
crippling search/queryability. Several items here (DSAR ops, transfer impact, imprint, ToS) are
intentionally **routed onward** to ADR 0015, so this ADR's completeness depends on that follow-up
landing.

## Alternatives considered

- **Defer the threat model until Phase 2 code exists** — rejected: the plugin sandbox and erasure
  strategy have architectural ripples (event schema, key management, ports) that are far cheaper to fix
  now than after aggregates are built.
- **Full process isolation for *all* plugins from day one** — safest but heavy; rejected in favor of
  ADR 0006's phased trust (in-process first-party, sandbox third-party).
- **Delete events to satisfy erasure** — contradicts the immutable, insert-only event log (ADR 0004/
  0005) and breaks replay/sync. Rejected in favor of crypto-shredding + read-model deletion.
- **Field-level encryption of all personal data** — maximal confidentiality but destroys queryability
  and search and multiplies key-management surface. Rejected in favor of transparent-at-rest by default
  + selective field encryption only where identified.
- **A bespoke secrets/crypto layer in the core** — violates ADR 0003 §6.4 and the dependency rule.
  Rejected: ports at the composition root only.
- **Handle Impressum/JMStV as full operational policy in this ADR** — over-reaches an architecture ADR
  into legal-ops content; rejected in favor of architectural hooks here + routing the operational
  detail to ADR 0015 (with owner confirmation, O4).

## Resolved questions (owner decisions, 2026-07-06)

All five review questions were resolved by the owner; the decisions above already reflect them.

- **R1 — Sandbox timing.** *Phased approach confirmed.* First-party plugins run **in-process** now; the
  untrusted-plugin sandbox (§3) is built only when a third-party registry is actually opened (ADR 0006
  §5). Not a Phase-2 prerequisite.
- **R2 — Erasure mechanism.** *Crypto-shredding confirmed* (§6) as the DSGVO-erasure strategy against
  the immutable event log — per-subject key, destroy-to-erase — over pseudonymization/tombstones alone.
  The event schema and key management are designed for this from the first aggregate.
- **R3 — Field-level encryption scope.** *Confirmed:* transparent-at-rest by default (§5), with
  selective field-level encryption applied **only where identified**. No day-one field-encryption list;
  the concrete "which fields are sensitive" decision is deferred to when real aggregates are designed.
- **R4 — Impressum & JMStV routing.** *Confirmed.* **Impressum** operational detail is routed to
  ADR 0015 (§9), not this ADR. The **JMStV** decision here (§8) — private-campaign-scoped visibility by
  default + reserved labelling/age-gate hook, no age-verification technology built now — matches the
  intended content-sharing model.
- **R5 — SECURITY.md / disclosure now.** *Confirmed: establish now* (§7), ahead of the 11 Sep 2026 CRA
  reporting date. **Reporting channel = GitHub Private Vulnerability Reporting**, explicitly **not**
  public issues (public issues would disclose a vulnerability before a fix exists). `SECURITY.md` +
  enabling PVR are tracked as follow-up tasks.

## References

- [ADR 0003](0003-overall-architecture.md) (§6 security principle, §7 ports, §1 dependency rule),
  [ADR 0004](0004-event-sourcing-cqrs.md) (immutable event log, provenance, upcasting),
  [ADR 0005](0005-persistence-and-sync.md) (storage/sync surface, insert-only replication),
  [ADR 0006](0006-plugin-system.md) (§5 capability/trust model this ADR makes concrete),
  [ADR 0008](0008-ai-provider-abstraction.md) (§2 authorization parity, §6 cost/abuse, §7 egress
  consent), [ADR 0009](0009-cross-cutting-concerns.md) (error taxonomy incl. `RateLimited`, PII-safe
  logging, `AuthPort`/`AuthorizationPort`, RLS defense-in-depth), ADR 0011 (API contract, HTTP mapping),
  ADR 0014 (DevOps: CI gates, SBOM, rotation ops, agent-driven ticket/PR trust boundary), ADR 0015
  (DSGVO ops: DSAR/consent/transfer impact, DSA ToS & point of contact, Impressum),
  ADR 0019 (analytics/telemetry consent), [`docs/legal/eu-de-compliance-matrix.md`](../legal/eu-de-compliance-matrix.md),
  [`docs/legal/dsa5-content-boundary.md`](../legal/dsa5-content-boundary.md). Issue #12.
