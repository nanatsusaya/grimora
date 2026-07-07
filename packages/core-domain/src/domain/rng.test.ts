/**
 * Seeded-RNG determinism tests (ADR 0017 §1, ADR 0021 §3): the same seed must reproduce the same
 * sequence (the basis for reproducible rolls and replay), and dice stay within range.
 */

import { describe, expect, it } from 'bun:test';
import type { EntityId } from '@grimora/shared-types';
import { deriveSeed, makeSeededRng } from './rng';

describe('seeded RNG', () => {
  it('reproduces an identical sequence for the same seed', () => {
    const a = makeSeededRng(12345);
    const b = makeSeededRng(12345);
    const seqA = Array.from({ length: 10 }, () => a.rollDie(20));
    const seqB = Array.from({ length: 10 }, () => b.rollDie(20));
    expect(seqA).toEqual(seqB);
  });

  it('derives the same seed from the same (streamId, sequence)', () => {
    const stream = 'character-1' as EntityId;
    expect(deriveSeed(stream, 3)).toBe(deriveSeed(stream, 3));
    expect(deriveSeed(stream, 3)).not.toBe(deriveSeed(stream, 4));
  });

  it('rolls dice within [1, sides]', () => {
    const rng = makeSeededRng(999);
    for (let i = 0; i < 200; i++) {
      const roll = rng.rollDie(20);
      expect(roll).toBeGreaterThanOrEqual(1);
      expect(roll).toBeLessThanOrEqual(20);
    }
  });
});
