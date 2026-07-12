/**
 * Lifecycle tests for {@link createWorkerBackedStores} (audit F-11, #190): tearing the store worker down
 * must **settle** any in-flight RPC promise (reject it), not leave it pending forever, and a call made after
 * teardown must reject immediately. A controllable fake `Worker` (injected via the factory param, ADR 0017)
 * models exactly the hazard — a request outstanding when HMR / the dev "Reset all" / a test teardown
 * terminates the worker. The happy-path RPC round-trip is covered by the gated OPFS e2e (a real worker is
 * browser-only), so it is not re-created here.
 *
 * Rejections are asserted by resolving `.then(onFulfilled, onRejected)` to a tag string rather than
 * `expect(...).rejects` — the latter hangs in this bun version when handed a promise created earlier in the
 * test (before the action that rejects it).
 */

import { describe, expect, test } from 'bun:test';
import { createWorkerBackedStores } from './worker-backed-stores';

/**
 * A fake `Worker` that records posts but never *answers* them, exposing a `signalReady()` so the test can
 * resolve the store's boot `ready` promise (the real worker sends an unsolicited `{ kind: 'ready' }` once
 * OPFS opens). Not answering RPCs is the point — it lets a call sit pending until teardown.
 */
function controllableWorker(): { worker: Worker; signalReady(): void } {
  const w = {
    postMessage: () => {},
    terminate: () => {},
    onmessage: null as ((event: MessageEvent) => void) | null,
    onerror: null as ((event: ErrorEvent) => void) | null,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  };
  return {
    worker: w as unknown as Worker,
    signalReady: () => w.onmessage?.({ data: { kind: 'ready' } } as MessageEvent),
  };
}

/** Resolve a promise to a tag describing its settlement, so a rejection is asserted without `.rejects`. */
function settle(promise: Promise<unknown>): Promise<string> {
  return promise.then(
    () => 'resolved',
    (error) => `rejected:${(error as Error).message}`,
  );
}

describe('createWorkerBackedStores lifecycle (#190, F-11)', () => {
  test('terminate() rejects an in-flight RPC instead of leaving its promise pending forever', async () => {
    const { worker, signalReady } = controllableWorker();
    const { events, ready, terminate } = createWorkerBackedStores(() => worker);
    signalReady();
    await ready; // boot completes; now start a call the worker will never answer

    const outcome = settle(events.readAll(0));
    terminate();
    expect(await outcome).toContain('terminated');
  });

  test('a call made after terminate() rejects immediately (worker is closed)', async () => {
    const { worker, signalReady } = controllableWorker();
    const { events, ready, terminate } = createWorkerBackedStores(() => worker);
    signalReady();
    await ready;

    terminate();
    expect(await settle(events.readAll(0))).toContain('closed');
  });
});
