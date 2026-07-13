/**
 * DSA5 skill-check mechanic tests (ADR 0017 §1): the parameterised resolver behind every DSA5 talent
 * is pure and deterministic given the rolled pips + targets. Exercised through the registered
 * `CHECKS` (the plugin's SDK-facing surface), covering the success/failure/critical/botch branches
 * and malformed dice, and proving that Body Control reuses the same mechanic with a *different*
 * attribute triple (AGI/AGI/CON) than Perception (COU/AGI/INT).
 */

import { describe, expect, it } from 'bun:test';
import type { BehaviourContext, CheckDefinition } from '@grimora/plugin-sdk';
import { CHECKS } from './checks';

/** Find a registered check by id, failing loudly if the plugin stopped contributing it. */
function check(id: string): CheckDefinition {
  const found = CHECKS.find((c) => c.id === id);
  if (!found) throw new Error(`check '${id}' missing`);
  return found;
}

/** The opaque DSA5 outcome shape the resolver returns as `RollOutcome.value` (see `checks.ts`). */
interface Outcome {
  readonly success: boolean;
  readonly quality: number;
  readonly critical: boolean;
  readonly botch: boolean;
}

const ctx: BehaviourContext = { rng: { rollDie: () => 1, next: () => 0 }, log: () => {} };

describe('dsa5 skill-check resolver (via registered checks)', () => {
  const perception = () => check('perception');
  const bodyControl = () => check('body-control');
  const targets = { SGC: 14, INT: 13, AGI: 12, CON: 13, PERCEPTION: 6, BODY_CONTROL: 6 };

  it('succeeds with no shortfall (all dice under the attributes)', () => {
    const result = perception().resolve({ rolls: [[5, 5, 5]], targets }, ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const outcome = result.value.value as Outcome;
      expect(outcome.success).toBe(true);
      expect(outcome.quality).toBeGreaterThanOrEqual(1);
      expect(result.value.labelKey).toBe('dsa5.check.success');
    }
  });

  it('fails when the shortfall exceeds the skill points', () => {
    // Every die over its attribute (but no two 20s/1s, so this is the plain-failure branch), and
    // PERCEPTION=0 cannot offset the shortfall.
    const lean = { ...targets, PERCEPTION: 0 };
    const result = perception().resolve({ rolls: [[20, 19, 18]], targets: lean }, ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const outcome = result.value.value as Outcome;
      expect(outcome.success).toBe(false);
      expect(outcome.quality).toBe(0);
      expect(result.value.labelKey).toBe('dsa5.check.failure');
    }
  });

  it('flags a critical on two 1s', () => {
    const result = perception().resolve({ rolls: [[1, 1, 5]], targets }, ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const outcome = result.value.value as Outcome;
      expect(outcome.critical).toBe(true);
      expect(outcome.success).toBe(true);
    }
  });

  it('flags a botch on two 20s', () => {
    const result = perception().resolve({ rolls: [[20, 20, 5]], targets }, ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const outcome = result.value.value as Outcome;
      expect(outcome.botch).toBe(true);
      expect(outcome.success).toBe(false);
    }
  });

  it('rejects malformed dice with a Validation error', () => {
    const result = perception().resolve({ rolls: [[1, 2]], targets }, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.category).toBe('Validation');
  });

  it('resolves Body Control against AGI/AGI/CON, a different triple than Perception', () => {
    // Same dice + targets, but only the AGI/AGI/CON triple is high enough to pass: Body Control
    // succeeds while Perception (SGC/INT/INT, with SGC=INT=1) fails — proving the resolver reads the
    // per-check attribute triple rather than a hardcoded one.
    const rolls = [[10, 10, 10]] as const;
    const distinguishing = { SGC: 1, INT: 1, AGI: 18, CON: 18, PERCEPTION: 0, BODY_CONTROL: 0 };

    const bc = bodyControl().resolve({ rolls, targets: distinguishing }, ctx);
    expect(bc.ok).toBe(true);
    if (bc.ok) expect((bc.value.value as Outcome).success).toBe(true);

    const per = perception().resolve({ rolls, targets: distinguishing }, ctx);
    expect(per.ok).toBe(true);
    if (per.ok) expect((per.value.value as Outcome).success).toBe(false);
  });
});
