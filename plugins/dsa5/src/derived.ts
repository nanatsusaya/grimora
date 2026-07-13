/**
 * DSA5 derived values (`kind: derivedValue`) — traits computed from attributes by a formula AST,
 * re-evaluated deterministically by the core interpreter (ADR 0020/0021).
 *
 * Own module so the derived-value set (skeleton: life points only → the full DSA5 family, issue #211)
 * can grow independently of the attribute, skill and check modules.
 */
import { f, type TraitDefinition } from '@grimora/plugin-sdk';

/**
 * Derived values contributed by the plugin. Life points = 5 + COU + AGI — a self-implemented mechanic
 * (abstract ids, no rulebook text; see the legal boundary), re-evaluated by the core interpreter.
 */
export const DERIVED_VALUES: readonly TraitDefinition[] = [
  {
    kind: 'derivedValue',
    id: 'LP',
    labelKey: 'dsa5.derived.lifePoints',
    formula: f.add(f.add(f.const(5), f.trait('COU')), f.trait('AGI')),
  },
];
