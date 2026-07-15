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
 * which is precisely why they are content-boundary-safe to ship here and why they are the two derived
 * values we model now: they encode a generic arithmetic relationship, not a proprietary per-species
 * table. Values that carry a species-derived base (life energy proper, astral/karma energy, soul power,
 * toughness, speed) are intentionally **not** modelled here. Both formulas match the official DSA5
 * calculations verbatim (Dodge = Agility / 2, Initiative = (Courage + Agility) / 2) and use `f.round` —
 * DSA5 rounds derived values commercially (ties away from zero, e.g. 15 / 2 → 8), which is exactly the
 * tie rule `f.round` implements.
 *
 * **Known defect — LP contradicts the paragraph above and the SSOT (#223).** `LP` *is* a species-derived
 * value, so by this module's own stated rule it should not be modelled here at all; its shipped formula
 * (`5 + COU + AGI`) is a walking-skeleton placeholder, **not** a DSA5 rule (the rule is: species LE base
 * + 2×CON). It is left untouched in this change **by design**: this change only adds SSOT references
 * (ADR 0029 R2), and the correction lands in #223 together with LP's own reference — so we never ship a
 * source comment that contradicts the code it annotates.
 */
export const DERIVED_VALUES: readonly TraitDefinition[] = [
  {
    // WRONG — see the "Known defect" note above; corrected in #223. Deliberately carries no SSOT
    // reference yet, because no vault note supports this formula: it is not a DSA5 rule.
    kind: 'derivedValue',
    id: 'LP',
    labelKey: 'dsa5.derived.lifePoints',
    formula: f.add(f.add(f.const(5), f.trait('COU')), f.trait('AGI')),
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
