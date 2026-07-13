/**
 * DSA5 plugin **composition** tests: assert that `index.ts` assembles the rule system from every
 * per-concern module (attributes / derived values / skills / checks) into the expected whole, and that
 * a check resolves through the assembled system. The per-mechanic detail (attribute set, formula ASTs,
 * the skill-check branches) lives in the colocated per-module tests; this file guards the *assembly*.
 * Exercised through the SDK surface only (register → inspect / resolve), with no dependency on the core.
 */

import { describe, expect, it } from 'bun:test';
import type { BehaviourContext, PluginRegistry, RuleSystemDefinition } from '@grimora/plugin-sdk';
import dsa5 from './index';

/** Capture the registered DSA5 rule system by calling the plugin's `register`. */
function ruleSystem(): RuleSystemDefinition {
  let captured: RuleSystemDefinition | undefined;
  const registry: PluginRegistry = {
    registerRuleSystem: (definition) => {
      captured = definition;
    },
  };
  dsa5.register(registry);
  if (!captured) throw new Error('DSA5 registered no rule system');
  return captured;
}

const ctx: BehaviourContext = { rng: { rollDie: () => 1, next: () => 0 }, log: () => {} };

describe('dsa5 plugin composition', () => {
  it('assembles the dsa5 rule system from all modules (8 attributes, 2 skills, 3 derived, 2 checks)', () => {
    const rs = ruleSystem();
    expect(rs.id).toBe('dsa5');

    const countByKind = rs.traits.reduce<Record<string, number>>((acc, t) => {
      acc[t.kind] = (acc[t.kind] ?? 0) + 1;
      return acc;
    }, {});
    expect(countByKind).toEqual({ attribute: 8, skill: 2, derivedValue: 3 });

    expect(rs.checks.map((c) => c.id).sort()).toEqual(['body-control', 'perception']);
  });

  it('resolves a check through the assembled rule system (perception smoke)', () => {
    const perception = ruleSystem().checks.find((c) => c.id === 'perception');
    if (!perception) throw new Error('perception check missing');

    const result = perception.resolve(
      { rolls: [[5, 5, 5]], targets: { SGC: 14, INT: 13, PER: 6 } },
      ctx,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.labelKey).toBe('dsa5.check.success');
  });
});
