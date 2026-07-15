# @grimora/plugin-dsa5 — the DSA5 rule-system plugin

The first rule-system plugin. Organised by concern under `src/`: `attributes.ts` (the 8 DSA5 attributes),
`derived.ts` (formula-derived values — life points, dodge, initiative), `skills.ts` + `checks.ts` (the
generalised 3d20 roll-under skill-check mechanic — roll under three attributes, skill points offset
shortfalls), and `talents/` — a **data-driven catalog** of the full **59-talent** DSA5 roster (one
`Talent` per skill: name as an i18n key + attribute triple + category + improvement factor + encumbrance
+ application slugs) from which the skill traits and checks are derived. Content sourced from the official
English *The Dark Eye* Regel-Wiki (<https://tde.ulisses-regelwiki.de/>) as the mechanical roster only.
Started as the walking-skeleton slice (issue #61, ADR 0022 R2); grown in Phase 3 (#210/#211/#214) within
the frozen plugin-SDK v0 (ADR 0025).

## Rule fidelity — the DSA5 vault is the SSOT (ADR 0029)

Because the boundary below forbids verbatim rule text, every mechanic here is a **self-implemented**
distillation — which means its fidelity **cannot be checked by comparing text**. It has to be checked
against an authority. That authority is the owner's **DSA5 vault** (`github.com/nanatsusaya/dsa5`,
private): a structured, versioned, bilingual capture of the rules, one note per rule element.

This is not a theoretical safeguard. It exists because `LP = 5 + COU + AGI` shipped here and is **not a
DSA5 rule at all** — it passed review because nothing existed to check it against (correction: #223).

Every implemented rule therefore carries a **two-layer source reference**:

| Layer | What | Why |
| --- | --- | --- |
| **Public** | the official Regel-Wiki id/URL | normative citation, resolvable by anyone, already permitted by the boundary ("link, don't reproduce") |
| **Private** | the vault note path (`01 Regeln/…`) | the owner's fidelity anchor; owner-only-resolvable **by design** (the vault is private) |

Both share one stable key — the same `regelwiki:` id the vault notes are keyed by. Both are **pointers**:
no rule text ever crosses vault → plugin, and the vault is **never** imported or vendored (it is a
reference layer, not a build/runtime/content dependency).

Where the reference lives:

- **Talents** — structured fields (`regelwiki`, `vaultNote`) on each `Talent`, so a future arch fitness
  function can assert presence (ADR 0029 R3 defers that assertion until the set is complete).
- **Attributes / derived values / the check mechanic** — module + entry doc comments, because these
  derive **frozen** SDK types (ADR 0025) that cannot carry a DSA-specific provenance field.

**When you add or correct a mechanic here:** verify it against its vault note *before* merging, and land
its reference in the same change. Last full cross-check: **2026-07-15** — all 59 talent triples and
improvement costs matched (0 mismatches); `DODGE` and `INI` confirmed correct; `LP` found wrong (#223).

## Legal boundary (`docs/legal/dsa5-content-boundary.md` — binding, revised 2026-07-13)

**Self-implemented rule mechanics/structure only.** Abstract game mechanics aren't copyrightable, so the
formulas/logic are re-implemented as our own code; trait ids stay abstract (`COU`, `AGI`, `INT`,
`PERCEPTION`, `LP`) and display names are **i18n keys** (`dsa5.attr.courage`, …), never embedded rulebook prose; the
3d20 roll-under mechanic is the system's rule, not protected expression. **Excluded:** verbatim
rule/flavour text, tables, artwork, official logos/look-and-feel, data-rich compilations —
descriptions/values/effects (full spell/item *content* → user import/content packs, ADR 0006 §8; the bare
mechanical **roster** — names + attribute triples + category + improvement factor — *does* ship), and
DSA-derived content under our OSS/CC license. Grimora is a **free, non-commercial fan project**; the official **DSA Regel-Wiki**
(<https://dsa.ulisses-regelwiki.de/>) is a *reference to link to*, not a data source. A comprehensive
database/generator, any commercial turn, or shipping DSA data in the repo need **written Ulisses
permission first** (see the boundary doc's *Written permission required* gates).

## Dependency position

Imports `@grimora/plugin-sdk` + `@grimora/shared-types` **only** (`plugins-only-sdk`, ADR 0006 §1) —
never core internals. First-party, so it runs in-process (ADR 0006 §5; no sandbox — ADR 0010 R1).
