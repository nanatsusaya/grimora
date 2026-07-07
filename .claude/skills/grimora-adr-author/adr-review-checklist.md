# ADR self-review checklist

Run this before opening the ADR PR (and when reviewing an ADR PR).

- [ ] It is a **decision**, not research — every section commits to something.
- [ ] **Consistent** with all Accepted ADRs it touches; no contradiction; overlaps *cite* rather than
      re-decide another ADR's turf.
- [ ] **Negative consequences / costs** are named honestly, not glossed over.
- [ ] Owner-domain choices are in **Open questions** (with a recommended default), not silently decided.
- [ ] Enforceable rules are flagged as **conformance fitness functions** where the `arch` harness could
      assert them (ADR 0003 §2 "Enforcement" / ADR 0010 §7).
- [ ] **Security / privacy / plugin-boundary / secrets / AI-data-flow** considered, or explicitly N/A.
- [ ] **Legal/compliance** impact checked against `docs/legal/eu-de-compliance-matrix.md` (if relevant),
      framed as a project checklist + "owner/legal review required" — never as legal advice.
- [ ] **Phase gate** stated: what this unblocks / whether it predates other ADRs; not implementing ahead
      of a still-Planned decision.
- [ ] `docs/adr/README.md` index updated (status + link); **`bun run arch` green**.
- [ ] `docs/STATUS.md` updated if the roadmap/order changes.
- [ ] Cross-references use `ADR 000X §Y`; all links resolve.
- [ ] **English**; house-style header (`Status` / `Date` / `Deciders` / `Depends on`) and section order
      (Context → Decision → Consequences → Alternatives → Open questions → References).
