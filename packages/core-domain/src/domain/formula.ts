/**
 * The core formula-AST **interpreter** (ADR 0021 §1/§5): a single pure walker over the closed
 * `FormulaAst` node set the plugin SDK defines. No `eval`/`vm`, no I/O — evaluation is a pure function
 * of (trait values, constants, dice results already rolled, tables), so derived values replay
 * identically (ADR 0021 §3). This is **core** code operating on plugin-supplied **data**.
 */

import type { FormulaAst } from '@grimora/plugin-sdk';
import { err, ok, type Result } from '@grimora/shared-types';
import { type AppError, appError } from './errors';

/** The inputs a formula evaluates against (ADR 0021 §3 "trait values, constants, dice already rolled"). */
export interface FormulaContext {
  /** Current trait values by id (for `traitRef` nodes). */
  readonly traits: Readonly<Record<string, number>>;
  /** Already-rolled dice values keyed by a `dice` node's `ref` (the skeleton's derived values omit these). */
  readonly dice?: Readonly<Record<string, number>>;
  /** Keyed lookup tables a plugin supplies (for `tableLookup` nodes). */
  readonly tables?: Readonly<Record<string, Readonly<Record<string, number>>>>;
}

/** Evaluate two sub-expressions, then combine — short-circuiting on the first error. */
function binary(
  left: FormulaAst,
  right: FormulaAst,
  ctx: FormulaContext,
  combine: (a: number, b: number) => Result<number, AppError>,
): Result<number, AppError> {
  const l = evaluateFormula(left, ctx);
  if (!l.ok) return l;
  const r = evaluateFormula(right, ctx);
  if (!r.ok) return r;
  return combine(l.value, r.value);
}

/** Evaluate one sub-expression, then transform it — short-circuiting on error (for the rounding ops). */
function unary(
  operand: FormulaAst,
  ctx: FormulaContext,
  transform: (x: number) => number,
): Result<number, AppError> {
  const v = evaluateFormula(operand, ctx);
  if (!v.ok) return v;
  return ok(transform(v.value));
}

/**
 * Evaluate a formula AST to a number. Pure and total: every failure (unknown trait, division by zero,
 * missing dice/table entry) is returned as an {@link AppError}, never thrown.
 *
 * @param ast  the plugin-defined expression tree
 * @param ctx  the trait/dice/table inputs to resolve leaves against
 * @returns    the numeric result, or a `Validation` error describing the first problem encountered
 */
export function evaluateFormula(ast: FormulaAst, ctx: FormulaContext): Result<number, AppError> {
  switch (ast.kind) {
    case 'const':
      return ok(ast.value);
    case 'traitRef': {
      const value = ctx.traits[ast.traitId];
      return value === undefined ? err(appError('rules.unknown_trait', 'Validation')) : ok(value);
    }
    case 'dice': {
      const value = ctx.dice?.[ast.ref];
      return value === undefined
        ? err(appError('rules.missing_dice_result', 'Validation'))
        : ok(value);
    }
    case 'add':
      return binary(ast.left, ast.right, ctx, (a, b) => ok(a + b));
    case 'sub':
      return binary(ast.left, ast.right, ctx, (a, b) => ok(a - b));
    case 'mul':
      return binary(ast.left, ast.right, ctx, (a, b) => ok(a * b));
    case 'div':
      return binary(ast.left, ast.right, ctx, (a, b) =>
        b === 0 ? err(appError('rules.division_by_zero', 'Validation')) : ok(a / b),
      );
    case 'mod':
      // Floored modulo (`a − b·floor(a/b)`), consistent with integer division = `floor(div(a,b))`
      // (ADR 0021 §1 amendment); result takes the divisor's sign. Modulo by zero is an error, not NaN.
      return binary(ast.left, ast.right, ctx, (a, b) =>
        b === 0
          ? err(appError('rules.modulo_by_zero', 'Validation'))
          : ok(a - b * Math.floor(a / b)),
      );
    case 'floor':
      return unary(ast.operand, ctx, (x) => Math.floor(x));
    case 'ceil':
      return unary(ast.operand, ctx, (x) => Math.ceil(x));
    case 'round':
      // Ties away from zero (ADR 0021 amendment): Math.round is ties-toward-+∞, so round |x| and
      // reattach the sign — round(2.5)=3, round(-2.5)=-3. `Math.sign(0)` is 0, so round(0)=0.
      return unary(ast.operand, ctx, (x) => Math.sign(x) * Math.round(Math.abs(x)));
    case 'min':
      return binary(ast.left, ast.right, ctx, (a, b) => ok(Math.min(a, b)));
    case 'max':
      return binary(ast.left, ast.right, ctx, (a, b) => ok(Math.max(a, b)));
    case 'cmp':
      return binary(ast.left, ast.right, ctx, (a, b) => {
        const truth =
          ast.op === 'eq'
            ? a === b
            : ast.op === 'lt'
              ? a < b
              : ast.op === 'gt'
                ? a > b
                : ast.op === 'lte'
                  ? a <= b
                  : a >= b;
        return ok(truth ? 1 : 0);
      });
    case 'if': {
      const cond = evaluateFormula(ast.cond, ctx);
      if (!cond.ok) return cond;
      return evaluateFormula(cond.value !== 0 ? ast.whenTrue : ast.whenFalse, ctx);
    }
    case 'tableLookup': {
      const key = evaluateFormula(ast.key, ctx);
      if (!key.ok) return key;
      const value = ctx.tables?.[ast.tableId]?.[String(key.value)];
      return value === undefined
        ? err(appError('rules.missing_table_entry', 'Validation'))
        : ok(value);
    }
  }
}
