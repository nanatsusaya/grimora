/**
 * DSA5 derived values (`kind: derivedValue`) — traits computed from attributes by a formula AST,
 * re-evaluated deterministically by the core interpreter (ADR 0020/0021).
 *
 * Own module so the derived-value set (skeleton: life points only → the full DSA5 family, issue #211)
 * can grow independently of the attribute, skill and check modules.
 *
 * **Fidelity SSOT (ADR 0029)** — the derived-value formulas are verified against:
 * - Regel-Wiki (public, normative): <https://dsa.ulisses-regelwiki.de/grundregeln/abgeleitete-werte.html>
 * - DSA5 vault (private anchor): `01 Regeln/Grundregeln/Abgeleitete Werte.md` (§ *Berechnung der
 *   Basiswerte* / *Calculating the Values*)
 *
 * The reference lives in doc comments rather than on the entries because these are SDK
 * `TraitDefinition`s and the frozen SDK surface (ADR 0025) cannot carry a DSA-specific provenance
 * field. Pointers only — no rule text is reproduced.
 */
import { f, type TraitDefinition } from '@grimora/plugin-sdk';

/**
 * Derived values contributed by the plugin. Each is a self-implemented mechanic (abstract trait ids,
 * i18n-key labels, no rulebook text or proprietary values — see the legal boundary), re-evaluated by
 * the core formula interpreter (ADR 0021) whenever an input attribute changes.
 *
 * DODGE and INI depend on **attributes only** (no species base value, no advantage/disadvantage modifier),
 * which is precisely why they are content-boundary-safe to ship here: they encode a generic arithmetic
 * relationship, not a proprietary per-species table. Both formulas match the official DSA5 calculations
 * verbatim (Dodge = Agility / 2, Initiative = (Courage + Agility) / 2) and use `f.round` — DSA5 rounds
 * derived values commercially (ties away from zero, e.g. 15 / 2 → 8), which is exactly the tie rule
 * `f.round` implements.
 *
 * **LP is the one species-derived value modelled here, and only partially — read before extending.** The
 * rule is *species LE base + 2×CON*, so LP cannot be fully expressed while the plugin models no species
 * concept. It is kept (rather than dropped) because the character sheet needs a life-points value, with
 * the **human** LE base hardcoded as a documented interim (#223). The remaining species-derived values
 * (astral/karma energy, soul power, toughness, speed) are **not** modelled at all — they would each need
 * the same species data, and their per-species base table raises a content-boundary question that is the
 * owner's to answer, not code's.
 */
export const DERIVED_VALUES: readonly TraitDefinition[] = [
  {
    /*
     * Life Points (Lebensenergie/LE): species LE base + 2×CON.
     * SSOT (ADR 0029) — verified 2026-07-15:
     *   Regel-Wiki: https://dsa.ulisses-regelwiki.de/grundregeln/abgeleitete-werte.html
     *   vault:      01 Regeln/Grundregeln/Abgeleitete Werte.md — "Lebensenergie: Lebensenergie-Grundwert
     *               der Spezies + 2 x Konstitution +/- Punkte aus Vor- und Nachteilen"
     *
     * INTERIM (#223): the `5` is the **human** LE base, hardcoded because no species concept exists yet
     * (vault `01 Regeln/Heldenerschaffung/Die Fünfzehn Schritte bis zum eigenen Held.md`, "Spezies in der
     * Übersicht": Mensch 5, Halbelf 5, Elf 2, Zwerg 8). It is therefore correct **only for humans** —
     * every character the app can currently create. Modelling species replaces this constant with real
     * data; until then, do not read this entry as fully general.
     *
     * This formula previously read `5 + COU + AGI`, which is not a DSA5 rule at all — a walking-skeleton
     * placeholder that survived because nothing existed to check it against. That is the defect ADR 0029
     * was written to make impossible; the `2×CON` term and this reference are its correction.
     */
    kind: 'derivedValue',
    id: 'LP',
    labelKey: 'dsa5.derived.lifePoints',
    formula: f.add(f.const(5), f.mul(f.const(2), f.trait('CON'))),
  },
  {
    /*
     * Dodge (Ausweichen/AW): round(AGI / 2). Pure agility-derived defence value; no species base.
     * SSOT (ADR 0029) — verified 2026-07-15, exact match:
     *   Regel-Wiki: https://dsa.ulisses-regelwiki.de/grundregeln/abgeleitete-werte.html
     *   vault:      01 Regeln/Grundregeln/Abgeleitete Werte.md — "Ausweichen: Gewandtheit / 2"
     */
    kind: 'derivedValue',
    id: 'DODGE',
    labelKey: 'dsa5.derived.dodge',
    formula: f.round(f.div(f.trait('AGI'), f.const(2))),
  },
  {
    /*
     * Initiative (INI): round((COU + AGI) / 2). Turn-order value from the courage+agility average.
     * SSOT (ADR 0029) — verified 2026-07-15, exact match:
     *   Regel-Wiki: https://dsa.ulisses-regelwiki.de/grundregeln/abgeleitete-werte.html
     *   vault:      01 Regeln/Grundregeln/Abgeleitete Werte.md — "Initiative: (Mut + Gewandtheit) / 2"
     * The rule's "+/− Punkte aus Vor- und Nachteilen" term is out of scope until advantages exist.
     */
    kind: 'derivedValue',
    id: 'INI',
    labelKey: 'dsa5.derived.initiative',
    formula: f.round(f.div(f.add(f.trait('COU'), f.trait('AGI')), f.const(2))),
  },
];
