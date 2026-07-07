/**
 * Formula-builder tests (ADR 0017 §1): the `f` builder emits the expected `FormulaAst` data. The
 * interpreter that evaluates the AST is tested in `core-domain`; here we only check the sugar → tree.
 */

import { describe, expect, it } from 'bun:test';
import { f } from './formula';

describe('formula builder', () => {
  it('builds constants, trait refs and nested arithmetic', () => {
    expect(f.const(3)).toEqual({ kind: 'const', value: 3 });
    expect(f.trait('COU')).toEqual({ kind: 'traitRef', traitId: 'COU' });
    expect(f.add(f.const(1), f.trait('COU'))).toEqual({
      kind: 'add',
      left: { kind: 'const', value: 1 },
      right: { kind: 'traitRef', traitId: 'COU' },
    });
  });

  it('builds comparison and conditional nodes', () => {
    expect(f.if(f.cmp('gt', f.trait('x'), f.const(10)), f.const(1), f.const(0))).toEqual({
      kind: 'if',
      cond: {
        kind: 'cmp',
        op: 'gt',
        left: { kind: 'traitRef', traitId: 'x' },
        right: { kind: 'const', value: 10 },
      },
      whenTrue: { kind: 'const', value: 1 },
      whenFalse: { kind: 'const', value: 0 },
    });
  });
});
