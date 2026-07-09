# ADR 0015 — Compliance & data protection (DSGVO ops, consent, EU residency)

- **Status:** Proposed
- **Date:** 2026-07-09
- **Deciders:** project owner + AI agents
- **Depends on:** [ADR 0003](0003-overall-architecture.md) (§6 security/privacy-by-design, §7 ports
  catalog, §9 bounded contexts), [ADR 0004](0004-event-sourcing-cqrs.md) (intention-revealing events,
  immutable log, upcasting), [ADR 0005](0005-persistence-and-sync.md) (EU-region storage, insert-only
  sync must propagate erasure/redaction), [ADR 0008](0008-ai-provider-abstraction.md) (§5 AI-Act
  labelling, §7 external-provider consent gate + local-Ollama fallback), [ADR 0009](0009-cross-cutting-concerns.md)
  (§1 `AppError` categories, §3 `AuthPort`/`AuthorizationPort`/`PolicyPort` + RBAC, PII-safe logging),
  [ADR 0010](0010-security-and-privacy-by-design.md) (§4 `SecretsPort`, §5 `CryptoPort`, §6 crypto-shredding
  erasure capability + data locality, §8 DSA/JMStV hooks, §9 Impressum routing).
  Relates to [ADR 0011](0011-api-design.md) (§9 auth in the contract, contract surface for a future
  withdrawal/DSAR endpoint), ADR 0012 (frontend consent-capture UI — still Planned), ADR 0014 (DevOps:
  backup-retention policy — still Planned), ADR 0019 (analytics/telemetry consent — still Planned),
  ADR 0023 (event-payload personal-data classification — still Planned; owns the per-field exclusion
  mechanism §3 relies on).

## Context

