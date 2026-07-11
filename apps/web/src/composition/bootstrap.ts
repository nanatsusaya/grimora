/**
 * The process-wide composition singleton for `apps/web` (#105-C).
 *
 * `createAppComposition()` spins up a Web Worker and opens the OPFS databases, so it must run **once** per
 * page load — both the React shell (`main.tsx`) and the dev-only OPFS smoke (`opfs-smoke.ts`) go through
 * here to share the *same* stores and the *same* device identity rather than opening the SAHPool VFS
 * twice (which would throw). This is the one small piece of module-level mutable state the shell keeps;
 * everything downstream receives the composition explicitly.
 */

import { type AppComposition, createAppComposition } from './composition-root';

/** The lazily-created singleton; `undefined` until the first {@link getComposition} call. */
let instance: AppComposition | undefined;

/**
 * Get (creating on first call) the shared application composition for this page load.
 * @returns the one wired {@link AppComposition} for the running app
 */
export function getComposition(): AppComposition {
  instance ??= createAppComposition();
  return instance;
}
