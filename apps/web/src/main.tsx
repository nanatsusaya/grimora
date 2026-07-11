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

const rootElement = document.getElementById('root');
if (!rootElement) {
  // The shell cannot mount without its root node — fail loudly rather than render into nothing.
  throw new Error('Grimora: #root element not found in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register the minimal app-shell service worker (public/sw.js) so the installed PWA opens offline.
// Registration failures are non-fatal — the app still works online without it (ADR 0012 §1 shell).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
