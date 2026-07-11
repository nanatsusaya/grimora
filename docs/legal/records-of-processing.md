# Records of Processing, Processor Register & DPIA Screening

> **What this is.** A **living project-compliance record** operationalizing [ADR 0015](../adr/0015-compliance-and-data-protection.md)
> §5–§7 (GDPR/DSGVO): the Art. 30 Records of Processing (RoPA), the Art. 28 processor/sub-processor
> register, the Chapter V transfer register, and the Art. 35 DPIA screening. It is a **working checklist,
> NOT legal advice** — before onboarding real users, have it reviewed by a qualified data-protection
> professional. It contains **no real personal data** (only the *categories* processed).
>
> **Maturity note (be honest — cf. `docs/STATUS.md` legend).** Grimora currently runs **offline-only on
> localhost**: there are **no accounts, no cloud, and no active sub-processors handling real user data
> yet**. The tables below therefore describe the **designed** processing (for when cloud sync / accounts /
> AI ship) and mark each row's **current status**. Every field tagged **☐ TODO (owner/legal)** requires the
> project owner's or a lawyer's input and must be completed **before go-live** — the agent scaffolds the
> structure, purposes and data categories; it cannot assert a signed DPA, a certification, or a legal
> conclusion.
>
> Last reviewed: **2026-07-12** (initial scaffold, issue #71). Review cadence: whenever a purpose or
> sub-processor is added or changed, and as a mandatory **go-live gate**.

## 1. Controller & governance

| Field | Value |
| --- | --- |
| **Controller (Verantwortlicher)** | ☐ **TODO (owner)** — name + contact of the natural/legal person operating Grimora (ties to the Impressum, #72 / ADR 0015 §9). |
| **Controller contact / privacy contact** | ☐ **TODO (owner)** — email/postal address for data-subject requests (Art. 12–23). |
| **Data Protection Officer (DPO)** | **Not appointed.** No Art. 37 trigger at current scale (no large-scale / special-category / systematic-monitoring core activity — see §5 DPIA). Re-assess if a DPIA re-trigger fires. |
| **Joint controllers / representatives** | None. (An EU representative under Art. 27 is only relevant if the controller is established outside the EU — ☐ TODO (owner) to confirm establishment.) |

## 2. Records of Processing Activities (Art. 30(1))

Lawful basis per ADR 0015 §5: the **core service** is **contract-necessity — Art. 6(1)(b)** (so a consent
withdrawal never disables the service); **consent — Art. 6(1)(a)** covers only what is *not* necessary to
the service (external-AI transmission, later analytics); **legitimate interest — Art. 6(1)(f)** is used
only where recorded here (minimal security logging). "Transfers" is the **Chapter V** cross-border
mechanism (see §4) — kept strictly separate from the Art. 6 processing basis (ADR 0015 §5 amendment).

| # | Purpose | Data categories | Data subjects | Lawful basis (Art. 6) | Recipients / processors (§3) | Transfers (Ch. V, §4) | Retention | Current status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P1 | **Account & authentication** | Email, authentication credentials/tokens, account id | Registered users | **6(1)(b)** contract-necessity | Supabase (Auth) | None (EU region) | While account active; erased on deletion / Art. 17 (ADR 0015 §4) | *Designed — not active (offline, no accounts yet)* |
| P2 | **Character / campaign management** (the core service) | User-authored content: character names + sheet data, campaign names, campaign membership, GM/player roles | Registered users; **other players** whose data appears in a shared campaign | **6(1)(b)** contract-necessity | Supabase (Postgres event log + read models) | None (EU region) | While account active; **crypto-shredded** on erasure (ADR 0023 §3/§5) | *Designed — runs locally today; no cloud copy yet* |
| P3 | **Assets** (images/maps/tokens) | User-uploaded binary assets + filenames | Registered users | **6(1)(b)** contract-necessity | Object storage (Cloudflare R2 / Supabase Storage / MinIO self-host) | ☐ TODO — depends on chosen region | While referenced by an aggregate; erased with it | *Designed — not active* |
| P4 | **External-AI assistance** (optional chat) | Prompt content — may include the user's **and other campaign members'** character/campaign data (ADR 0015 §3) | Users + all campaign members whose data is in the prompt | **6(1)(a)** consent — from **all affected subjects** (ADR 0015 §3, "all-subjects rule") | External AI provider (Anthropic / OpenAI) **when enabled**; local Ollama needs no transfer (no-consent default, ADR 0008) | **Chapter V per provider** (DPF or SCC+TIA, §4) | Minimal / zero at provider — **no training, minimal-zero retention** required (ADR 0015 §6) | *Designed — off by default; opt-in after consent* |
| P5 | **Security & diagnostic logging** | PII-**redacted** operational logs (ADR 0009 §2) | Users (incidental) | **6(1)(f)** legitimate interest (service security/diagnostics) | Sentry (when enabled) | ☐ TODO — Sentry region/mechanism | Short-lived, diagnostics only | *Designed — not active* |
| P6 | **Product analytics** | ☐ TODO (defined in ADR 0019) | Users | **6(1)(a)** consent | ☐ TODO (ADR 0019) | ☐ TODO | ☐ TODO | **Planned only** — ADR 0019 not yet written; **not active** |

> Concrete **retention periods** per data class are an **operational policy finalized when real aggregates
> exist** (ADR 0015 §5 — deferred with a trigger, not guessed here). ☐ TODO (owner) before go-live.

## 3. Processor / sub-processor register (Art. 28)

Each sub-processor requires a **signed Data Processing Agreement (DPA / Auftragsverarbeitungsvertrag,
Art. 28)** **before it handles real user data**. Status fields are **owner/legal input** — the agent
cannot assert a signed contract.

| Sub-processor | Role | Region | DPA (Art. 28) status | Transfer mechanism (§4) | Required safeguards |
| --- | --- | --- | --- | --- | --- |
| **Supabase** | Auth + Postgres + Storage | EU region (select at project creation) | ☐ **TODO (owner)** — sign before real data | None if EU-hosted (confirm region) | EU region; RLS tenant isolation (ADR 0005 §7) |
| **Cloudflare** | Pages hosting + R2/CDN (assets) | ☐ TODO (region) | ☐ **TODO (owner)** | ☐ TODO — confirm EU/adequacy | Content-addressed assets; no event-log data on CDN |
| **Sentry** | Error/diagnostic tracking | ☐ TODO (EU vs US instance) | ☐ **TODO (owner)** | ☐ TODO (if US) | PII redaction enforced at the adapter (ADR 0009 §2) |
| **Anthropic** (Claude) | External AI (opt-in) | **US** | ☐ **TODO (owner)** | **DPF (Art. 45) if certified, else SCC (Art. 46) + TIA** (§4) | **No training on data; minimal/zero retention** (use a zero-data-retention endpoint if offered) |
| **OpenAI** | External AI (opt-in) | **US** | ☐ **TODO (owner)** | **DPF or SCC + TIA** (§4) | **No training; minimal/zero retention** |
| **Ollama** (local) | Local AI (no-consent default) | On-device / self-host | N/A — no data leaves the boundary | N/A | The privacy-preserving default (ADR 0008) |

**Go-live gate (checklist, not code):** *every **active** sub-processor has a **signed DPA** (and, for a
cross-border transfer, a completed **TIA** — §4) before the first real user is onboarded* (ADR 0015 §6).

## 4. International transfers (Chapter V)

For a **US-based** sub-processor (today: the external AI providers, when enabled), establish the transfer
mechanism **per provider, before enabling it**, in this order (ADR 0015 §6):

1. **Adequacy via the EU–US Data Privacy Framework (Art. 45)** — *only if* the provider is **DPF-certified
   for the relevant data**; verify against the **official DPF list** (primary source) per provider. ☐ TODO
   (owner) — record the certification check + date per provider.
2. Otherwise **Standard Contractual Clauses (Art. 46) + a Transfer Impact Assessment (TIA)**. ☐ TODO
   (owner/legal) — complete and attach a TIA per provider.

**Art. 49(1)(a) explicit-consent derogation is NOT the transfer mechanism** for a standing product feature
(EDPB Guidelines 2/2018 reserve it for *occasional, non-repetitive* transfers). Consent (Art. 6(1)(a)) is
the **processing** basis for third-party data (§2 P4) — a separate question from the transfer safeguard,
not a substitute for it (ADR 0015 §5/§6).

| Provider | DPF-certified (Art. 45)? | Fallback: SCC + TIA (Art. 46) | Verified on | Status |
| --- | --- | --- | --- | --- |
| Anthropic | ☐ TODO (check DPF list) | ☐ TODO (TIA) | — | ☐ TODO (owner) |
| OpenAI | ☐ TODO (check DPF list) | ☐ TODO (TIA) | — | ☐ TODO (owner) |

## 5. DPIA screening (Art. 35)

**Screening conclusion (ADR 0015 §7, R3): a full DPIA is _not_ required at the current scale.** Basis: no
**large-scale** processing, no **systematic monitoring** of a publicly accessible area, and **no
special-category (Art. 9) data by design**. This is a documented, accepted legal-risk position — **not** an
assertion that none will ever be needed.

**Mandatory re-trigger — a full DPIA is required _before_ any of:**

- processing **special-category data** (Art. 9);
- **large-scale** processing of personal data;
- **systematic profiling / scoring** or automated decision-making with legal/similar effect;
- **public content feeds / user-generated public areas** (ADR 0010 §8);
- a new high-risk sub-processor or transfer not covered above.

| Field | Value |
| --- | --- |
| Screening date | 2026-07-12 (scaffold) |
| Screened by | ☐ TODO (owner) |
| Conclusion | No full DPIA at current scale (see above) |
| Next review | On any re-trigger, or before go-live |

## 6. Maintenance

This is a **living document** (ADR 0015 §6). Update it — and re-run the go-live gate — whenever a
processing purpose, data category, sub-processor, or transfer changes. It is cross-referenced from
[`eu-de-compliance-matrix.md`](eu-de-compliance-matrix.md) and satisfies the ADR 0015 §6/§7 follow-up
deliverable (issue #71). **Not legal advice** — obtain professional review before processing real
personal data.
