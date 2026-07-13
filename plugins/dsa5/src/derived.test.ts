/**
 * Colocated tests for the DSA5 derived-value set (ADR 0017 §1).
 *
 * These guard the *formulas the plugin declares* — the plugin's actual responsibility under the
 * core/plugin split (ADR 0020/0021): a plugin contributes formula **data** (an AST), and the **host**
 * (`@grimora/core-domain`'s `evaluateFormula`) is what walks that AST to a number. The interpreter is
 * therefore tested where it lives, in `core-domain`; here we assert the exact AST each derived value
 * maps to, so a regression that swaps `round`→`floor`, `div`→`sub`, or a wrong trait id fails loudly.
 * Asserting the AST as a literal (rather than rebuilding it with the `f` builder) makes the test an
 * independent specification of the intended tree — the same approach `rules-contract/formula.test.ts`
 * takes for the builder itself.
 *
 * The intended **evaluated** results (locked in as the spec, verified against the owner's DSA5 vault;
 * `f.round` rounds ties away from zero, matching DSA5's commercial rounding of derived values):
 *   - DODGE = round(AGI / 2):            AGI 12 → 6;  AGI 13 → round(6.5) = 7;  AGI 15 → round(7.5) = 8
 *   - INI   = round((COU + AGI) / 2):    COU 13 + AGI 12 → round(12.5) = 13;  COU 15 + AGI 12 → round(13.5) = 14
 * An interpreter-backed evaluation of these belongs in a `core-domain` test (that package owns the
 * interpreter); a plugin cannot import it without breaking the ADR 0003 dependency rule.
 */

import { describe, expect, it } from 'bun:test';
import type { FormulaAst } from '@grimora/plugin-sdk';
import { DERIVED_VALUES } from './derived';

/**
 * Look up a derived value by its abstract id, failing loudly if absent — so a test asserting on a
 * specific derived value can never silently pass against a missing entry.
 * @param id  the abstract derived-value id (e.g. "DODGE")
 * @returns   the matching definition
 */
function derived(id: string) {
  const entry = DERIVED_VALUES.find((d) => d.id === id);
  if (!entry) throw new Error(`derived value ${id} missing`);
  return entry;
}

/**
 * The `round(div(<numerator>, 2))` shape shared by all three new derived values — factored out so each
 * expectation states only its distinctive numerator AST.
 * @param numerator  the AST fed into the halving division
 * @returns          the full expected formula AST
 */
function halfRounded(numerator: FormulaAst): FormulaAst {
  return {
    kind: 'round',
    operand: { kind: 'div', left: numerator, right: { kind: 'const', value: 2 } },
  };
}

/** A `traitRef` leaf, spelled out to keep the expected-AST literals readable. */
function traitRef(traitId: string): FormulaAst {
  return { kind: 'traitRef', traitId };
}

describe('DSA5 DERIVED_VALUES', () => {
  it('registers exactly LP plus the two pure-attribute derived values, all kind derivedValue', () => {
    expect(DERIVED_VALUES.map((d) => d.id)).toEqual(['LP', 'DODGE', 'INI']);
    for (const d of DERIVED_VALUES) expect(d.kind).toBe('derivedValue');
  });

  it('keeps the existing LP entry unchanged (5 + COU + AGI) — the web app depends on it', () => {
    const lp = derived('LP');
    expect(lp.labelKey).toBe('dsa5.derived.lifePoints');
    expect(lp.kind === 'derivedValue' && lp.formula).toEqual({
      kind: 'add',
      left: { kind: 'add', left: { kind: 'const', value: 5 }, right: traitRef('COU') },
      right: traitRef('AGI'),
    });
  });

  it('DODGE = round(AGI / 2) — AGI 12→6, AGI 13→7, AGI 15→8 under commercial rounding', () => {
    const dodge = derived('DODGE');
    expect(dodge.labelKey).toBe('dsa5.derived.dodge');
    expect(dodge.kind === 'derivedValue' && dodge.formula).toEqual(halfRounded(traitRef('AGI')));
  });

  it('INI = round((COU + AGI) / 2) — COU 13 + AGI 12 → round(12.5) = 13', () => {
    const ini = derived('INI');
    expect(ini.labelKey).toBe('dsa5.derived.initiative');
    expect(ini.kind === 'derivedValue' && ini.formula).toEqual(
      halfRounded({ kind: 'add', left: traitRef('COU'), right: traitRef('AGI') }),
    );
  });
});
