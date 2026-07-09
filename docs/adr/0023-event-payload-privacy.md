# ADR 0023 — Event-payload privacy classification, per-subject encryption & crypto-shredding keys

- **Status:** Proposed
- **Date:** 2026-07-09
- **Deciders:** project owner + AI agents
- **Depends on:** [ADR 0003](0003-overall-architecture.md) (§1 dependency rule, §6.2 adapters validate
  input, §7 ports), [ADR 0004](0004-event-sourcing-cqrs.md) (§2 event envelope + metadata [as amended
  2026-07-09], §7 snapshots, §10 `describe()`, §6 upcasting), [ADR 0005](0005-persistence-and-sync.md)
  (§3 insert-only replication, §7 "sync must propagate erasure/redaction"), [ADR 0006](0006-plugin-system.md)
  (§3 Definition APIs JSON-Schema-validated at load), [ADR 0009](0009-cross-cutting-concerns.md) (§2
  PII-safe logging), [ADR 0010](0010-security-and-privacy-by-design.md) (§4 `SecretsPort`/key handling,
  §5 `CryptoPort`, §6 crypto-shredding + selective field encryption "only where identified" — R2/R3
  this ADR makes concrete), [ADR 0015](0015-compliance-and-data-protection.md) (§3/R1 external-AI
  all-subjects transfer rule — the exclusion mechanism routed here, §4 DSAR/erasure), [ADR 0025](0025-plugin-sdk-v0-contract.md)
  (§1 additive `0.x` growth — the SDK privacy-metadata addition is additive).
  Relates to ADR 0014 (DevOps: key-store/backup retention ops — Planned), ADR 0024 (sync-trust &
  realtime — Planned; sync **integrity/forgery** is *its* concern, not this ADR's).

## Context

ADR 0010 §6 chose **crypto-shredding** (a per-subject key, destroy-to-erase) as the DSGVO-erasure
strategy against the immutable event log, and **transparent-at-rest by default with selective
field-encryption "only where identified"** (R3) — deferring *which* fields, *what a subject is*, and
*how keys work* to a later ADR "when real aggregates are designed." That ADR is this one (issue #43).
A cross-model ADR review (2026-07-09) sharpened three points this ADR now owns, because they otherwise
**harden into the event schema** once real aggregates exist:

1. **What is a "subject"** in a *shared* campaign, and how are events that touch **several** people
   handled? (issue #43)
2. **Which fields are personal, and how is the tagging *enforced*** — including for **plugin-defined**
   payloads (does the plugin SDK need to carry privacy metadata)? And the ADR 0004 §2 amendment already
   established that event **metadata** (`actorId`, `context.deviceId`/`sessionId`) is pseudonymous
   **personal data**, so metadata is in scope, not only payloads.
3. **Key management for crypto-shredding in the offline, multi-device model** — distribution to the
   member devices that must fold/project locally, membership changes, snapshots, backups, and
   server-side projections. The review found this **owned by no ADR**.

This ADR also owns the **concrete per-field exclusion mechanism** that ADR 0015 §3/R1 (external-AI
transfer: transmit a subject's personal data only if that subject consented) explicitly routed here,
and must honour **Constraint D** (external review): crypto-shredding collides with ADR 0004 §10's
human-readable `describe()` and with search — both must **degrade gracefully** when a personal field is
erased/unavailable ("name changed", not "name set to Alrik").

**Repo state:** Phase 1 — only `packages/shared-types` + the walking-skeleton seed exist; **no real
personal aggregates yet**. This is a decision record that shapes the event schema *before* they are
built; it introduces **no** crypto/persistence mechanism of its own — it instantiates ADR 0010's
`CryptoPort`/`SecretsPort` and ADR 0005's sync. **Trust boundary note:** the server is the **controller**
(self-hostable), **not** a zero-knowledge party — encryption here exists to make **erasure** and
**data-minimisation** enforceable at rest, *not* to hide plaintext from the operator (that would be
end-to-end encryption, explicitly **out of scope**, §4).

## Decision

### 1. Scope — this ADR makes ADR 0010 §6 concrete; it does not re-decide crypto or sync

This ADR owns: the **privacy classification** of event fields/metadata (§2–§3), the **per-subject key
model** for crypto-shredding (§4), the **erasure mechanics** across replicas/snapshots/backups (§5), the
**graceful-degradation** contract (§6, Constraint D), and the **external-AI exclusion mechanism** (§7).
It **reuses** ADR 0010 §5 `CryptoPort` (primitives), ADR 0010 §4 `SecretsPort`/key storage, and ADR 0005
§3/§7 sync (propagation) unchanged. **Sync *integrity*** (can a client forge a domain-valid-looking
event?) is a **different** gate owned by **ADR 0024**, not here.

### 2. Privacy classification is declarative, per-field, and validated at load

Every field of every event payload carries a **declared privacy class** — classification is **data, not
convention** (fragile heuristics are rejected, Alternatives):

- **`nonPersonal`** — structural/rules data (trait ids, dice pips, versions, formula AST, timestamps of
  mechanical events). Stored **plaintext**, fully queryable/searchable/indexable.
- **`personal(subjectRef)`** — a discrete personal datum (a name, an avatar id) belonging to the data
  subject named by `subjectRef`. Subject to §4 encryption scope and §5 erasure.
- **`personalFreeText(subjectRef)`** — free-text authored by `subjectRef` (campaign notes, handouts,
  character backstory) that **may textually mention third parties**; treated as personal, with the
  extra third-party-mention handling of §7 (R1).

Rules:
- **A field's `subjectRef` names its data-owner.** A single event may carry fields for **multiple**
  subjects (e.g. a session event referencing several participants); each personal field is independently
  owned and independently erasable (§5).
- **Core** event types declare their own field classification. **Plugin-defined** payloads declare it
  through a **new, additive plugin-SDK privacy-metadata surface** (a per-field annotation on the
  plugin's event/trait Definition APIs). Adding it is **additive within the SDK `0.x` line** (ADR 0025
  §1), so ADR 0025 needs no change.
- **Fail-fast:** an event type (core or plugin) with an **unclassified** field **fails to load**, exactly
  like the JSON-Schema Definition-API validation of ADR 0006 §3. There is **no silent default** — but the
  *enforced* posture is fail-safe: a loader that cannot classify a field treats it as `personal` and
  refuses to expose it until classified (§8 fitness function).

### 3. Metadata identifiers are pseudonyms, erased via the account mapping (not per-event crypto-shredding)

The ADR 0004 §2 amendment established `actorId`/`deviceId`/`sessionId` as pseudonymous personal data.
Rather than encrypt these in **every** event (they are needed plaintext for provenance, causal ordering
and authorization-on-replay), they are treated as **pseudonyms**:

- `actorId`/`deviceId` are **opaque, stable pseudonyms** — never the person's name/email. The
  **re-identification mapping** (pseudonym → real identity) lives **only in the relational auth/account
  store** (ADR 0009 §3 / Supabase), **not** in the event log.
- **Erasing an account destroys that mapping** (relational delete), rendering the pseudonyms in the
  immutable log **non-attributable** to a natural person (DSGVO recital 26 pseudonymisation→effective
  anonymisation relative to the controller) — while preserving the log's structural/provenance
  integrity. This is why metadata needs **no** per-event key.
- This keeps provenance/replay working and resolves the erasure tension the ADR 0004 amendment surfaced.

### 4. Encryption & key hierarchy — per-subject DEK, envelope-distributed to authorized devices

Personal fields **within the encrypted scope (R3)** are encrypted **at rest** via `CryptoPort`
(ADR 0010 §5); **`nonPersonal` stays plaintext**, and lower-sensitivity personal fields *outside* the
encrypted scope rely on pseudonymisation + read-model deletion + account-mapping destruction (§3/§5)
instead of a key (this preserves query/search and avoids the crypto-sprawl ADR 0010 §5 warned against).
**R3 scope:** a **minimal high-sensitivity subset** — real name, email and `personalFreeText` — is
field-encrypted; the exact list is recorded in the RoPA (ADR 0015 §6) and can be tightened later. The
key model below is the same regardless of scope:

- **One Data Encryption Key (DEK) per subject** (`DEK_S`). Chosen over a per-campaign key because DSGVO
  Art. 17 requires erasing **one** person without re-keying everyone else's shared data — a per-campaign
  key cannot do single-subject erasure. Per-subject granularity is the cost of lawful erasure.
- **Envelope distribution (offline-first):** because a shared campaign replicates a subject's personal
  fields to **all authorized member devices** (they legitimately see them during play, ADR 0005 §7), and
  folding/projection happens **locally** (offline-first), each authorized recipient gets `DEK_S`
  **wrapped** under a key it controls (`Wrap(DEK_S, KEK_recipient)`), distributed as its own synced,
  access-controlled record. `DEK_S`/`KEK` storage uses ADR 0010 §4 key handling; **keys are never in the
  event payload, never in logs** (ADR 0009 §2).
- **Not end-to-end:** the controller (server) may hold `DEK_S` in its key store to run the *minimal*
  server-side projections it needs (§9). E2EE (server never sees plaintext) is **out of scope** —
  Grimora is a self-hostable controller-operated service, and E2EE would break server projections, search
  and recovery. The encryption's job is **erasure-enablement + at-rest minimisation**, not zero-knowledge.

### 5. Erasure mechanics (Art. 17) — destroy key + mapping, propagate a redaction event, honest boundary

Erasing subject **S** (makes ADR 0010 §6 + ADR 0015 §4 concrete):

1. **Destroy `DEK_S`** and all its wraps at the **authoritative key store** (controller/server) → all of
   S's ciphertext (across every event, in the cloud store **and its backups**) becomes permanently
   undecryptable. Prerequisite (invariant): the **key store is backed up *separately* from the event
   data**, with a retention policy such that restoring a data backup **cannot resurrect a destroyed key**
   (ADR 0014 owns the backup ops; this ADR fixes the invariant).
2. **Destroy the account mapping** for S's pseudonyms (§3).
3. **Emit a `subject.erased` redaction event** that **sync propagates** (ADR 0005 §7) instructing **every
   replica** to (a) delete local **plaintext read-models and snapshots** derived from S's data and (b)
   drop its cached `Wrap(DEK_S, …)` and any unwrapped `DEK_S`. Honest first-party clients comply on next
   sync.
4. **Snapshots** (ADR 0004 §7) are **derived & disposable** — invalidated and rebuilt from the (now
   un-decryptable) log, so they are **not** a separate erasure gap; they store the **encrypted** field
   form, never a decrypted personal snapshot.

**Honest residual boundary (R2 — accepted):** crypto-shredding definitively covers the **controller's**
stores (cloud DB, server backups) and instructs all app replicas to purge. It **cannot** reach data a
member **already saw or exported** on a device outside the controller's control (a rooted device that
extracted `DEK_S`, a screenshot, a manual export) — this is the **irreducible** limit of *any* system
that shows data to a user, not a Grimora-specific hole; the only alternative is not offering
offline/shared play. This boundary is **accepted** and **documented in the RoPA** (ADR 0015 §6).

### 6. Graceful degradation (Constraint D) — describe(), projections and search tolerate missing fields

A personal field may be **absent** (erased, or the reader is not authorized / lacks the key). Everything
that renders history must degrade, never crash:

- **`describe()`** (ADR 0004 §10) renders **intent without the value** when a personal field is
  unavailable: `character.renamed` → "name changed" (not "name set to *Alrik*"). A `describe()` that
  *hard-requires* a personal field's value is a **defect** (§8).
- **Projections/read-models** index and display **only** what is `nonPersonal` or currently decryptable;
  an unavailable personal field renders as a **redaction placeholder**, and the projection still builds.
- **Search** indexes `nonPersonal` fields freely; personal fields are searchable only within the
  authorized, decrypted read-model scope, and an erased field simply drops out of the index on rebuild.

### 7. External-AI exclusion mechanism (resolves ADR 0015 §3/R1)

The §2 classification is exactly the machinery ADR 0015 §3/R1 deferred. At the AI egress boundary
(ADR 0015 §10 consent gate), a payload is filtered **field-by-field against classification + consent**:

- A **`nonPersonal`** field always flows.
- A **`personal(subjectRef)`** field is included **only if `subjectRef` has a valid, un-withdrawn consent
  for that provider** (ADR 0015 §3); otherwise it is **dropped** (structural filtering — reliable,
  because ownership is declared, not guessed).
- A **`personalFreeText`** field is the hard case (**R1**): it may mention third parties who never
  consented. It is **not** transmitted to an external provider unless **all campaign members whose data
  could be in scope have consented**; otherwise the action stays local (Ollama). The **erasure boundary**
  is documented: B's mention inside A's note is **A's content** — erased when A is erased, not when B is.

This makes ADR 0015's "never transmit non-consented personal data" **mechanically enforceable** rather
than aspirational.

### 8. Enforcement (fitness functions)

- **New:** every core/plugin event-payload field has a **declared privacy class**, or the type **fails to
  load** — the classification is complete by construction (harness + load-time check, ADR 0006 §3 style).
- **New:** **no `personal*` field is persisted plaintext** in the event-store payload, nor logged
  (extends ADR 0009 §2 PII redaction and ADR 0010 §7): a personal field reaching the store un-encrypted
  is a boundary violation.
- **New:** `describe()` / projection code must **type-check without hard-requiring** a personal field's
  value (Constraint D) — enforced via the field-access type (an `Option`/redactable wrapper), so "render
  the intent when the value is absent" is a compile-time obligation, not a convention.
- **Reaffirmed:** the external-AI egress consult of classification+consent is the ADR 0015 §10 consent-gate
  fitness function, now with a concrete filter to assert against.

## Consequences

**Positive:** crypto-shredding becomes **buildable** — a subject, a field's owner, and a key model are
now concrete, so real aggregates can be designed against a stable event schema instead of retrofitting
privacy later (the expensive path ADR 0010 warned of); **single-subject erasure** is possible in shared
campaigns (per-subject DEK); the **metadata-pseudonym** decision resolves the ADR 0004 amendment's
tension without encrypting every event; ADR 0015's external-AI rule gets a **reliable, declared-ownership
filter** instead of fragile free-text redaction; Constraint D is met **by the type system**; the honest
erasure boundary is **named**, not hidden.

**Negative / costs:** per-subject DEKs plus envelope-distribution to member devices is **real
key-management complexity** (wrapping, membership changes, revocation) — the price of lawful
single-subject erasure in an offline/shared model; classification is **mandatory metadata on every event
field** (core and plugin), a modest authoring burden enforced at load; field-encrypted personal data is
**not server-queryable** in plaintext, constraining server-side search/analytics on those fields (§9);
and the accepted residual boundary (R2) means erasure is **not** absolute against copies already on
member devices — an inherent, documented limit. The chosen encrypted scope (R3 — a minimal
high-sensitivity subset) trades some cryptographic-erasure strength on the unencrypted personal fields
for queryability and lower complexity.

## Alternatives considered

- **Per-campaign key instead of per-subject DEK** — rejected: cannot erase one person without re-keying
  the whole campaign; single-subject Art. 17 erasure forces per-subject granularity (§4).
- **Encrypt event metadata (`actorId` etc.) per event** — rejected: needed plaintext for provenance/
  replay/authorization; pseudonymisation + destroying the account mapping (§3) erases attribution far
  more cheaply.
- **Heuristic/convention-based PII detection** (scan values, name-shaped fields) — rejected: fragile, a
  missed field is a lawful-basis breach; declared per-field classification (§2) is reliable and
  enforceable.
- **End-to-end encryption (server never sees plaintext)** — rejected as the default: breaks server-side
  projections, search and recovery for a self-hostable controller-operated service; crypto-shredding
  achieves erasure without it. (Could be an opt-in mode later; not now.)
- **Free-text redaction pass (NLP) for external AI** — rejected as the *primary* mechanism: unreliable
  for third-party mentions; structural field-ownership filtering (§7) is reliable, and free-text is
  handled conservatively (O1).
- **Defer all of this until aggregates exist** — rejected: classification and the key model **shape the
  event schema**; deciding them after real personal aggregates are built is the expensive retrofit
  ADR 0010 explicitly wanted to avoid.

## Resolved questions (owner decisions, 2026-07-09)

- **R1 — Free-text fields that mention third parties (§2/§7).** Decided as recommended **(b)**: a
  `personalFreeText` field is transmitted to an external AI provider **only if all campaign members whose
  data could be in scope have consented**; otherwise the action stays local (Ollama). The **erasure
  boundary** is documented — B's mention inside A's note is **A's content**, erased when A is erased, not
  when B is. A plain-language user-facing explanation is deferred to the user handbook (below).
- **R2 — Residual erasure boundary (§5).** **Accepted:** crypto-shredding erases the controller's stores
  + backups and instructs all replicas to purge, but **cannot** reach data already seen/exported on a
  device outside the controller's control — an irreducible limit for any offline/shared-play system,
  documented as the erasure boundary in the RoPA (ADR 0015 §6). User-facing risk explanation deferred to
  the user handbook.
- **R3 — Field-encryption scope (§4).** Decided as recommended **(b) minimal high-sensitivity subset**:
  real name, email and `personalFreeText` are field-encrypted with the per-subject DEK; lower-sensitivity
  personal fields rely on pseudonymisation + read-model deletion + account-mapping destruction (§3/§5).
  The exact encrypted-field list is recorded in the RoPA (ADR 0015 §6) and can be tightened later. The
  key model (§4) is unchanged — only the scope is set. User-facing explanation deferred to the user
  handbook.

**User handbook (deferred, owner-initiated).** The owner will start a user handbook after this ADR
merges; it will carry the plain-language, user-facing explanations of R1 (free-text / third-party data),
R2 (the erasure boundary) and R3 (what is and is not encrypted). Recorded here so the obligation is not
lost — the handbook document/structure is **not** created by this ADR.

## References

- [ADR 0003](0003-overall-architecture.md) (§1 dependency rule, §6.2 input validation, §7 ports),
  [ADR 0004](0004-event-sourcing-cqrs.md) (event envelope + metadata [amended], §7 snapshots, §10
  `describe()`, §6 upcasting), [ADR 0005](0005-persistence-and-sync.md) (§3 replication, §7 erasure
  propagation), [ADR 0006](0006-plugin-system.md) (§3 Definition-API validation at load),
  [ADR 0009](0009-cross-cutting-concerns.md) (§2 PII-safe logging, §3 auth store),
  [ADR 0010](0010-security-and-privacy-by-design.md) (§4 secrets/keys, §5 `CryptoPort`, §6
  crypto-shredding + selective field encryption — R2/R3), [ADR 0015](0015-compliance-and-data-protection.md)
  (§3/R1 external-AI transfer rule + exclusion mechanism, §4 DSAR/erasure, §6 RoPA),
  [ADR 0025](0025-plugin-sdk-v0-contract.md) (§1 additive `0.x` growth for the SDK privacy metadata),
  ADR 0014 (key-store/backup retention ops — Planned), ADR 0024 (sync integrity/trust — Planned),
  [`docs/legal/eu-de-compliance-matrix.md`](../legal/eu-de-compliance-matrix.md). Issue #43.
