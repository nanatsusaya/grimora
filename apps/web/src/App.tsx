/**
 * Top-level component of the `apps/web` PWA shell.
 *
 * At #105-C it becomes the first surface wired to the offline composition root: it renders the device's
 * implicit local identity (ADR 0012 §13) and reflects OPFS store readiness — a minimal, human-observable
 * proof that the app **boots and works fully offline, with no login and no network** (there is deliberately
 * nothing to click yet; the character-sheet view and its interactions are #105-D). The token-only styling
 * discipline from #105-A stays.
 *
 * Presentation is intentionally as **plain** as possible (owner request, 2026-07-11): a neutral surface,
 * default text flow, no accent colour or decorative layout. How it should actually *look* is decided later.
 */

import { useEffect, useState } from 'react';
import type { AppComposition } from './composition/composition-root';

/** Boot phase of the OPFS stores, surfaced so the shell shows honest state instead of a blank flash. */
type StoreStatus = 'starting' | 'ready' | 'error';

/**
 * The application shell.
 * @param props              the component props
 * @param props.composition  the wired offline composition (identity + stores) from the composition root
 * @returns                  the shell view rendered from semantic tokens
 */
export function App({ composition }: { readonly composition: AppComposition }) {
  const [status, setStatus] = useState<StoreStatus>('starting');

  useEffect(() => {
    let cancelled = false;
    composition.ready.then(
      () => {
        if (!cancelled) setStatus('ready');
      },
      () => {
        if (!cancelled) setStatus('error');
      },
    );
    // Guard against a resolve after unmount (StrictMode double-invoke in dev), avoiding a stray setState.
    return () => {
      cancelled = true;
    };
  }, [composition]);

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
      <p>Offline-first PWA shell — composition root (#105-C).</p>
      <dl>
        <dt>Local device identity</dt>
        <dd>
          <code>{composition.actor.userId}</code>
        </dd>
        <dt>Local storage</dt>
        <dd>
          {status === 'starting' && 'opening OPFS stores…'}
          {status === 'ready' && 'ready (offline)'}
          {status === 'error' && 'unavailable — this browser blocks OPFS'}
        </dd>
      </dl>
    </main>
  );
}
