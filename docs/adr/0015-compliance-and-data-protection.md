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
  withdrawal/DSAR endpoint), ADR 0019 (analytics/telemetry consent — still Planned).

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
(solo, pre-revenue, no public launch) — trigger-gated, not speculative.

### 2. Consent is an event-sourced, versioned, scoped record

Consent is **first-class domain state**, recorded as **intention-revealing, past-tense events** on a
`Consent` aggregate (ADR 0004) — `consent.granted` / `consent.withdrawn`, **never** a generic
`setConsentFlag`. Each event records, at minimum: the **data subject** (user id), the **purpose**
(a closed purpose enum — e.g. `external-ai-processing`, later `analytics`), the **scope** (§3), the
**recipient/processor** it authorizes (e.g. `provider:anthropic`), the **policy/consent-text version**,
and the **timestamp**. This makes consent **auditable and provable** (DSGVO Art. 7(1) — the controller
must be able to demonstrate consent) directly from the event log, and **withdrawable** (Art. 7(3) —
withdrawal must be as easy as granting) by appending `consent.withdrawn`, which takes effect immediately
for all future processing. Consent state is exposed to the Application layer through a **`ConsentPort`**
(`core-domain/application/ports`), queried by any use case before a consent-gated action; the port is a
pure read over the folded consent projection, no I/O in Domain (ADR 0003 §1). The consent record's own
personal identifier is subject to the same crypto-shredding as other personal data on erasure (§5), but
the **non-personal** proof-of-consent structure survives (Art. 7(1) accountability vs. Art. 17 erasure are
reconciled the same way ADR 0010 §6 reconciles the audit log).

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
  a valid, un-withdrawn consent** covering **that provider**. If any affected subject has not consented,
  the system **must not transmit their personal data** — it either **redacts** the non-consented subjects'
  personal fields from the prompt or **withholds** the external call and **falls back to local Ollama**
  (ADR 0008 §7). Non-consented personal data is **never** sent to an external provider. The exact
  default when consent is partial (redact-and-proceed vs. local-fallback vs. block) is **O1**.
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
- **Identity verification:** the **authenticated account is the primary proof of identity** for a
  logged-in subject's request — DSAR flows run as authenticated use-cases, so no *additional* personal
  data is collected merely to verify a requester (data-minimization, ADR 0010 §6). Out-of-band requests
  (e.g. by email from a former user) are an operational edge case handled by the owner, not an
  architectural mechanism.
- **SLA:** requests are actioned **within one month** (DSGVO Art. 12(3)), extendable by two further
  months for complex/numerous requests, with the subject informed of any extension. This is an
  **operational SLA**, tracked as such; the architecture makes it *cheap to meet* (the use-cases above),
  it does not itself enforce a clock.

### 5. Retention, purpose limitation & data minimization (Art. 5)

- **Purpose limitation:** each processing purpose is named in the RoPA (§6) and, for consent-gated
  purposes, in the consent enum (§2); data collected for one purpose is not silently repurposed.
- **Data minimization (reaffirms ADR 0010 §6):** the account holds the **minimum identity**; optional
  fields stay optional; prompts to AI carry only what a task needs (ADR 0008 §6). No new collection is
  introduced by this ADR.
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
- **Release gate:** "every active processor has a signed DPA (and, for external transfers, a TIA)" is a
  **go-live checklist item** before real users are onboarded — a checklist gate, not a code artifact.

### 7. DPIA screening (Art. 35)

A **DPIA screening** is recorded now (in the RoPA doc) and concludes, at the **current scale**, that a
full DPIA is **not** required: no large-scale processing, no systematic monitoring, no special-category
(Art. 9) data by design. The screening defines explicit **re-trigger** conditions — a full DPIA is
required **before** any of: processing **special-category data**, **large-scale** processing, systematic
**profiling/scoring**, or public content feeds (ADR 0010 §8). Whether to accept this "no DPIA now"
conclusion is **O3** (a legal-risk acceptance, owner-domain).

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
  **owner's personal-data exposure** it requires (real name + reachable address), is **O2** (owner/legal).
- **DSA notice-and-action + ToS + point of contact** — the *architectural* hooks (addressable,
  individually removable, event-sourced uploads; takedown = domain event) are already ADR 0010 §8. This
  ADR owns the **ToS content, point-of-contact publication, and the notice-and-action operational
  workflow**, triggered **when users can upload content to others** (ADR 0006 §8). Content deliverable,
  not Phase-1 code.
- **Cookie / endpoint-storage consent (§25 TTDSG/TDDDG)** — **strictly-necessary** storage needs no
  consent; **anything else** (analytics, tracking) needs a prior opt-in. Grimora ships **no non-essential
  client storage** today; the **consent record mechanism** for it is §2's, but the **specific
  analytics/telemetry categories and banner** are **ADR 0019's** turf (still Planned) — routed there,
  **not decided here**, so we do not pre-empt that ADR.
