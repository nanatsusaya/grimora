# @grimora/plugin-dsa5 — **minimal skeleton slice**

The first rule-system plugin, reduced to exactly what the walking skeleton (issue #61) needs: a slice
that spans **different trait kinds** (attributes, a formula-derived value, a skill) plus one skill
**check** with the DSA5 dice mechanic (three d20, roll-under, skill points offset shortfalls) — ADR 0022
R2. Broader DSA5 content is Phase-3 work, gated by the frozen plugin-SDK v0 (ADR 0025).

## Legal boundary (`docs/legal/dsa5-content-boundary.md` — binding, revised 2026-07-13)

Rule **mechanics/structure + functional rule values** sourced from the official **DSA Regel-Wiki**
(<https://dsa.ulisses-regelwiki.de/>) are permitted: Grimora is a "Hilfsprogramm/Charaktergenerator",
which the Scriptorium content guidelines explicitly exclude from the "digital games" prohibition, and
the Regel-Wiki is Ulisses's sanctioned rules source. Trait ids stay abstract (`COU`, `AGI`, `INT`,
`PER`, `LP`); display names are **i18n keys** (`dsa5.attr.courage`, …), never embedded prose; the 3d20
roll-under mechanic is the system's rule, not copyrightable expression. **Excluded:** verbatim
descriptive/flavour prose, artwork, and non-Regel-Wiki sources (DSA4.1, book PDFs); **Scriptorium
attribution** is required. Bulk third-party data comes via user content packs / import (ADR 0006 §8).

## Dependency position

Imports `@grimora/plugin-sdk` + `@grimora/shared-types` **only** (`plugins-only-sdk`, ADR 0006 §1) —
never core internals. First-party, so it runs in-process (ADR 0006 §5; no sandbox — ADR 0010 R1).
