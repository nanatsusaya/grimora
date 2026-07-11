/**
 * Flush the app-shell caches and reload — the action behind the UI "Clear cache" button.
 *
 * It exists so the owner can recover from a stale cached shell **without opening DevTools** (after the
 * #105-D stale-service-worker incident): it unregisters every service worker and deletes every Cache
 * Storage entry on this origin, then hard-reloads so the next load fetches everything fresh.
 *
 * It deliberately clears only the **code/shell** layer — **not** OPFS or `localStorage` — so the user's
 * character data and device identity (ADR 0012 §13) survive. This is "clear cache", not "reset data".
 */

/**
 * Unregister all service workers, delete all Cache Storage entries, then reload the page.
 * @returns resolves just before the reload is triggered (the reload then discards the page)
 */
export async function clearAppCacheAndReload(): Promise<void> {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }
  if ('caches' in globalThis) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
  // Reload from the network now that no service worker or cache can serve a stale shell.
  window.location.reload();
}
