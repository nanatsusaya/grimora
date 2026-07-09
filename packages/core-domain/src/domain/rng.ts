/**
 * Deterministic seeded RNG for the rules-runtime (ADR 0021 §3). The seed is derived from the aggregate
 * stream id + a per-aggregate roll sequence number, so replaying the event stream reproduces identical
 * rolls. Uses only arithmetic globals (a `mulberry32` generator) — **never** `Math.random` or any Node
 * builtin — so it is pure and honours the determinism fitness function (ADR 0021 §3, ADR 0003 §6.1).
 *
 * **Deliberately NOT cryptographic.** `mulberry32` is a fast, tiny, well-known PRNG chosen for
 * *reproducibility*, not *unpredictability*: because the seed inputs are public, a participant can
 * precompute their next roll. That is an accepted trade-off for a cooperative hobby TTRPG (ADR 0024 R3),
 * not a defect — this must never be mistaken for a CSPRNG or used where unpredictability matters (a
 * server nonce / commit-reveal would be added then, ADR 0024 §3).
 */

import type { SeededRng } from '@grimora/plugin-sdk';
import type { EntityId } from '@grimora/shared-types';

/** FNV-1a 32-bit hash of a string — a small, dependency-free way to fold a stream id into a seed. */
function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // 32-bit FNV prime multiply via imul; keep unsigned with >>> 0 at the end.
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Derive the numeric RNG seed for a roll from its reproducibility inputs (ADR 0021 §3).
 * @param streamId  the aggregate stream the roll belongs to
 * @param sequence  the per-aggregate roll sequence number
 * @returns         an unsigned 32-bit seed
 */
export function deriveSeed(streamId: EntityId, sequence: number): number {
  return fnv1a32(`${streamId}#${sequence}`);
}

/**
 * Build a deterministic {@link SeededRng} from a numeric seed (a `mulberry32` PRNG).
 * @param seed  unsigned 32-bit seed (typically from {@link deriveSeed})
 * @returns     a seeded RNG whose sequence is fully determined by `seed`
 */
export function makeSeededRng(seed: number): SeededRng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    rollDie(sides: number): number {
      return 1 + Math.floor(next() * sides);
    },
  };
}
