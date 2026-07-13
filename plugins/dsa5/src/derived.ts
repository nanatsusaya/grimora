/**
 * DSA5 derived values (`kind: derivedValue`) — traits computed from attributes by a formula AST,
 * re-evaluated deterministically by the core interpreter (ADR 0020/0021).
 *
 * Own module so the derived-value set (skeleton: life points only → the full DSA5 family, issue #211)
 * can grow independently of the attribute, skill and check modules.
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
 */
export const DERIVED_VALUES: readonly TraitDefinition[] = [
  {
    kind: 'derivedValue',
    id: 'LP',
    labelKey: 'dsa5.derived.lifePoints',
    formula: f.add(f.add(f.const(5), f.trait('COU')), f.trait('AGI')),
  },
  {
    // Dodge (Ausweichen/AW): round(AGI / 2). Pure agility-derived defence value; no species base.
    kind: 'derivedValue',
    id: 'DODGE',
    labelKey: 'dsa5.derived.dodge',
    formula: f.round(f.div(f.trait('AGI'), f.const(2))),
  },
  {
    // Initiative (INI): round((COU + AGI) / 2). Turn-order value from the courage+agility average.
    kind: 'derivedValue',
    id: 'INI',
    labelKey: 'dsa5.derived.initiative',
    formula: f.round(f.div(f.add(f.trait('COU'), f.trait('AGI')), f.const(2))),
  },
];
