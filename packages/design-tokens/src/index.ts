/**
 * Typed references to Grimora's **semantic** design tokens as CSS `var(...)` strings.
 *
 * Why this exists: consumers that set styles from TypeScript (inline styles, style objects) should
 * reference the semantic layer *by name* — `tokens.color.surface`, not the raw custom-property string or,
 * worse, a hard-coded colour. This keeps the ADR 0007 "consume only semantic tokens, never primitives"
 * rule type-checked at the call site. The actual values (and the light/dark cascade) live in
 * `tokens.css`; this module only names the variables, so it never duplicates the values.
 *
 * Scaffold note (#105-A): both this map and `tokens.css` are hand-authored placeholders until the
 * ADR 0007 JSON→artefact generation pipeline exists — at which point both are generated, not edited.
 */

/**
 * The semantic token references, grouped by role. `as const` so each entry is a literal `var(--…)`
 * string type, not `string` — callers get autocompletion and cannot pass an unknown token by accident.
 */
export const tokens = {
  color: {
    surface: 'var(--gr-color-surface)',
    text: 'var(--gr-color-text)',
    accent: 'var(--gr-color-accent)',
    border: 'var(--gr-color-border)',
  },
  space: {
    sm: 'var(--gr-space-sm)',
    md: 'var(--gr-space-md)',
    lg: 'var(--gr-space-lg)',
  },
  font: {
    sans: 'var(--gr-font-sans)',
  },
} as const;