DSGVO/BDSG applies to Grimora **today**: any real user base means personal data (account identity,
characters and campaign content tied to a person — ADR 0009/0010). Retrofitting compliance is expensive
and risky (issue #17), so the *operational* data-protection layer is decided now, in Phase 1, against the
architecture the earlier ADRs already fixed — not built now, but decided so Phase 2 builds against it.

**What earlier ADRs already fixed (this ADR must not re-decide, only operationalize):**
- ADR 0010 §6 chose **crypto-shredding + read-model deletion** as the *erasure capability* against the
  immutable event log (per-subject key via `CryptoPort`; destroy-key-to-erase), and **transparent-at-rest
  by default** with selective field-encryption. ADR 0010 §6 explicitly routes the **operational** DSAR
  procedure (intake, verification, SLA, records of processing) to *this* ADR.
- ADR 0008 §7 chose **external AI providers off by default, enabled only after explicit consent**, with
  **local Ollama** as the no-consent fallback, and routed the consent detail here.
- ADR 0009 §3 fixed **`AuthorizationPort`/`PolicyPort`** (Application-layer, resource-scoped, RBAC
  Owner/GM/Player/Spectator) and PII-safe logging. ADR 0002/0005/`hosting.md` fixed **Supabase EU region**.
- ADR 0010 §8/§9 reserved **DSA notice-and-action** and **JMStV** hooks and routed **Impressum** and the
  DSA/ToS *content* here as operational, not architectural, obligations.

**What is genuinely open and owned here** (from issue #17 + the external ADR review, 2026-07-07,
"point E"): a **consent model** (esp. that external-AI consent must be *resource/group-scoped*, because a
GM's prompt can carry **other players'** personal data — one user cannot consent for another's transfer to
a US provider); the **DSAR operational procedure** and retention/purpose-limitation policy; the **records
of processing (Art. 30)** + processor/DPA/transfer-impact register; a **DPIA screening**; the operational
detail of **AI-Act Art. 50** deployer transparency; and the routed **Impressum / ToS / cookie-consent /
Widerrufsbutton** obligations, each trigger-gated to Grimora's actual stage.

**Legal drivers** — the authoritative applicability reads and deadlines live in
[`docs/legal/eu-de-compliance-matrix.md`](../legal/eu-de-compliance-matrix.md) and are **not re-derived
here**; two primary-source checks made for this ADR: **DSGVO Art. 30(5)** — the <250-employee records
exemption does *not* apply when processing is "not occasional" (ongoing/routine); Grimora's account +
character processing is routine, so a **RoPA is required despite small size**
([gdpr-info.eu/art-30](https://gdpr-info.eu/art-30-gdpr/)). **DSGVO Art. 12(3)** — data-subject requests
are answered **within one month**, extendable by two further months for complex/numerous requests
([gdpr-info.eu/art-12](https://gdpr-info.eu/art-12-gdpr/)).

**Repo state:** Phase 1 — only `packages/shared-types` has real code plus the walking-skeleton seed
(ADR 0022). No accounts, aggregates, AI chat, UI, or paid tier exist yet. This ADR is a decision record
against that state; nothing here is user-facing today. **This is a project compliance checklist, not
legal advice** — items marked *owner/legal review* need the owner (and, where noted, a lawyer/Steuerberater)
before they bind real users.

## Decision

### 1. This ADR is the operational data-protection layer (map, not new mechanisms)

This ADR owns the **operational** DSGVO obligations that sit **on top of** the mechanisms ADR 0010/0009
already built; it introduces **no new persistence, crypto, or authz mechanism**. Where an obligation is
*content/policy* (imprint text, ToS) or belongs to a still-Planned ADR (telemetry categories → ADR 0019),
this ADR **routes it with an explicit trigger** rather than deciding it ahead of that ADR (CLAUDE.md
"do not implement ahead of a decision"). Everything here is scaled to the project's actual stage
(solo, pre-revenue, no public launch) — trigger-gated, not speculative. The **DSA5 content boundary**
(no copyrighted Ulisses text/values) is an **IP/copyright** matter, **not** data protection; it is owned
by [`docs/legal/dsa5-content-boundary.md`](../legal/dsa5-content-boundary.md) and is **out of scope**
here — noted only because issue #17 lists it among the topics to place.

### 2. Consent is an event-sourced, versioned, scoped record

Consent is **first-class domain state**, recorded as **intention-revealing, past-tense events** on a
`Consent` aggregate (ADR 0004) — `consent.granted` / `consent.withdrawn`, **never** a generic
`setConsentFlag`. Each event records, at minimum: the **data subject** (user id), the **purpose**
(a closed purpose enum — e.g. `external-ai-processing`, later `analytics`), the **scope** (§3), the
**recipient/processor** it authorizes (e.g. `provider:anthropic`), the **policy/consent-text version**,
and the **timestamp**. This makes consent **auditable and provable** (DSGVO Art. 7(1) — the controller
must be able to demonstrate consent) directly from the event log, and **withdrawable** (Art. 7(3) —
withdrawal must be as easy as granting) by appending `consent.withdrawn`, which takes effect immediately
for all future processing. Withdrawal is **prospective** (Art. 7(3)): it does not make prior,
already-lawful processing unlawful, and it cannot recall data already transmitted to a provider — that
data's deletion is governed by the provider's DPA (§6). Consent state is exposed to the Application layer
through a **`ConsentPort`** (`core-domain/application/ports`), queried by any use case before a
consent-gated action; the port is a pure read over the folded consent projection, no I/O in Domain
(ADR 0003 §1). The consent record's own personal identifier is subject to the same crypto-shredding as
other personal data on erasure (§5), but the **non-personal** proof-of-consent structure survives
(Art. 7(1) accountability vs. Art. 17 erasure are reconciled the same way ADR 0010 §6 reconciles the audit
log). **Capacity (Art. 8):** consent is valid only from a subject able to give it — the service's **ToS
restricts use to users aged ≥ 16** (the German digital-consent age); minor / parental-consent handling is
**deferred to the future age-gate hook** (ADR 0010 §8), not built now (R4).

### 3. External-AI consent is resource/group-scoped, and transfer requires *all* affected subjects' consent

This resolves the external-review **point E**. Because a GM's AI prompt is grounded in **campaign
read-models** (ADR 0008 §4) that can contain **other players'** personal data (their characters, notes),
a single user's per-account consent **cannot** lawfully authorize transmitting another user's data to a
US provider (a DSGVO international transfer, ADR 0010 §6 / matrix Schrems-II row). Therefore:

- **Consent for `external-ai-processing` is scoped to the resource whose data would be transmitted** —
  modeled at the **campaign** grain (the natural sharing unit, ADR 0009 RBAC), layered over an optional
  per-user global default. The scope is part of the consent record (§2).
- **The transmission rule (enforced at the AI egress boundary, application layer):** an external
  provider call is permitted **only if every data subject whose personal data appears in that payload has
  a valid, un-withdrawn consent** covering **that provider**. When the **whole affected group has
  consented**, external AI runs with **full context (maximum utility)** — the common, intended path.
  **Local Ollama is offered as an equivalent, opt-in data-sovereignty alternative** (not a degraded
  fallback), so any user can keep their data on-device by choice (ADR 0008 §7). Consent stays **informed
  and specific** (§2): "simplest for the user" never means a pre-ticked or bundled grant (Art. 7).
  **Invariant (non-negotiable):** the personal data of a subject who has **not** consented is **never**
  transmitted to an external provider — where a group has not all consented, that subject's personal data
  is **excluded** or the action uses Ollama. The **concrete exclusion mechanism** (structural read-model
  filtering by data-owner vs. field-level redaction) is settled together with **ADR 0023** (event-payload
  personal-data classification, still Planned), **not fixed here**, so this ADR does not pre-empt it (R1).
- **Consent is provider-scoped:** a different provider is a different recipient (and often a different
  transfer country), so **switching provider** (e.g. Anthropic → OpenAI) requires **fresh consent** for
  the new recipient; the old consent does not carry over.
- This is a **conformance fitness function** (§9): the external `AiProviderPort` adapter is reachable
  **only** through a use case that consults `ConsentPort`; a direct call bypassing the consent gate is a
  boundary violation the harness flags (analogous to ADR 0010 §7.4 default-deny).

### 4. Data-subject rights (DSAR) as application use-cases over the ADR 0010 capability

The DSGVO data-subject rights are realized as **explicit Application use-cases** (each behind a
`PolicyPort` check, ADR 0009 §3), built on the erasure capability ADR 0010 §6 already provides — not as
ad-hoc scripts:

- **Access / Art. 15** & **Portability / Art. 20:** an **export** use-case assembles the subject's data
  from **read-models** (never raw event-store dumps — ADR 0004) into a **structured, machine-readable
  format** (JSON) for Art. 20 portability; the same projection serves the Art. 15 access copy.
- **Rectification / Art. 16:** handled by the normal domain commands that already correct aggregate state
  (event-sourced corrections), plus read-model rebuild.
- **Erasure / Art. 17:** an **erasure** use-case triggers **crypto-shred (destroy the per-subject key) +
  read-model deletion** (ADR 0010 §6), and **emits an erasure/redaction event that sync propagates**
  (ADR 0005) so every replica converges to the erased state. Non-personal, structural event data survives
  for replay integrity.
- **Backups & completeness of erasure:** personal data in **event-log backups** is covered by
  crypto-shredding — destroying the per-subject key renders the encrypted payload unrecoverable in
  **every** copy, backups included; personal data in **read-model backups** ages out per the
  **backup-retention policy** (ADR 0014 DevOps), so an erasure is *complete* only once backups still
  holding plaintext have rotated. That window is **disclosed** in the RoPA retention entry (§6), not hidden.
- **Restriction / Art. 18:** a **`processing.restricted`** domain event flags an aggregate so projections
  suppress it — the data is neither used nor erased — without breaking the immutable log; restriction is a
  read-model state, not a deletion.
- **Notification / Art. 19:** rectification/erasure/restriction propagate to all **replicas** via the sync
  events above (ADR 0005); notifying **external processors** of an erasure is an **operational** step
  driven by the processor register (§6), not an automatic mechanism.
- **Identity verification:** the **authenticated account is the primary proof of identity** for a
  logged-in subject's request — DSAR flows run as authenticated use-cases, so no *additional* personal
  data is collected merely to verify a requester (data-minimization, ADR 0010 §6). Out-of-band requests
  (e.g. by email from a former user) are an operational edge case handled by the owner, not an
  architectural mechanism.
- **SLA:** requests are actioned **within one month** (DSGVO Art. 12(3)), extendable by two further
  months for complex/numerous requests, with the subject informed of any extension. This is an
  **operational SLA**, tracked as such; the architecture makes it *cheap to meet* (the use-cases above),
  it does not itself enforce a clock.

### 5. Lawful basis, purpose limitation, retention & data minimization (Art. 5 & 6)

- **Lawful basis (Art. 6) — the foundational distinction:** the **core service** (accounts, characters,
  campaigns) is processed on **contract-necessity (Art. 6(1)(b))**, *not* consent — so a consent
  withdrawal never disables the service itself. **Consent (Art. 6(1)(a), plus Art. 49(1)(a) as the
  derogation for the US transfer)** is reserved for processing that is *not* necessary to the service:
  **external-AI transmission (§3)** and, later, **analytics (§9 / ADR 0019)**. Legitimate interest
  (Art. 6(1)(f)) is used only where documented in the RoPA, e.g. minimal security/diagnostic logging
  (ADR 0009 §2). Each basis is recorded **per purpose** in the RoPA (§6).
- **Purpose limitation:** each processing purpose is named in the RoPA (§6) and, for consent-gated
  purposes, in the consent enum (§2); data collected for one purpose is not silently repurposed.
- **Data minimization & privacy by default (Art. 5(1)(c) + Art. 25 — architecturally owned by
  ADR 0010 §6, operationalized here):** the account holds the **minimum identity**; optional fields stay
  optional; prompts to AI carry only what a task needs (ADR 0008 §6). No new collection is introduced by
  this ADR.
- **Retention:** user aggregates (characters, campaigns) are retained **while the account is active** and
  erased on account deletion / Art. 17 request (§4). **Operational logs** (ADR 0009 §2) are short-lived
  and PII-redacted, retained only for diagnostics. Concrete retention **periods** per data class are an
  **operational policy** finalized when real aggregates exist (deferred with a trigger, not guessed now).

### 6. Records of processing (Art. 30) + processor / DPA / transfer register

- **A Records-of-Processing (RoPA)** is maintained as a **living doc** in `docs/legal/` (a new
  `records-of-processing.md`, created as an ADR-0015 follow-up), because the Art. 30(5) small-org
  exemption **does not apply** to Grimora — its account/character processing is **routine, not occasional**
  (primary-source check, Context). The RoPA lists each purpose, data categories, subjects, recipients,
  transfers, and retention.
- **A processor register** (in the same or an adjacent living doc) lists every **sub-processor** and the
  requirement that a **DPA / Auftragsverarbeitungsvertrag (Art. 28)** is in place **before that processor
  handles real user data**: Supabase (auth + DB + storage, EU region), any object-storage/CDN
  (Cloudflare/R2), Sentry (error tracking), and — when enabled — the external **AI providers**
  (Anthropic/OpenAI). For the **US-based AI providers**, a **Transfer Impact Assessment (TIA) + SCCs**
  (Schrems II) is required **before** the provider is enabled, documented per provider (matrix Schrems-II
  row; ADR 0008 §7 consent is the transfer's legal basis, the TIA is the transfer-mechanism safeguard).
  The provider contract must additionally **prohibit use of transmitted data for model training and
  require minimal / zero data retention** (use a zero-data-retention endpoint where the provider offers
  one) — the material safeguard that makes the transfer defensible, recorded in the TIA.
- **Release gate:** "every active processor has a signed DPA (and, for external transfers, a TIA)" is a
  **go-live checklist item** before real users are onboarded — a checklist gate, not a code artifact.

### 7. DPIA screening (Art. 35)

A **DPIA screening** is recorded now (in the RoPA doc) and concludes, at the **current scale**, that a
full DPIA is **not** required: no large-scale processing, no systematic monitoring, no special-category
(Art. 9) data by design. The screening defines explicit **re-trigger** conditions — a full DPIA is
required **before** any of: processing **special-category data**, **large-scale** processing, systematic
**profiling/scoring**, or public content feeds (ADR 0010 §8). The "no DPIA now" conclusion is
**accepted (R3)**, a documented legal-risk acceptance with the explicit re-triggers above.

### 8. AI-Act Art. 50 transparency — operational deployer detail

ADR 0008 §5 already commits to **labelling AI output as AI-generated** and disclosing the provider and
third-party data flow. This ADR fixes the **operational deployer obligations** (matrix Art. 50 row,
deadline **2 Aug 2026**; owed once the in-app chatbot actually serves users): (a) a **clear disclosure
that the user is interacting with an AI system** before/at the start of an AI chat; (b) **AI-generated
content is marked** as such wherever it is surfaced or persisted; (c) the disclosure text is a
**versioned, i18n user-facing string** (ADR 0009 §1 / ADR 0016 i18n). No new architecture — this is a
UI/content obligation whose *hooks* (labelling) ADR 0008 already reserved. It applies when the AI chat
ships (post-Phase-1); the obligation is captured now so it is not retrofitted under deadline pressure.

### 9. Routed & trigger-gated operational obligations (decided as triggers, not built now)

Each of these is real but **stage-gated**; this ADR fixes **the trigger and the owner**, consistent with
the compliance matrix, without building anything in Phase 1:

- **Impressum (§5 DDG)** — the matrix flags this as plausibly required **today** (an offer beyond purely
  private/family use, incl. the public repo), independent of Gewerbe/revenue. Publishing a compliant
  imprint is a **content deliverable** (not architecture). **When** to publish it, and how to handle the
  **owner's personal-data exposure** it requires (real name + reachable address), is **decided (R2)**:
  a minimal imprint at the first publicly reachable service, a lightweight contact/imprint in the repo
  meanwhile, a lawful service-address permitted over a home address — subject to owner/legal confirmation.
- **DSA notice-and-action + ToS + point of contact** — the *architectural* hooks (addressable,
  individually removable, event-sourced uploads; takedown = domain event) are already ADR 0010 §8. This
  ADR owns the **ToS content, point-of-contact publication, and the notice-and-action operational
  workflow**, triggered **when users can upload content to others** (ADR 0006 §8). Content deliverable,
  not Phase-1 code.
- **Cookie / endpoint-storage consent (§25 TTDSG/TDDDG)** — **strictly-necessary** storage needs no
  consent; **anything else** (analytics, tracking) needs a prior opt-in. Grimora ships **no non-essential
  client storage** today; the **consent record mechanism** for it is §2's, but the **specific
  analytics/telemetry categories and banner** are **ADR 0019's** turf (still Planned) — routed there,
  **not decided here**, so we do not pre-empt that ADR. The **consent-capture UI** (banner/settings) is a
  **frontend concern** routed to **ADR 0012** (web rendering & frontend state, still Planned); the
  frontend must gate any non-essential storage/tracking behind the §2 consent record **before** it fires.
- **Widerrufsbutton / Fernabsatzrecht (§312j BGB)** — mandatory since **19 Jun 2026**, but applicable
  **only once a paid consumer tier launches** (matrix). **Trigger:** before any paid tier goes live, the
  two-step withdrawal button + withdrawal flow must exist; the **contract-surface detail** is routed to
  **ADR 0011** (API/contract) at implementation time. Also coupled to **Gewerbeanmeldung /
  Kleinunternehmerregelung** (matrix) — business-registration steps the owner takes at monetization, not
  code. Nothing built now.

### 10. Enforcement (fitness functions)

- **New:** the external `AiProviderPort` adapter is reachable **only** via a use case that consults
  `ConsentPort` (§3) — a direct external-AI call that bypasses the consent gate is a conformance violation,
  enforced as a **custom check** (a call-graph assertion, like the ADR 0010 §7.4 default-deny lint — not
  merely a dependency-import rule), the consent analogue of default-deny authorization (ADR 0003 §2 /
  ADR 0010 §7).
- **New:** consent state changes only through `consent.granted` / `consent.withdrawn` **events** — no
  generic consent field-setter (ADR 0004 intent-events rule; reuses the existing "no `setField`"
  guardrail).
- **Reaffirmed:** PII-safe logging redaction (ADR 0009 §2) already keeps consent/DSAR flows from leaking
  personal data into logs; DSAR erasure relies on the crypto-shredding capability whose determinism/no-
  ambient-authority is already enforced (ADR 0010 §7).

## Consequences

**Positive:** DSGVO obligations map to **concrete, mostly-architectural** measures instead of a later
scramble; **consent becomes provable and withdrawable by construction** (event-sourced), and the
**resource-scoped external-AI consent rule closes the point-E gap** so one user can never authorize
another's transfer to a US provider; DSAR rights reuse the ADR 0010 erasure capability rather than new
machinery; the RoPA/DPA/TIA register turns "have we a lawful basis + safeguards for each processor" into a
checkable go-live gate; the AI-Act and routed content obligations are captured with **explicit triggers**
so nothing is silently dropped or prematurely built.

**Negative / costs:** the resource-scoped consent + all-subjects-must-consent rule adds **real complexity
to the AI egress path** (per-payload subject enumeration and a consented-subjects-only egress path, with
the concrete exclusion mechanism itself deferred to ADR 0023) — the cost of doing the transfer lawfully; a `ConsentPort` + consent aggregate is upfront design before any AI chat exists,
justified because it is cheap to design now and expensive to retrofit into event sourcing later.
Several items (imprint timing, retention periods, ToS/notice-and-action, Widerrufsbutton) are
**deliberately routed onward or trigger-gated**, so this ADR's *operational* completeness depends on
those follow-ups landing at their triggers — recorded so they are not lost. Legal conclusions here
(RoPA-required, no-DPIA-now, imprint) are a **project checklist and need owner/legal confirmation**, not
self-executing compliance.

## Alternatives considered

- **Per-user consent only for external AI (as ADR 0008 §7 originally framed it)** — rejected: a GM's
  prompt carries other players' personal data, so per-user consent would authorize transferring a
  non-consenting third party's data to a US provider (unlawful transfer). Resource-scoped + all-subjects
  rule (§3) is required.
- **Fixing a single partial-consent *mechanism* (per-field redaction vs. block) now** — rejected: the
  *policy* is decided (R1 — max utility once all affected subjects consent; Ollama as an opt-in
  data-sovereignty alternative; non-consented data never transmitted), but the *concrete exclusion
  mechanism* for non-consented subjects depends on the per-field personal-data classification **ADR 0023**
  owns, so it is routed there rather than pre-empted here (CLAUDE.md "do not implement ahead of a decision").
- **Store consent as a mutable boolean flag on the user profile** — rejected: loses the Art. 7(1)
  proof trail and Art. 7(3) withdrawal history, and violates the ADR 0004 intent-event rule. Event-sourced
  consent (§2) is auditable by construction.
- **Delete data to satisfy erasure** — already rejected by ADR 0010 §6 (breaks the immutable log/sync);
  this ADR reuses crypto-shredding, it does not reopen that decision.
- **Rely on the Art. 30(5) small-org exemption to skip the RoPA** — rejected: the exemption does not
  apply because processing is routine, not occasional (primary-source check). A RoPA is maintained (§6).
- **Fold everything (imprint, ToS, cookie banner, Widerrufsbutton) into this ADR as finished policy** —
  rejected: over-reaches an architecture ADR into legal-ops content and pre-empts ADR 0019 (analytics
  consent) and monetization decisions not yet made. Routed with triggers (§9) instead.

## Resolved questions (owner decisions, 2026-07-09)

- **R1 — External-AI consent granularity + partial-consent policy (§3).** Consent is **campaign-scoped**
  (over an optional per-user default). The owner chose **maximum AI utility as the intended path**: once
  **every** affected data subject (not only the acting GM) has actively, informedly consented for the
  provider, external AI runs with **full context**. **Local Ollama is offered as an equivalent, opt-in
  data-sovereignty alternative**, so a user can keep their data on-device by choice. The **non-negotiable
  invariant** holds regardless: a non-consenting subject's personal data is **never** transmitted to an
  external provider — where a group has not all consented, that subject's data is excluded or the action
  uses Ollama. The **concrete exclusion mechanism** (structural read-model filtering vs. field-level
  redaction) is **routed to ADR 0023** (personal-data classification), not fixed here, so this ADR does
  not pre-empt it. Consent remains informed/specific (Art. 7) — "simplest for the user" is not a
  pre-ticked/bundled grant.
- **R2 — Impressum timing + personal-data exposure (§9).** Decided as recommended: publish a **minimal
  imprint when the first publicly reachable Grimora service/landing page goes live**, add a **lightweight
  contact/imprint to the public repo** in the meantime (the repo plausibly triggers §5 DDG already), and
  use a lawful **service-style address** over a home address if preferred. This stays an **owner/legal**
  action item — worth a short lawyer check given the *Abmahnung* exposure the matrix notes; the ADR fixes
  the trigger and owner, not the imprint content.
- **R3 — DPIA screening (§7).** Decided as recommended: at the current scale (no large-scale or
  special-category processing, no profiling), **no full DPIA is required**, recorded as a documented
  screening with explicit re-trigger conditions (special-category data, large scale, profiling, public
  content). A full DPIA is premature until one of those triggers fires.
- **R4 — Minors / age of consent (§2, Art. 8).** Decided: the **ToS restricts the service to users aged
  ≥ 16** (the German digital-consent age), so consent is given by capable subjects; **parental-consent /
  minor-handling flows are deferred** to the future age-gate hook (ADR 0010 §8), not built now — building
  them at Phase 1, pre-user, would be over-engineering. Stays subject to owner/legal confirmation as part
  of the ToS content (§9).

## References

- [ADR 0003](0003-overall-architecture.md) (§6 privacy-by-design, §7 ports, §9 bounded contexts),
  [ADR 0004](0004-event-sourcing-cqrs.md) (intention-revealing events, immutable log),
  [ADR 0005](0005-persistence-and-sync.md) (EU-region storage; sync propagates erasure/redaction),
  [ADR 0008](0008-ai-provider-abstraction.md) (§5 AI-Act labelling, §7 external-provider consent +
  Ollama fallback), [ADR 0009](0009-cross-cutting-concerns.md) (§1 error categories, §3 auth/authz +
  RBAC, PII-safe logging), [ADR 0010](0010-security-and-privacy-by-design.md) (§4 secrets, §5 crypto,
  §6 crypto-shredding erasure + data locality, §8 DSA/JMStV hooks, §9 Impressum routing),
  [ADR 0011](0011-api-design.md) (§9 auth in contract; future withdrawal/DSAR endpoint surface),
  ADR 0012 (frontend consent-capture UI — Planned), ADR 0014 (DevOps: backup-retention policy — Planned),
  ADR 0019 (analytics/telemetry consent — Planned), ADR 0023 (event-payload personal-data classification
  — Planned; owns the §3 per-field exclusion mechanism),
  [`docs/legal/eu-de-compliance-matrix.md`](../legal/eu-de-compliance-matrix.md) (authoritative
  applicability/deadlines), [`docs/legal/dsa5-content-boundary.md`](../legal/dsa5-content-boundary.md).
  Primary sources checked: [DSGVO Art. 30](https://gdpr-info.eu/art-30-gdpr/) (RoPA small-org exemption),
  [DSGVO Art. 12](https://gdpr-info.eu/art-12-gdpr/) (one-month DSAR deadline). Issue #17.
