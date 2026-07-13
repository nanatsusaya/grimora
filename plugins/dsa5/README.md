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
