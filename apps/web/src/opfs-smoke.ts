/**
 * Dev-only OPFS smoke surface (issue #105-C, closing the #105-B browser-verification IOU) — the first
 * **in-browser** proof that the OPFS event store persists across a page reload, now driven through the
 * real composition: the store worker (OPFS is worker-only) and the device's implicit identity (ADR 0012
 * §13). It attaches a tiny API to `window` that the Playwright test (`e2e/opfs-smoke.spec.ts`) drives:
 * read the device identity, append a uniquely-marked event, reload, then confirm both the identity was
 * *reused* and the event *survived*.
 *
 * It is **not** a UI surface and is mounted **only in dev builds**, so the production shell neither
 * exposes it nor bundles it. The store-level append (rather than a full use case) keeps the proof focused
 * on exactly what #105-B deferred: that the OPFS binding, reached over the worker RPC, is durable.
 */

import type { EntityId, EventEnvelope, IsoTimestamp } from '@grimora/shared-types';
import { getComposition } from './composition/bootstrap';

/** A fixed aggregate stream the smoke appends to; a real aggregate id is not needed to prove persistence. */
const SMOKE_STREAM = 'opfs-smoke-aggregate' as EntityId;

/** The serialisable view the Playwright driver reads back (only what the assertion needs). */
interface SmokeEvent {
  /** the event type, to sanity-check the row shape survived the round-trip */
  readonly type: string;
  /** the per-append nonce the test matches on to prove *this run's* event persisted */
  readonly nonce: string;
}

/** The dev-only surface attached to `window` for the Playwright OPFS test to call via `page.evaluate`. */
export interface OpfsSmokeApi {
  /**
   * The device's implicit local identity (ADR 0012 §13), so the test can assert it is *reused* across a
   * reload rather than regenerated.
   * @returns the device `userId`
   */
  identity(): string;
  /**
   * Append one uniquely-marked event to the OPFS event store (via the worker) and return its nonce.
   * @returns the nonce embedded in the appended event's payload
   */
  seed(): Promise<string>;
  /**
   * Read the whole OPFS event log back (post-reload in the test).
   * @returns the persisted events reduced to `{ type, nonce }`
   */
  readAll(): Promise<SmokeEvent[]>;
}

declare global {
  interface Window {
    /** why: only present in dev builds (installed by {@link installOpfsSmoke}); the E2E test drives it */
    __grimoraOpfsSmoke?: OpfsSmokeApi;
  }
}

/**
 * Install the dev-only OPFS smoke API onto `window`. Mounted only in dev builds by the caller.
 * @returns nothing — attaches `window.__grimoraOpfsSmoke` as a side effect
 */
export function installOpfsSmoke(): void {
  const composition = getComposition();
  const { events } = composition.deps;

  window.__grimoraOpfsSmoke = {
    identity(): string {
      return composition.actor.userId;
    },
    async seed(): Promise<string> {
      await composition.ready;
      // Append at the next version regardless of prior runs, so the smoke needs no reset/clear: the
      // current stream length is the last version (contiguous 1-based), i.e. the expected version.
      const existing = await events.readStream(SMOKE_STREAM);
      const expectedVersion = existing.length;
      const nonce = crypto.randomUUID();
      const event: EventEnvelope = {
        id: composition.deps.ids.newId(),
        aggregateId: SMOKE_STREAM,
        aggregateType: 'opfs-smoke',
        type: 'smoke.pinged',
        version: expectedVersion + 1,
        schemaVersion: 1,
        occurredAt: composition.deps.clock.now() as IsoTimestamp,
        payload: { nonce },
      };
      const result = await events.append(SMOKE_STREAM, expectedVersion, [event]);
      if (!result.ok) throw new Error(`OPFS smoke append failed: ${result.error.code}`);
      return nonce;
    },
    async readAll(): Promise<SmokeEvent[]> {
      await composition.ready;
      const all = await events.readAll();
      return all.map((e) => ({
        type: e.type,
        nonce: (e.payload as { nonce?: string }).nonce ?? '',
      }));
    },
  };
}
