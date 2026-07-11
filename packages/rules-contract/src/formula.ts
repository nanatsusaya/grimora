/**
 * Formula representation — a closed, JSON-serializable expression AST over a small set of node kinds
 * (ADR 0021 §1 / R1). Not a text DSL, not arbitrary TS, not WASM: pure data that the core interpreter
 * walks with no `eval`/`vm`, so it is trivially sandboxable and inspectable (for breakdown/audit UI).
 *
 * Plugins do not hand-write raw nodes; they use the {@link f} builder (ADR 0021 R2), which simply
 * emits this tree. The AST is the wire/storage format; the builder is sugar.
 *
 * **Provisional v0** (ADR 0022 §3) — frozen later in ADR 0025.
 */

import type { DiceTerm } from './dice';

/** Comparison operators for the `cmp` node; each yields 1 (true) or 0 (false). */
export type CmpOp = 'eq' | 'lt' | 'gt' | 'lte' | 'gte';

/**
 * The closed set of formula node kinds (ADR 0021 §1 / R1). Extend only by amendment/superseding ADR —
 * `floor`/`ceil`/`round`/`mod` were added by the **2026-07-09 ADR 0021 amendment** (additive within the
 * SDK `0.x` line, ADR 0025 §1), because the original set could not express common rounding (e.g. the
 * D&D-5e ability modifier `floor((score−10)/2)` or DSA5 halved values).
 *
 * Leaves: `const` (literal), `traitRef` (a trait id resolved from the character's trait container),
 * `dice` (a roll whose already-rolled value is injected by the core, keyed by `ref` — ADR 0021 §3's
 * "dice results already rolled"). Operators: arithmetic (`div` is **real** division — see the builder),
 * the unary rounding ops `floor`/`ceil`/`round`, `mod`, `min`/`max`, `cmp`, `if`, and `tableLookup`
 * (a keyed table the plugin supplies).
 */
export type FormulaAst =
  | { readonly kind: 'const'; readonly value: number }
  | { readonly kind: 'traitRef'; readonly traitId: string }
  | { readonly kind: 'dice'; readonly ref: string; readonly term: DiceTerm }
  | { readonly kind: 'add'; readonly left: FormulaAst; readonly right: FormulaAst }
  | { readonly kind: 'sub'; readonly left: FormulaAst; readonly right: FormulaAst }
  | { readonly kind: 'mul'; readonly left: FormulaAst; readonly right: FormulaAst }
  | { readonly kind: 'div'; readonly left: FormulaAst; readonly right: FormulaAst }
  | { readonly kind: 'mod'; readonly left: FormulaAst; readonly right: FormulaAst }
  | { readonly kind: 'floor'; readonly operand: FormulaAst }
  | { readonly kind: 'ceil'; readonly operand: FormulaAst }
  | { readonly kind: 'round'; readonly operand: FormulaAst }
  | { readonly kind: 'min'; readonly left: FormulaAst; readonly right: FormulaAst }
  | { readonly kind: 'max'; readonly left: FormulaAst; readonly right: FormulaAst }
  | {
      readonly kind: 'cmp';
      readonly op: CmpOp;
      readonly left: FormulaAst;
      readonly right: FormulaAst;
    }
  | {
      readonly kind: 'if';
      readonly cond: FormulaAst;
      // `whenTrue`/`whenFalse` rather than `then`/`else`: a `then` property makes an object thenable
      // (breaks `await`), which the linter rightly forbids.
      readonly whenTrue: FormulaAst;
      readonly whenFalse: FormulaAst;
    }
  | { readonly kind: 'tableLookup'; readonly tableId: string; readonly key: FormulaAst };

/**
 * The builder — fluent sugar that emits {@link FormulaAst} nodes so plugin authors never hand-write
 * the tree (ADR 0021 R2). Ships in the SDK from day one; the AST it produces is the stored format.
 */
export const f = {
  /** A literal number. */
  const: (value: number): FormulaAst => ({ kind: 'const', value }),
  /** A reference to a trait's current value by id (resolved from the character's trait container). */
  trait: (traitId: string): FormulaAst => ({ kind: 'traitRef', traitId }),
  /** A dice leaf; its rolled value is injected by the core at evaluation time, keyed by `ref`. */
  dice: (ref: string, term: DiceTerm): FormulaAst => ({ kind: 'dice', ref, term }),
  /** `left + right`. */
  add: (left: FormulaAst, right: FormulaAst): FormulaAst => ({ kind: 'add', left, right }),
  /** `left - right`. */
  sub: (left: FormulaAst, right: FormulaAst): FormulaAst => ({ kind: 'sub', left, right }),
  /** `left * right`. */
  mul: (left: FormulaAst, right: FormulaAst): FormulaAst => ({ kind: 'mul', left, right }),
  /** **Real** (non-truncating) division; division by zero fails evaluation (never `NaN`/`Infinity`).
   * Write integer division explicitly as `floor(div(a, b))` (ADR 0021 §1). */
  div: (left: FormulaAst, right: FormulaAst): FormulaAst => ({ kind: 'div', left, right }),
  /** Modulo, **consistent with the ADR's floor-based integer division** (`floor(div(a,b))`): the result
   * is `a − b·floor(a/b)`, so it takes the sign of the **divisor** and the identity
   * `a = b·floor(a/b) + mod(a,b)` holds. `mod` by zero fails evaluation (never `NaN`). For non-negative
   * operands — the common case — this matches the plain remainder. */
  mod: (left: FormulaAst, right: FormulaAst): FormulaAst => ({ kind: 'mod', left, right }),
  /** Round **toward −∞** (e.g. the D&D-5e ability modifier `floor((score−10)/2)`). */
  floor: (operand: FormulaAst): FormulaAst => ({ kind: 'floor', operand }),
  /** Round **toward +∞**. */
  ceil: (operand: FormulaAst): FormulaAst => ({ kind: 'ceil', operand }),
  /** Round to the nearest integer, ties **away from zero** (so `round(2.5)=3`, `round(−2.5)=−3`) —
   * the ADR 0021 amendment's chosen tie rule, matching how most tabletop rules phrase "round .5 up". */
  round: (operand: FormulaAst): FormulaAst => ({ kind: 'round', operand }),
  /** The smaller of the two operands (e.g. cap a value). */
  min: (left: FormulaAst, right: FormulaAst): FormulaAst => ({ kind: 'min', left, right }),
  /** The larger of the two operands (e.g. floor a value at 0). */
  max: (left: FormulaAst, right: FormulaAst): FormulaAst => ({ kind: 'max', left, right }),
  /** A comparison that evaluates to **1 (true) or 0 (false)** — usable as the `cond` of an `if`. */
  cmp: (op: CmpOp, left: FormulaAst, right: FormulaAst): FormulaAst => ({
    kind: 'cmp',
    op,
    left,
    right,
  }),
  /** Ternary: evaluates `whenTrue` if `cond` is non-zero, else `whenFalse` (branches named to avoid a
   * thenable `then` key — see the `if` node above). */
  if: (cond: FormulaAst, whenTrue: FormulaAst, whenFalse: FormulaAst): FormulaAst => ({
    kind: 'if',
    cond,
    whenTrue,
    whenFalse,
  }),
  /** Look up a plugin-supplied keyed table by the evaluated `key` (the numeric key is coerced to a
   * string for the lookup); a missing entry fails evaluation. */
  tableLookup: (tableId: string, key: FormulaAst): FormulaAst => ({
    kind: 'tableLookup',
    tableId,
    key,
  }),
} as const;
