/**
 * Full local-state reset — the **development-only** "Reset all" action (issue #133).
 *
 * It wipes *everything* this origin persists, so the app can be re-tested from a genuine first-launch
 * state without DevTools: the OPFS databases (event store + read models, #105-B), `localStorage` (the
 * device identity and the current-character/campaign pointers, ADR 0012 §13), and the app-shell caches
 * (service workers + Cache Storage). It then reloads, so a fresh store worker opens empty databases and a
 * new implicit device identity is minted.
 *
 * This is a deliberate data-loss action and is only ever wired behind the dev-only button (see `App.tsx`);
 * removing/hiding it before launch is tracked in issue #134.
 */

import type { AppComposition } from './composition/composition-root';

/**
 * Collect the names of every entry directly under an OPFS directory handle.
 * @param root  the OPFS directory to enumerate
 * @returns     the entry names (files and subdirectories) currently present
 */
async function directoryEntryNames(root: FileSystemDirectoryHandle): Promise<string[]> {
  const names: string[] = [];
  for await (const name of root.keys()) names.push(name);
  return names;
}

/**
 * Delete every entry in the origin's OPFS root (the event-store + read-model SAHPool pools live here).
 * Retries briefly: the caller terminates the store worker first, but the OPFS access handles it held are
 * released asynchronously, so an immediate `removeEntry` can still hit a locked file — a short backoff
 * lets the handles drop. Best-effort per entry (a stubborn file is skipped rather than throwing).
 * @returns resolves once the OPFS root is empty or the retry budget is exhausted
 */
async function wipeOpfs(): Promise<void> {
  if (!navigator.storage?.getDirectory) return;
  const root = await navigator.storage.getDirectory();
  for (let attempt = 0; attempt < 5; attempt++) {
    const names = await directoryEntryNames(root);
    if (names.length === 0) return;
    await Promise.all(
      names.map((name) => root.removeEntry(name, { recursive: true }).catch(() => undefined)),
    );
    // Give any just-released OPFS handle a moment to actually free the file before the next attempt.
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

/**
 * Unregister all service workers and delete all Cache Storage entries on this origin (the app-shell cache
 * layer). Does not touch OPFS/localStorage — those are wiped separately.
 * @returns resolves once the shell caches and service workers are gone
 */
async function clearShellCaches(): Promise<void> {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }
  if ('caches' in globalThis) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
}

/**
 * Wipe all local state for this origin and reload into a first-launch state.
 * @param composition  the wired composition, whose store worker is terminated first to release the OPFS
 *                     SAHPool file handles so the databases can actually be deleted
 * @returns            resolves just before the reload (which then discards the page)
 */
export async function resetAllAndReload(composition: AppComposition): Promise<void> {
  // Terminate the store worker so it stops holding the OPFS SAHPool access handles (which would otherwise
  // block deleting the database files).
  composition.terminate();
  await wipeOpfs();
  // Clear the device identity + current-character/campaign pointers (the app only uses `grimora.*` keys).
  localStorage.clear();
  await clearShellCaches();
  // Reload: a new worker opens empty stores, a fresh device identity is minted, no character exists.
  window.location.reload();
}
