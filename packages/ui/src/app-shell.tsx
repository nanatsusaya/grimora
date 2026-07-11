/**
 * `AppShell` — the outermost presentational frame shared by every `apps/web` screen.
 *
 * Why it lives in `packages/ui` (not `apps/web`): ADR 0003's module map puts presentation components in
 * the shared `ui` package so web (and later Tauri/Expo) reuse them, while composition roots (`apps/*`)
 * only wire adapters. This is the near-empty seed of that package (#105-A) — a single semantic-token-styled
 * frame the character-sheet view (#105-D) will render inside. It holds **no** domain logic (ADR 0008 §2).
 */
import type { ReactNode } from 'react';

/**
 * Props for {@link AppShell}.
 */
export interface AppShellProps {
  /** why: lets each screen name itself for the shell's heading region without the shell knowing routes */
  title: string;
  /** why: the screen content the shell frames; structural, so no further per-screen contract is implied */
  children: ReactNode;
}

/**
 * Render the application frame around a screen's content.
 * @param props  the shell's title and framed content ({@link AppShellProps})
 * @returns      the framed layout, styled from semantic design tokens only (ADR 0007)
 */
export function AppShell({ title, children }: AppShellProps) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--gr-color-surface)',
        color: 'var(--gr-color-text)',
        fontFamily: 'var(--gr-font-sans)',
      }}
    >
      <header
        style={{
          padding: 'var(--gr-space-md)',
          borderBottom: '1px solid var(--gr-color-border)',
        }}
      >
        <h1 style={{ margin: 0 }}>{title}</h1>
      </header>
      <main style={{ padding: 'var(--gr-space-md)' }}>{children}</main>
    </div>
  );
}
