/**
 * Browser entry point for the `apps/web` PWA shell — the one place that mounts React onto the DOM.
 *
 * Kept intentionally thin (ADR 0012 §4 "thin frontend state"): it imports the semantic design tokens
 * (ADR 0007 — the stylesheet the whole app cascades from) and mounts the top-level `App`. No store,
 * identity, or use-case wiring lives here yet — that is the composition root's job, added in #105-C;
 * this scaffold (#105-A) only proves the shell renders in a browser.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@grimora/design-tokens/tokens.css';
import { App } from './App';
import { getComposition } from './composition/bootstrap';
import { createCharacterView } from './state/character-view';

const rootElement = document.getElementById('root');
if (!rootElement) {
  // The shell cannot mount without its root node — fail loudly rather than render into nothing.
  throw new Error('Grimora: #root element not found in index.html');
}

// Wire the offline composition once (opens the OPFS store worker + resolves the device identity) and build
// the reactive character-sheet view over it (#105-C composition root → #105-D view). `init()` opens the
// stores, catches the projection up, and re-opens any persisted character; it is fire-and-forget because
// the view notifies the mounted app when its state becomes ready.
const composition = getComposition();
const view = createCharacterView(composition);
void view.init();

createRoot(rootElement).render(
  <StrictMode>
    <App view={view} />
  </StrictMode>,
);

// Register the minimal app-shell service worker (public/sw.js) so the installed PWA opens offline.
// Registration failures are non-fatal — the app still works online without it (ADR 0012 §1 shell).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

// Dev-only: expose the OPFS smoke surface for the Playwright browser test (#105-C). The dynamic import
// keeps the WASM store — and this harness — out of the production shell (the branch is dead-code-eliminated
// when `import.meta.env.DEV` is statically false at build time).
if (import.meta.env.DEV) {
  import('./opfs-smoke').then((smoke) => smoke.installOpfsSmoke());
}
