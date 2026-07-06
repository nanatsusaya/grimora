# EU / German legal compliance matrix

- **Status:** Living reference (update as laws/deadlines change or Grimora's scale/features change)
- **Date:** 2026-07-06

## Summary

Grimora must comply with current EU + German law (vision.md). This matrix tracks **every regulation
identified as potentially applicable**, Grimora's current applicability assessment, the relevant
deadline, and which ADR/doc owns the detailed decision — so no single ADR has to duplicate legal
research, and this file can be updated independently as laws/deadlines shift or the project scales
past an exemption threshold (e.g. leaving micro-enterprise status).

**How to use this file:** before writing/amending an ADR that touches compliance (0009, 0010, 0015,
0016, and any future one), check this matrix first for the current applicability read and deadline;
update the row here if research reveals a change, rather than re-deriving it inside the ADR.

## Matrix

| Regulation | Deadline / status (as of 2026-07-06) | Applies to Grimora? | Owning ADR/doc |
| --- | --- | --- | --- |
| **DSGVO/BDSG** (GDPR) | In force | **Yes** — any personal data (accounts, characters tied to users) | ADR 0009 (auth/logging), ADR 0015 (ops: consent, DSAR, erasure) |
| **DSGVO international transfers** (SCC + Transfer Impact Assessment) | Post-*Schrems II*: SCCs alone insufficient, TIA required; only 14 countries have an adequacy decision (Jan 2026) | **Yes, once external AI providers are enabled** (ADR 0008 §7) — Claude/OpenAI are US-based | ADR 0015 (detail); referenced from ADR 0008 §7 |
| **EU AI Act — Art. 50 transparency** | **2 Aug 2026** — chatbot disclosure + AI-generated-content marking. **Not postponed** by the May 2026 Digital Omnibus (only high-risk Annex III/I obligations were deferred, to Dec 2027 / Aug 2028). | **Yes, imminent** — the in-app AI chat (ADR 0008) is a deployer-facing chatbot | ADR 0008 (already requires labelling); ADR 0010 (deployer obligations detail) |
| **EU AI Act — high-risk (Annex III)** | Deferred to **2 Dec 2027** | **No** — Grimora's AI chat/tools are not in any Annex III category (no biometric ID, critical infra, education/employment scoring, law enforcement, migration, justice) | Note only; re-check if AI tool scope ever expands |
| **EU Cyber Resilience Act (CRA)** | Reporting obligations from **11 Sep 2026**; full obligations from **11 Dec 2027** | **Partial / phase-dependent** — pure SaaS is largely outside CRA's "product with digital elements" scope; **flips to in-scope once mobile/desktop apps ship** (Phase 5/7, roadmap.md) | ADR 0010 (threat model, vulnerability reporting process) |
| **BFSG** (Barrierefreiheitsstärkungsgesetz / EAA) | In force since **28 Jun 2025**, no transition period for web/apps | **Not in scope today** — confirmed by the owner (2026-07-06): Grimora is currently developed by a **private individual**, not a registered commercial entity. BFSG (like most commercial-law obligations) attaches to *Wirtschaftsakteure*/*Unternehmer* — it does not yet apply at all, which is a stronger position than "micro-enterprise exemption" (that reasoning only matters *once* Grimora becomes a registered business). **Re-evaluate as soon as a legal entity/Gewerbe is registered** (see the new business-registration row below) — at that point, the micro-enterprise-providing-services exemption (≤ 2M€ turnover/balance sheet) becomes the relevant test. | ADR 0007 (already commits to WCAG 2.2 AA voluntarily); ADR 0016 (accessibility ADR, formalizes) |
| **Digital Services Act (DSA)** | In force | **Baseline hosting-service obligations apply regardless of size** once users can upload content (character images, campaign notes, content packs): point of contact, notice-and-action for illegal content, moderation rules in ToS. Heavier "online platform" obligations (trusted flaggers, out-of-court dispute resolution, ad transparency) are **waived** — Grimora qualifies as micro/small enterprise | ADR 0010 (moderation/notice-and-action as a security/abuse concern); ADR 0015 (ToS content) |
| **NIS2** (German BSI registration) | Registration deadline **was 6 Mar 2026**; threshold: >50 employees or >10M€ turnover/balance sheet, specific sectors | **No** — Grimora (solo owner + AI agents) is far below threshold, and is a *user* of cloud services, not a qualifying provider | Re-check if headcount/revenue or role (e.g. becoming a hosting provider for others) changes |
| **EU Data Act** (cloud switching) | In force since **12 Sep 2025**; switching-charge ban from **12 Jan 2027** | **Applies to Grimora's own cloud contracts** (Supabase, Cloudflare/R2) as a *customer* right, not an obligation Grimora owes to others | ADR 0005 (persistence/sync) — confirm Supabase contract allows the mandated exit/portability terms |
| **Fernabsatzrecht / Widerrufsbutton** (§312j BGB button solution) | New two-step "Widerrufsbutton" mandatory **from 19 Jun 2026**, explicitly covers SaaS/digital-content consumer contracts | **Yes, once any paid tier/subscription launches** (hosting.md cost model) | New — not yet owned by any planned ADR; likely ADR 0011 (API/contract) or ADR 0015 (compliance ops) at implementation time |
| **Jugendschutz (JMStV/JuSchG)** | In force | **Depends on product decisions not yet made** — user-generated campaign content/images could be developmentally-sensitive; needs age-rating/labelling and possibly technical protections (age gate) if content moderation doesn't bound this. **Confirmed by the owner (2026-07-06): deliberately deferred, to be decided in ADR 0010** rather than here. | **ADR 0010** (owner-confirmed) |
| **Digital Fairness Act (DFA)** | **Not yet law** — Commission proposal expected Q3/Q4 2026 (dark patterns, addictive design, unfair personalization) | **Not yet applicable** — track for when UI patterns (subscription flows, nudges) are designed | Watch-list; revisit when the proposal is tabled |
| **`.game` gTLD** | Open, unrestricted generic TLD since 2015 (currently operated by XYZ.COM); standard UDRP for trademark disputes | No special legal obligations beyond standard ICANN reserved-names/UDRP rules; no gambling-law trigger identified (dice generate character values, not wagers) | `docs/naming.md` |
| **Gewerbe-/Unternehmensregistrierung** (business registration & licensing, e.g. Gewerbeanmeldung, Kleinunternehmerregelung §19 UStG, Impressumspflicht) | **Not yet researched** | **Flagged as the next topic to investigate** (owner, 2026-07-06) — Grimora is currently run by a private individual with no registered business entity; this needs to change before any commercial activity (paid tiers) or several exemptions above (BFSG) stop applying by default | Not yet owned — next research task before ADR 0015 (compliance ops) |

## Notes

- This matrix reflects research as of **2026-07-06**; several deadlines (AI Act Art. 50, CRA
  reporting, Widerrufsbutton) fall within the next 2–12 months and should be re-verified closer to
  the date, since EU tech regulation has shown a pattern of last-minute delays (see the May 2026
  Digital Omnibus precedent for the AI Act).
- Fernabsatzrecht/Widerrufsbutton and the new business-registration row currently have **no owning
  ADR** — a known gap for ADR 0010/0015 to close, not an oversight to silently carry forward.
- "Applies to Grimora?" assessments assume the **current** project shape confirmed by the owner
  (2026-07-06): a **private individual**, no registered business entity, no employees, pre-revenue.
  Several exemptions (BFSG, NIS2 size threshold) are **status-dependent** — re-check this matrix once
  a legal entity/Gewerbe is registered (flagged as the next topic to investigate) or the project
  crosses a size/revenue milestone or ships a new distribution channel (mobile/desktop apps trigger
  CRA product scope).

## Related

- [`docs/legal/dsa5-content-boundary.md`](dsa5-content-boundary.md) — copyright boundary (separate
  concern: IP, not regulatory compliance).
- [`docs/vision.md`](../vision.md) — the compliance mandate this matrix operationalizes.
- ADR 0009 (auth/logging boundaries), ADR 0010 (security/privacy by design, planned), ADR 0015
  (compliance & data protection, planned), ADR 0016 (accessibility & i18n, planned).