- **Widerrufsbutton / Fernabsatzrecht (§312j BGB)** — mandatory since **19 Jun 2026**, but applicable
  **only once a paid consumer tier launches** (matrix). **Trigger:** before any paid tier goes live, the
  two-step withdrawal button + withdrawal flow must exist; the **contract-surface detail** is routed to
  **ADR 0011** (API/contract) at implementation time. Also coupled to **Gewerbeanmeldung /
  Kleinunternehmerregelung** (matrix) — business-registration steps the owner takes at monetization, not
  code. Nothing built now.

### 10. Enforcement (fitness functions)

- **New:** the external `AiProviderPort` adapter is reachable **only** via a use case that consults
  `ConsentPort` (§3) — a direct external-AI call that bypasses the consent gate is a harness-flagged
  boundary violation (ADR 0003 §2 / ADR 0010 §7), the consent analogue of default-deny authorization.
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
to the AI egress path** (per-payload subject enumeration, redaction/fallback) — the cost of doing the
transfer lawfully; a `ConsentPort` + consent aggregate is upfront design before any AI chat exists,
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
- **Redact-and-always-proceed on partial consent** — considered for §3; not fixed here because the safe
  default (redact vs. local-fallback vs. block) is a product/legal-risk call — left as **O1**.
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

## Open questions (for owner review)

- **O1 — External-AI consent granularity + partial-consent default (§3).** Confirm **campaign-scoped**
  consent (layered over an optional per-user default) as the grain, and choose the default when **not
  all** affected subjects have consented: **(a)** redact the non-consented subjects' personal data and
  proceed with the external call, **(b)** withhold the external call and fall back to **local Ollama**, or
  **(c)** block the AI action entirely. **Recommendation: campaign-scoped + never transmit non-consented
  personal data, defaulting to (b) local-fallback** (safest, keeps the app usable), with (a) redaction as
  a later refinement — because the invariant "no non-consented personal data leaves to a US provider" must
  hold regardless, and a local fallback preserves the frontend-first/AI-optional posture (ADR 0008 §7).
- **O2 — Impressum: when, and how to handle personal-data exposure (§9).** The matrix says an imprint is
  plausibly required **today** (offer beyond private/family use, incl. the public GitHub repo), yet a
  compliant §5-DDG imprint requires the owner's **real name + a reachable address**, which is itself a
  privacy exposure. **Recommendation (owner/legal): publish a minimal imprint when the first publicly
  reachable Grimora service/landing page goes live, and in the meantime add a lightweight contact/imprint
  to the public repo**, using a lawful **service/PO-box-style address** rather than a home address if the
  owner prefers — but this is a personal-data and legal-risk call for the owner, worth a short check with
  a lawyer given the *Abmahnung* exposure the matrix notes.
- **O3 — Accept the "no DPIA at current scale" screening (§7)?** Confirm that, at today's scale (no
  large-scale or special-category processing, no profiling), **no full DPIA is required**, recorded as a
  screening with explicit re-trigger conditions. **Recommendation: yes** — a documented screening +
  re-triggers is proportionate for a solo, pre-revenue project; a full DPIA is premature until one of the
  named triggers (special-category data, large scale, profiling, public content) fires.

## References

- [ADR 0003](0003-overall-architecture.md) (§6 privacy-by-design, §7 ports, §9 bounded contexts),
  [ADR 0004](0004-event-sourcing-cqrs.md) (intention-revealing events, immutable log),
  [ADR 0005](0005-persistence-and-sync.md) (EU-region storage; sync propagates erasure/redaction),
  [ADR 0008](0008-ai-provider-abstraction.md) (§5 AI-Act labelling, §7 external-provider consent +
  Ollama fallback), [ADR 0009](0009-cross-cutting-concerns.md) (§1 error categories, §3 auth/authz +
  RBAC, PII-safe logging), [ADR 0010](0010-security-and-privacy-by-design.md) (§4 secrets, §5 crypto,
  §6 crypto-shredding erasure + data locality, §8 DSA/JMStV hooks, §9 Impressum routing),
  [ADR 0011](0011-api-design.md) (§9 auth in contract; future withdrawal/DSAR endpoint surface),
  ADR 0019 (analytics/telemetry consent — Planned),
  [`docs/legal/eu-de-compliance-matrix.md`](../legal/eu-de-compliance-matrix.md) (authoritative
  applicability/deadlines), [`docs/legal/dsa5-content-boundary.md`](../legal/dsa5-content-boundary.md).
  Primary sources checked: [DSGVO Art. 30](https://gdpr-info.eu/art-30-gdpr/) (RoPA small-org exemption),
  [DSGVO Art. 12](https://gdpr-info.eu/art-12-gdpr/) (one-month DSAR deadline). Issue #17.
