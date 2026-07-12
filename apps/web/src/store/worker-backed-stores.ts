/**
 * Main-thread proxies over the OPFS **store worker** (#105-C): thin objects that satisfy the core
 * `EventStorePort` / `ReadModelStorePort` contracts by forwarding every call to the worker over RPC (see
 * `worker-protocol.ts` for *why* the real stores must live in a worker).
 *
 * The composition root wires these proxies exactly where it would wire the native `bun:sqlite` adapters —
 * the port contract is identical, so no core or use-case code knows a worker is involved. That is the
 * whole point of the port boundary (ADR 0003): the OPFS-is-worker-only constraint is absorbed here, at
 * the composition edge, and never leaks into the Domain/Application.
 */

import type { AppError, EventStorePort, ReadModelStorePort } from '@grimora/core-domain';
import type { PersistedEvent, Result } from '@grimora/shared-types';
import type {
  StoreTarget,
  StoreWorkerReady,
  StoreWorkerRequest,
  StoreWorkerResponse,
} from './worker-protocol';

/**
 * The durable OPFS event store proxy — the `EventStorePort` plus `replicate` (the sync-pull apply path,
 * #107 slice 3b), which is on the concrete store, not the pure port. The composition root passes this to
 * the sync service so a pulled cloud page is applied locally by id (idempotent, ADR 0005 §3).
 */
export type WorkerBackedEventStore = EventStorePort & {
  /** Apply cloud-pulled events into the local log, idempotent by `id` (see `@grimora/event-store`). */
  replicate(events: readonly PersistedEvent[]): Promise<void>;
};

/** The pair of durable stores the composition root consumes, plus a readiness handle to await on boot. */
export interface WorkerBackedStores {
  /** the durable OPFS event store (+ `replicate`), proxied to the worker */
  readonly events: WorkerBackedEventStore;
  /** the durable OPFS read-model store, proxied to the worker */
  readonly reads: ReadModelStorePort;
  /**
   * Resolves once the worker has opened both OPFS databases; rejects if OPFS init fails. Await this on
   * boot so an unusable storage environment fails loudly at startup, not mid-write.
   */
  readonly ready: Promise<void>;
  /** Tear down the worker (releases the OPFS SAHPool handles). For tests/HMR; the app holds one for its life. */
  terminate(): void;
}

/**
 * Spin up the store worker and return main-thread proxies for both stores.
 *
 * The `new URL(..., import.meta.url)` form is how Vite discovers and bundles a worker entry; `type:
 * 'module'` matches the ESM worker the adapters need (they use static `import`).
 * @param workerFactory  builds the underlying `Worker` — defaulted to the real Vite-bundled store worker;
 *                       injected in tests (ADR 0017) so the lifecycle (terminate rejecting in-flight calls,
 *                       #190) can be exercised without a real browser worker
 * @returns the two port-shaped proxies, a `ready` promise, and a `terminate` handle
 */
export function createWorkerBackedStores(
  workerFactory: () => Worker = () =>
    new Worker(new URL('./store.worker.ts', import.meta.url), { type: 'module' }),
): WorkerBackedStores {
  const worker = workerFactory();

  // Correlate each request with its response: the worker echoes the `id`, and we resolve the matching
  // pending promise. A monotonic counter is unique per worker instance, which is all we need.
  let nextId = 0;
  const pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (reason: Error) => void }
  >();
  // Once the worker is torn down, no reply will ever arrive; `closed` lets a late `call()` fail fast
  // instead of registering a promise that could never settle (audit F-11, #190).
  let closed = false;

  /** Reject every in-flight request with `error` and clear the map — the single "fail all pending" path. */
  const rejectAllPending = (error: Error): void => {
    for (const [id, entry] of pending) {
      pending.delete(id);
      entry.reject(error);
    }
  };

  let resolveReady!: () => void;
  let rejectReady!: (reason: Error) => void;
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });

  worker.onmessage = (event: MessageEvent<StoreWorkerResponse | StoreWorkerReady>) => {
    const data = event.data;
    if ('kind' in data) {
      // The unsolicited readiness signal (not tied to a request id).
      if (data.kind === 'ready') resolveReady();
      else rejectReady(new Error(`OPFS store init failed: ${data.error}`));
      return;
    }
    const entry = pending.get(data.id);
    if (!entry) return;
    pending.delete(data.id);
    if (data.ok) entry.resolve(data.value);
    else entry.reject(new Error(`OPFS store call failed: ${data.error}`));
  };

  // A worker-level error (e.g. the module failing to load) rejects readiness and every in-flight call, so
  // nothing hangs forever waiting on a worker that will never reply.
  worker.onerror = (event: ErrorEvent) => {
    const error = new Error(`OPFS store worker error: ${event.message}`);
    rejectReady(error);
    rejectAllPending(error);
  };

  /**
   * Send one RPC call and await its correlated reply.
   * @param target  which store the call is for
   * @param method  the port method name
   * @param args    the method's positional arguments (structured-clone-safe)
   * @returns       the method's return value, typed by the caller
   */
  function call(target: StoreTarget, method: string, args: readonly unknown[]): Promise<unknown> {
    // After teardown the worker is gone, so a new call could never be answered — reject immediately rather
    // than leave a forever-pending promise (audit F-11, #190).
    if (closed) return Promise.reject(new Error('OPFS store worker is closed'));
    const id = nextId++;
    const request: StoreWorkerRequest = { id, target, method, args };
    return new Promise<unknown>((resolve, reject) => {
      pending.set(id, { resolve, reject });
      worker.postMessage(request);
    });
  }

  const events: WorkerBackedEventStore = {
    append(streamId, expectedVersion, eventsToAppend): Promise<Result<void, AppError>> {
      return call('events', 'append', [streamId, expectedVersion, eventsToAppend]) as Promise<
        Result<void, AppError>
      >;
    },
    readStream(streamId, fromVersion): Promise<readonly PersistedEvent[]> {
      return call('events', 'readStream', [streamId, fromVersion]) as Promise<
        readonly PersistedEvent[]
      >;
    },
    readAll(fromPosition): Promise<readonly PersistedEvent[]> {
      return call('events', 'readAll', [fromPosition]) as Promise<readonly PersistedEvent[]>;
    },
    replicate(eventsToApply): Promise<void> {
      return call('events', 'replicate', [eventsToApply]) as Promise<void>;
    },
  };

  const reads: ReadModelStorePort = {
    get<T>(collection: string, id: string): Promise<T | undefined> {
      return call('reads', 'get', [collection, id]) as Promise<T | undefined>;
    },
    put<T>(collection: string, id: string, value: T): Promise<void> {
      return call('reads', 'put', [collection, id, value]) as Promise<void>;
    },
    getCheckpoint(projection: string): Promise<number> {
      return call('reads', 'getCheckpoint', [projection]) as Promise<number>;
    },
    setCheckpoint(projection: string, position: number): Promise<void> {
      return call('reads', 'setCheckpoint', [projection, position]) as Promise<void>;
    },
    clear(): Promise<void> {
      return call('reads', 'clear', []) as Promise<void>;
    },
  };

  return {
    events,
    reads,
    ready,
    terminate() {
      // Mark closed and reject any in-flight RPC so its promise settles instead of hanging forever (audit
      // F-11, #190) — e.g. a call outstanding during HMR / the dev "Reset all" / test teardown — then
      // release the worker's OPFS handles.
      closed = true;
      rejectAllPending(new Error('OPFS store worker terminated'));
      worker.terminate();
    },
  };
}
