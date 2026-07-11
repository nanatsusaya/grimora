/**
 * `Field` — a shared label-plus-control row (`@grimora/ui`).
 *
 * A minimal presentational primitive for the character sheet (#105-D): it pairs a text label with an
 * arbitrary control or value (a number input, a read-only derived value, …). Like the other `@grimora/ui`
 * components it is purely presentational (ADR 0008 §2), styled from **semantic design tokens** only
 * (ADR 0007), and deliberately plain pending the later visual-design decision (owner, 2026-07-11).
 */
import type { ReactNode } from 'react';

/**
 * Props for {@link Field}.
 */
export interface FieldProps {
  /** why: the human-readable label shown beside the control; the caller owns i18n/label choice */
  label: string;
  /** why: the control or value the label describes — structural, so any node is accepted */
  children: ReactNode;
}

/**
 * Render a labelled row.
 * @param props  the label text and the control/value it labels ({@link FieldProps})
 * @returns      a labelled row styled from semantic tokens
 */
export function Field({ label, children }: FieldProps) {
  return (
    // The control is passed as `children` and nested inside this `<label>` (valid HTML label association),
    // but biome cannot statically see a control inside an arbitrary `ReactNode`, so it flags the label.
    // biome-ignore lint/a11y/noLabelWithoutControl: the caller nests the associated control as `children`
    <label
      style={{
        display: 'flex',
        gap: 'var(--gr-space-sm)',
        alignItems: 'baseline',
        padding: 'var(--gr-space-sm) 0',
        fontFamily: 'var(--gr-font-sans)',
        color: 'var(--gr-color-text)',
      }}
    >
      <span style={{ minWidth: '8rem' }}>{label}</span>
      {children}
    </label>
  );
}
