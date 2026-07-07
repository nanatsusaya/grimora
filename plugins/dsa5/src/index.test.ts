/**
 * DSA5 plugin-behaviour tests (ADR 0017 §1): the check's resolution *mechanic* is pure and
 * deterministic given the rolled pips + targets. Exercises the plugin through its SDK surface only
 * (register → find the check → call `resolve`), with no dependency on the core.
 */

import { describe, expect, it } from 'bun:test';
import type {
  BehaviourContext,
  CheckDefinition,
  PluginRegistry,
  RuleSystemDefinition,
} from '@grimora/plugin-sdk';
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

function perceptionCheck(): CheckDefinition {
  const check = ruleSystem().checks.find((c) => c.id === 'perception');
  if (!check) throw new Error('perception check missing');
  return check;
}

const ctx: BehaviourContext = { rng: { rollDie: () => 1, next: () => 0 }, log: () => {} };
const targets = { COU: 14, AGI: 12, INT: 13, PER: 6 };

describe('dsa5 perception check', () => {
  it('registers attributes, a skill, a derived value and the check', () => {
    const rs = ruleSystem();
    expect(rs.traits.map((t) => t.kind).sort()).toEqual([
      'attribute',
      'attribute',
      'attribute',
      'derivedValue',
      'skill',
    ]);
    expect(rs.checks).toHaveLength(1);
  });

  it('succeeds when dice roll under the attributes (no shortfall)', () => {
    const result = perceptionCheck().resolve({ rolls: [[5, 5, 5]], targets }, ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.value.value as { success: boolean }).success).toBe(true);
      expect(result.value.labelKey).toBe('dsa5.check.success');
    }
  });

  it('botches on two 20s', () => {
    const result = perceptionCheck().resolve({ rolls: [[20, 20, 5]], targets }, ctx);
    expect(result.ok).toBe(true);
    if (result.ok) expect((result.value.value as { botch: boolean }).botch).toBe(true);
  });

  it('rejects malformed dice (Validation)', () => {
    const result = perceptionCheck().resolve({ rolls: [[1, 2]], targets }, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.category).toBe('Validation');
  });
});
