/**
 * The OPFS **store worker** (#105-C): the Web Worker that actually owns the durable browser stores.
 *
 * It runs *inside* a worker precisely because the OPFS SAHPool VFS is worker-only (see
 * `worker-protocol.ts`): here — and only here — `createOpfsEventStore()` / `createOpfsReadModelStore()`
 * can install the SAHPool VFS and open their SQLite-WASM databases. On startup it opens both stores,
 * signals readiness (or an init error) to the main thread, then serves the main-thread proxies' RPC
 * calls by forwarding each to the matching port method and posting the result back.
 *
 * This file is a composition detail of `apps/web` (a worker entry, not a reusable module); the reusable
 * adapters it hosts live in `@grimora/event-store` / `@grimora/cqrs-read`.
 */

import { createOpfsReadModelStore } from '@grimora/cqrs-read/opfs';
import { createOpfsEventStore } from '@grimora/event-store/opfs';
import type { StoreWorkerReady, StoreWorkerRequest, StoreWorkerResponse } from './worker-protocol';

/**
 * The worker global, narrowed to just the messaging surface we use. Cast this way (rather than adding the
 * `WebWorker` lib) because that lib redefines `self` and collides with the app's `DOM` lib in the shared
 * `apps/web` tsconfig; the narrow shape keeps typecheck clean without a per-file lib override.
 */
const ctx = self as unknown as {
  postMessage(message: StoreWorkerResponse | StoreWorkerReady): void;
  onmessage: ((event: { readonly data: StoreWorkerRequest }) => void) | null;
};

/** The port methods the proxy is allowed to invoke, per target — an explicit allow-list, not open dispatch. */
const ALLOWED_METHODS: Readonly<Record<StoreWorkerRequest['target'], readonly string[]>> = {
  events: ['append', 'readStream', 'readAll'],
  reads: ['get', 'put', 'getCheckpoint', 'setCheckpoint', 'clear'],
};

/**
 * Open both OPFS stores once, on worker startup. Distinct DB files (the #105-B defaults) so the event log
 * and the read models are independent databases within the same SAHPool-managed OPFS directory.
 * @returns the two store instances keyed by RPC target
 */
async function openStores(): Promise<{
  readonly events: Awaited<ReturnType<typeof createOpfsEventStore>>;
  readonly reads: Awaited<ReturnType<typeof createOpfsReadModelStore>>;
}> {
  const [events, reads] = await Promise.all([createOpfsEventStore(), createOpfsReadModelStore()]);
  return { events, reads };
}

// Kick off store creation immediately; every incoming call awaits this same promise, so the databases are
// opened exactly once and calls that arrive during startup queue naturally behind it.
const storesPromise = openStores();

storesPromise.then(
  () => ctx.postMessage({ kind: 'ready' }),
  (error: unknown) =>
    ctx.postMessage({
      kind: 'init-error',
      error: error instanceof Error ? error.message : String(error),
    }),
);

ctx.onmessage = (event) => {
  const { id, target, method, args } = event.data;
  // Resolve the stores, run the call, and reply — all async so a slow WASM startup never blocks the reply.
  void (async () => {
    try {
      if (!ALLOWED_METHODS[target]?.includes(method)) {
        throw new Error(`store worker: method "${method}" is not permitted on target "${target}"`);
      }
      const stores = await storesPromise;
      const store = stores[target] as unknown as Record<
        string,
        ((...a: readonly unknown[]) => unknown) | undefined
      >;
      const fn = store[method];
      // The allow-list above guarantees `method` is a real port method, so this is defensive only.
      if (typeof fn !== 'function') throw new Error(`store worker: no method "${method}"`);
      // A domain `Result` (e.g. an append `Conflict`) is a normal return value here, not an infra error —
      // it travels back under `ok: true` and is interpreted by the caller's use-case logic.
      const value = await fn.call(store, ...args);
      ctx.postMessage({ id, ok: true, value });
    } catch (error) {
      // A *thrown* error is infra failure (OPFS gone, bad SQL) — reject the proxy promise so it is loud.
      ctx.postMessage({
        id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  })();
};
