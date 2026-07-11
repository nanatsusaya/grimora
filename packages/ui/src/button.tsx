/**
 * `Button` — the shared presentational button (`@grimora/ui`).
 *
 * Lives in `packages/ui` (not `apps/web`) for the same reason as {@link AppShell}: presentation components
 * are shared across web/Tauri/Expo (ADR 0003 module map) and hold **no** domain logic (ADR 0008 §2) — the
 * caller passes an `onClick`; the button knows nothing about use cases. Styled from **semantic design
 * tokens only** (ADR 0007), deliberately plain pending a later visual-design decision (owner, 2026-07-11).
 */
import type { ReactNode } from 'react';

/**
 * Props for {@link Button}.
 */
export interface ButtonProps {
  /** why: the button's label/content; structural, so no further per-use contract is implied */
  children: ReactNode;
  /** why: what the click does — the caller owns the behaviour (the button stays domain-free, ADR 0008 §2) */
  onClick: () => void;
  /** why: lets a caller disable the action while a command is in flight, avoiding double-submits */
  disabled?: boolean;
  /** why: `submit` inside a `<form>` vs. a plain `button`; defaults to `button` so it never submits by accident */
  type?: 'button' | 'submit';
}

/**
 * Render a plain, token-styled button.
 * @param props  the button's content, click handler, and optional disabled/type ({@link ButtonProps})
 * @returns      the styled `<button>` element
 */
export function Button({ children, onClick, disabled = false, type = 'button' }: ButtonProps) {
  return (
    <button
      type={type === 'submit' ? 'submit' : 'button'}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: 'var(--gr-space-sm) var(--gr-space-md)',
        border: '1px solid var(--gr-color-border)',
        background: 'var(--gr-color-surface)',
        color: 'var(--gr-color-text)',
        fontFamily: 'var(--gr-font-sans)',
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}
