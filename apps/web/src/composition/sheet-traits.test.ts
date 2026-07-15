/**
 * Colocated tests for the sheet-trait resolution (#225).
 *
 * These are the regression guard for the bug this module exists to prevent: a sheet field naming a trait
 * the rule system does not define. The first test runs against the **real DSA5 plugin** — so it fails if
 * a future catalog rename orphans a sheet field again, exactly the way `PER` was orphaned by #211/#214.
 */

import { describe, expect, it } from 'bun:test';
import { createPluginHost } from '@grimora/core-domain';
import dsa5 from '@grimora/plugin-dsa5';
import { resolveSheetTraits, SHEET_TRAIT_IDS } from './sheet-traits';

/** A host with the real DSA5 rule system loaded — the same wiring the composition root performs. */
function dsa5Host() {
  const rules = createPluginHost();
  rules.load(dsa5);
  return rules;
}

describe('resolveSheetTraits', () => {
  it('resolves every sheet trait id against the real DSA5 rule system (the #225 guard)', () => {
    const resolved = resolveSheetTraits(dsa5Host(), 'dsa5');

    expect(resolved.map((t) => t.id)).toEqual([...SHEET_TRAIT_IDS]);
    // Bounds come from the plugin, never from the UI: attributes 8–20, the perception skill 0–25.
    expect(resolved).toEqual([
      { id: 'COU', min: 8, max: 20 },
      { id: 'AGI', min: 8, max: 20 },
      { id: 'INT', min: 8, max: 20 },
      { id: 'CON', min: 8, max: 20 },
      { id: 'PERCEPTION', min: 0, max: 25 },
    ]);
  });

  it('includes CON — the sole input of the LP derived value the sheet renders (#223)', () => {
    // Guards the *reason* CON is listed: a sheet that shows LP but cannot edit CON shows a number the
    // user has no way to influence. A future trim of the subset must not silently reintroduce that.
    expect(resolveSheetTraits(dsa5Host(), 'dsa5').some((t) => t.id === 'CON')).toBe(true);
  });

  it('throws for a trait the rule system does not define — the field cannot render at all', () => {
    // The `PER` bug in one assertion: an unrated/unknown id must fail loudly at boot, not render empty.
    const rules = dsa5Host();
    expect(() => {
      const bogus = { ...rules, getRatedTrait: () => undefined };
      resolveSheetTraits(bogus, 'dsa5');
    }).toThrow(/not a rated trait/);
  });

  it('throws when the rule system is not loaded — a misordered composition fails fast', () => {
    expect(() => resolveSheetTraits(createPluginHost(), 'dsa5')).toThrow(/is not loaded/);
  });
});
