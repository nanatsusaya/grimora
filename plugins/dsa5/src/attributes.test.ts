/**
 * Colocated tests for the DSA5 attribute set.
 *
 * Guards the invariant that the plugin exposes the full eight DSA5 attributes with their stable
 * official-abbreviation ids and the neutral generic bounds — so a later edit that reorders, drops or
 * mis-bounds an attribute (or accidentally leaks a proprietary value in place of the generic 8/20)
 * fails loudly rather than silently changing every derived value and skill check downstream.
 */
import { describe, expect, it } from 'bun:test';
import { ATTRIBUTES } from './attributes';

/**
 * Expected attribute ids in canonical DSA5 order (mental group then physical group). Duplicated here
 * on purpose: the test is the independent specification the source module is checked against.
 */
const EXPECTED_IDS = ['COU', 'SGC', 'INT', 'CHA', 'DEX', 'AGI', 'CON', 'STR'] as const;

describe('DSA5 ATTRIBUTES', () => {
  it('registers all eight DSA5 attributes', () => {
    expect(ATTRIBUTES).toHaveLength(8);
  });

  it('exposes the expected ids in canonical DSA5 order', () => {
    expect(ATTRIBUTES.map((attr) => attr.id)).toEqual([...EXPECTED_IDS]);
  });

  it("marks every entry as kind 'attribute'", () => {
    for (const attr of ATTRIBUTES) {
      expect(attr.kind).toBe('attribute');
    }
  });

  it('applies the neutral generic bounds (min 8 / max 20 / default 8) to every attribute', () => {
    for (const attr of ATTRIBUTES) {
      expect(attr.min).toBe(8);
      expect(attr.max).toBe(20);
      expect(attr.defaultValue).toBe(8);
    }
  });
});
