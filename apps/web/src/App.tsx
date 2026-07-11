/**
 * Top-level component of the `apps/web` PWA shell.
 *
 * Scaffold placeholder (#105-A): it renders a minimal shell styled **only via semantic design tokens**
 * (ADR 0007 — never hard-coded colours/primitives) to prove the tokens flow through and the app paints
 * in a browser. The real surfaces — the offline composition root (#105-C) and the character-sheet view
 * (#105-D) — replace this body; the token-only styling discipline it demonstrates is the part that stays.
 *
 * Presentation is intentionally as **plain** as possible (owner request, 2026-07-11): a neutral surface,
 * default text flow, no accent colour or decorative layout. How it should actually *look* is decided later.
 */

/**
 * The placeholder application shell.
 * @returns the scaffold landing view rendered from semantic tokens
 */
export function App() {
  return (
    <main
      style={{
        minHeight: '100vh',
        padding: 'var(--gr-space-md)',
        background: 'var(--gr-color-surface)',
        color: 'var(--gr-color-text)',
        fontFamily: 'var(--gr-font-sans)',
      }}
    >
      <h1>Grimora</h1>
      <p>Offline-first PWA shell — scaffold (#105-A).</p>
    </main>
  );
}
