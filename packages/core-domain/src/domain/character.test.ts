/**
 * Domain tests for the `character` aggregate's `setAttribute` guard (issue #152). Focus: a non-finite
 * value (`NaN`, `±Infinity`) must be rejected as a `Validation` error and never reach an event, because
 * `NaN < min` and `NaN > max` are both false in JS — so an ordinary bounds test would silently accept it,
 * after which it would poison formulas, projections and JSON. Pure Domain test (ADR 0017 — no I/O).
 */

import { describe, expect, test } from 'bun:test';
import type { EntityId } from '@grimora/shared-types';
import { applyCharacter, createCharacter, emptyCharacter, setAttribute } from './character';

const id = 'character-1' as EntityId;
const bounds = { min: 8, max: 20 } as const;

/**
 * An existing (folded) character state to set attributes on — the `setAttribute` precondition is
 * `state.exists`, reached by folding a `character.created` event.
 * @returns a character state with `exists: true`
 */
function existingCharacter() {
  const created = createCharacter(emptyCharacter(id), {
    name: 'Alrik',
    campaignId: 'campaign-1' as EntityId,
    ownerId: 'user-1' as EntityId,
    ruleSystemId: 'dsa5',
    pluginId: 'org.example.test',
    pluginVersion: '0.0.0',
  });
  if (!created.ok) throw new Error(`setup failed: ${created.error.code}`);
  return applyCharacter(emptyCharacter(id), { ...created.value[0], version: 1 });
}

describe('setAttribute non-finite guard (#152)', () => {
  for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    test(`rejects ${value} as a Validation error (not accepted as in-range)`, () => {
      const result = setAttribute(existingCharacter(), 'COU', value, bounds);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.category).toBe('Validation');
        expect(result.error.code).toBe('character.attribute_not_finite');
      }
    });
  }

  test('still accepts a finite in-range value', () => {
    const result = setAttribute(existingCharacter(), 'COU', 14, bounds);
    expect(result.ok).toBe(true);
  });

  test('still rejects a finite out-of-range value as out_of_range (unchanged)', () => {
    const result = setAttribute(existingCharacter(), 'COU', 99, bounds);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('character.attribute_out_of_range');
  });
});
