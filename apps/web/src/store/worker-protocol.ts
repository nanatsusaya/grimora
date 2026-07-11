/**
 * The typed message protocol between the main thread and the OPFS **store worker** (#105-C).
 *
 * **Why a worker at all:** the OPFS SAHPool VFS the #105-B stores use is **worker-only** —
 * `FileSystemFileHandle.createSyncAccessHandle` (which SAHPool needs) does not exist on the main thread,
 * so `createOpfsEventStore()` / `createOpfsReadModelStore()` can only run inside a Web Worker. The
 * composition root therefore talks to the stores over `postMessage` RPC: the worker owns the real
 * adapters; the main thread holds thin proxies (`worker-backed-stores.ts`) that satisfy the
 * `EventStorePort` / `ReadModelStorePort` interfaces by forwarding each call here.
 *
 * **Why hand-rolled (no Comlink):** the surface is a fixed handful of methods with structured-clone-safe
 * arguments and results, so a ~1-file typed protocol is cheaper than a dependency and keeps the boundary
 * explicit (lean-deps line of this repo). Every payload below is deliberately structured-clone-safe
 * (strings, numbers, plain event envelopes, `Result` records) — no functions, classes, or DOM objects
 * cross the boundary.
 */

/** Which store instance in the worker a call targets. */
export type StoreTarget = 'events' | 'reads';

/**
 * A single RPC call from the main thread to the worker. `args` are the positional arguments of the named
 * method exactly as the `EventStorePort` / `ReadModelStorePort` method declares them, so the worker can
 * forward them unchanged. `id` correlates the eventual {@link StoreWorkerResponse}.
 */
export interface StoreWorkerRequest {
  /** correlates the response to this call (monotonic per proxy); why: `postMessage` has no reply channel */
  readonly id: number;
  /** which store the call is for — the worker holds one instance of each */
  readonly target: StoreTarget;
  /** the port method name to invoke (e.g. `append`, `readStream`, `get`, `setCheckpoint`) */
  readonly method: string;
  /** the method's positional arguments, structured-clone-safe, forwarded verbatim */
  readonly args: readonly unknown[];
}

/**
 * The worker's reply to one {@link StoreWorkerRequest}. `ok` distinguishes a normal return (including a
 * domain `Result` value, which is itself a legitimate return and *not* an error here) from an **infra**
 * failure — a thrown exception such as OPFS being unavailable — which is surfaced as a rejected proxy
 * promise so the composition root can fail loudly rather than silently mis-store.
 */
export type StoreWorkerResponse =
  | {
      readonly id: number;
      readonly ok: true;
      /** the method's resolved return value (already structured-clone-safe) */
      readonly value: unknown;
    }
  | {
      readonly id: number;
      readonly ok: false;
      /** a human-readable message for the thrown infra error (not a domain `Result` failure) */
      readonly error: string;
    };

/**
 * The one message the worker posts unsolicited: an `init` signal so the main thread can await store
 * readiness (WASM load + SAHPool install) and surface an init failure *before* the first real call.
 */
export type StoreWorkerReady =
  | { readonly kind: 'ready' }
  | { readonly kind: 'init-error'; readonly error: string };
