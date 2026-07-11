/**
 * Unit tests for the UUIDv7 id generator (#105-C). They pin the two properties the event store relies on:
 * a well-formed v7 layout (version/variant bits) and **time-ordering** — ids minted at increasing
 * timestamps sort in creation order. The random tail is deliberately not asserted (it is nondeterministic
 * by design); injecting the timestamp keeps the tests deterministic (ADR 0017).
 */

import { describe, expect, test } from 'bun:test';
import { createUuidV7IdGenerator, uuidV7 } from './id-generator';

/** RFC 9562 canonical form with the version nibble fixed to `7` and the variant nibble to one of 8/9/a/b. */
const UUID_V7_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('uuidV7', () => {
  test('produces a canonical v7 string (version + variant bits set)', () => {
    expect(uuidV7(0x0179_5c3e_4a00)).toMatch(UUID_V7_RE);
  });

  test('embeds the timestamp so ids are time-ordered', () => {
    const earlier = uuidV7(1_000_000_000_000);
    const later = uuidV7(2_000_000_000_000);
    // The 48-bit timestamp is the string's leading hex, so lexicographic order == creation order.
    expect(earlier < later).toBe(true);
  });

  test('embeds the exact timestamp bytes in the leading hex', () => {
    // 0x0192abcdef01 across the first 6 bytes → first 8 + next 4 hex chars, dash-separated.
    const id = uuidV7(0x0192_abcd_ef01);
    expect(id.slice(0, 13)).toBe('0192abcd-ef01');
  });

  test('is unique across calls at the same timestamp (random tail)', () => {
    const a = uuidV7(1234);
    const b = uuidV7(1234);
    expect(a).not.toBe(b);
  });
});

describe('createUuidV7IdGenerator', () => {
  test('newId returns distinct well-formed v7 ids', () => {
    const gen = createUuidV7IdGenerator();
    const first = gen.newId();
    const second = gen.newId();
    expect(first).toMatch(UUID_V7_RE);
    expect(second).toMatch(UUID_V7_RE);
    expect(first).not.toBe(second);
  });
});
