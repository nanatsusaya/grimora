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
