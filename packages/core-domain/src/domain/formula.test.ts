/**
 * Formula-interpreter tests (ADR 0017 §1): unit examples for each node kind + a property-based check
 * (fast-check) that evaluation is deterministic and that arithmetic is correct — the interpreter is the
 * pure heart of the rules-runtime (ADR 0021 §1).
 */

import { describe, expect, it } from 'bun:test';
import { f } from '@grimora/plugin-sdk';
import fc from 'fast-check';
import { evaluateFormula } from './formula';

describe('evaluateFormula', () => {
  it('evaluates constants, trait refs and arithmetic', () => {
    const ast = f.add(f.const(5), f.mul(f.trait('COU'), f.const(2)));
    const result = evaluateFormula(ast, { traits: { COU: 7 } });
    expect(result).toEqual({ ok: true, value: 19 });
  });

  it('reports unknown traits as a Validation error', () => {
    const result = evaluateFormula(f.trait('MISSING'), { traits: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.category).toBe('Validation');
  });

  it('rejects division by zero', () => {
    const result = evaluateFormula(f.div(f.const(1), f.const(0)), { traits: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('rules.division_by_zero');
  });

  it('floors toward -inf and ceils toward +inf', () => {
    expect(evaluateFormula(f.floor(f.const(2.9)), { traits: {} })).toEqual({ ok: true, value: 2 });
    expect(evaluateFormula(f.floor(f.const(-2.1)), { traits: {} })).toEqual({
      ok: true,
      value: -3,
    });
    expect(evaluateFormula(f.ceil(f.const(2.1)), { traits: {} })).toEqual({ ok: true, value: 3 });
    expect(evaluateFormula(f.ceil(f.const(-2.9)), { traits: {} })).toEqual({ ok: true, value: -2 });
  });

  it('rounds half away from zero (round(2.5)=3, round(-2.5)=-3)', () => {
    expect(evaluateFormula(f.round(f.const(2.5)), { traits: {} })).toEqual({ ok: true, value: 3 });
    expect(evaluateFormula(f.round(f.const(-2.5)), { traits: {} })).toEqual({
      ok: true,
      value: -3,
    });
    expect(evaluateFormula(f.round(f.const(2.4)), { traits: {} })).toEqual({ ok: true, value: 2 });
    expect(evaluateFormula(f.round(f.const(-2.4)), { traits: {} })).toEqual({
      ok: true,
      value: -2,
    });
  });

  it('computes floored modulo (sign of the divisor) and integer division consistently', () => {
    expect(evaluateFormula(f.mod(f.const(7), f.const(3)), { traits: {} })).toEqual({
      ok: true,
      value: 1,
    });
    // Floored: -7 - 3*floor(-7/3) = -7 - 3*(-3) = 2 — same sign as the divisor.
    expect(evaluateFormula(f.mod(f.const(-7), f.const(3)), { traits: {} })).toEqual({
      ok: true,
      value: 2,
    });
    // Integer division = floor(div(a,b)) (ADR 0021 §1): floor(7/2) = 3.
    expect(evaluateFormula(f.floor(f.div(f.const(7), f.const(2))), { traits: {} })).toEqual({
      ok: true,
      value: 3,
    });
  });

  it('expresses the D&D-5e ability modifier floor((score-10)/2)', () => {
    const modifier = f.floor(f.div(f.sub(f.trait('score'), f.const(10)), f.const(2)));
    expect(evaluateFormula(modifier, { traits: { score: 15 } })).toEqual({ ok: true, value: 2 });
    expect(evaluateFormula(modifier, { traits: { score: 8 } })).toEqual({ ok: true, value: -1 });
  });

  it('rejects modulo by zero (never NaN)', () => {
    const result = evaluateFormula(f.mod(f.const(5), f.const(0)), { traits: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('rules.modulo_by_zero');
  });

  it('rejects a non-finite constant (NaN / ±Infinity) at the leaf (#152)', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const result = evaluateFormula(f.const(bad), { traits: {} });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('rules.non_finite_result');
    }
  });

  it('rejects a non-finite trait input rather than propagating it (#152)', () => {
    const result = evaluateFormula(f.trait('x'), { traits: { x: Number.NaN } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('rules.non_finite_result');
  });

  it('rejects arithmetic that overflows to Infinity (#152)', () => {
    // Two finite leaves whose product exceeds the float range → Infinity, which must not be stored.
    const result = evaluateFormula(f.mul(f.const(1e308), f.const(1e308)), { traits: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('rules.non_finite_result');
    // Division overflow (finite / tiny) is caught too, distinct from division-by-zero.
    const div = evaluateFormula(f.div(f.const(1e300), f.const(1e-300)), { traits: {} });
    expect(div.ok).toBe(false);
    if (!div.ok) expect(div.error.code).toBe('rules.non_finite_result');
  });

  it('evaluates cmp to 1/0 and if to the chosen branch', () => {
    const ast = f.if(f.cmp('gt', f.trait('COU'), f.const(10)), f.const(1), f.const(0));
    expect(evaluateFormula(ast, { traits: { COU: 12 } })).toEqual({ ok: true, value: 1 });
    expect(evaluateFormula(ast, { traits: { COU: 8 } })).toEqual({ ok: true, value: 0 });
  });

  it('resolves table lookups', () => {
    const ast = f.tableLookup('enc', f.trait('STR'));
    const ctx = { traits: { STR: 12 }, tables: { enc: { '12': 3 } } };
    expect(evaluateFormula(ast, ctx)).toEqual({ ok: true, value: 3 });
  });

  it('is deterministic and arithmetically correct (property-based)', () => {
    fc.assert(
      fc.property(fc.integer({ min: -50, max: 50 }), fc.integer({ min: -50, max: 50 }), (a, b) => {
        const ast = f.add(f.mul(f.const(a), f.const(2)), f.trait('x'));
        const ctx = { traits: { x: b } };
        const first = evaluateFormula(ast, ctx);
        const second = evaluateFormula(ast, ctx);
        // Determinism: same AST + same context → identical result.
        expect(first).toEqual(second);
        expect(first).toEqual({ ok: true, value: a * 2 + b });
      }),
    );
  });
});
