/**
 * A **storage-engine-agnostic contract test suite** for `EventStorePort` (ADR 0004 §4, ADR 0017
 * port-contract tests). It exists so the in-memory fake (`createInMemoryEventStore`) and every real
 * adapter (SQLite today, Postgres later) can be proven **behaviourally equivalent** against one shared
 * spec — the whole point of a port abstraction (ADR 0003 §4): swap the engine, keep the behaviour.
 *
 * It is deliberately **free of any test framework** (`bun:test` is never imported here) for two reasons:
 * this module is compiled by `tsc` into the published `@grimora/core-domain/testing` subpath (importing
 * `bun:test` from built source would need `@types/bun` and pull a test runner into a shipped entry), and
 * keeping it framework-agnostic lets any runner drive it. Each case is a `{ name, run }` pair; the
 * consuming `*.test.ts` creates one **fresh, empty** store per case and passes it to `run` (isolation is
 * the caller's concern — a new file DB / a new in-memory instance per case). A failing assertion throws —
 * the runner reports it as that named test failing.
 */

import type { EntityId, EventEnvelope, IsoTimestamp } from '@grimora/shared-types';
import type { EventStorePort } from '../application/ports';
import { type AppError, EVENT_ID_MISMATCH_CODE } from '../domain/errors';

/**
 * One named contract case over an already-constructed, empty store. `run` throws on a contract violation.
 */
export interface EventStoreContractCase {
  /** Human-readable behaviour under test, used as the registered test's name. */
  readonly name: string;
  /** Exercise the behaviour against a fresh `store`; throws (via the local assert) if the contract breaks. */
  readonly run: (store: EventStorePort) => Promise<void>;
}

/**
 * Minimal assertion helper — kept local so this module needs no `node:assert` (core-domain has no
 * `@types/node`) and no test framework. Throws an `Error` the runner surfaces as a failure.
 * @param condition  the invariant that must hold
 * @param message    what was expected, shown when it does not
 */
function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`EventStorePort contract violated: ${message}`);
}

/**
 * Build a minimal valid {@link EventEnvelope} for the contract. Only the fields the store must persist
 * and round-trip are set; the concrete `type`/`payload` are irrelevant to storage behaviour (the store
 * is rule-agnostic, ADR 0004 §4), so a synthetic type is used.
 * @param aggregateId  the stream the event belongs to
 * @param version      the 1-based per-aggregate version (assigned by the caller/use-case, not the store)
 * @param seq          a per-test sequence used to make each event `id` globally unique
 * @returns            a fully-formed envelope ready to append
 */
function makeEvent(aggregateId: string, version: number, seq: number): EventEnvelope {
  return {
    id: `evt-${aggregateId}-${version}-${seq}` as EntityId,
    aggregateId: aggregateId as EntityId,
    aggregateType: 'test-aggregate',
    type: 'test.happened',
    version,
    schemaVersion: 1,
    occurredAt: '2026-07-10T00:00:00.000Z' as IsoTimestamp,
    payload: { version, seq },
  };
}

/**
 * Assert a `Result` is an error in the `Conflict` category — the store's optimistic-concurrency contract
 * (ADR 0004 §4: a stale `expectedVersion` fails with `Conflict`, never a throw).
 * @param result  the value returned by `append`
 * @param label   context for the failure message
 */
function assertConflict(
  result: { readonly ok: boolean; readonly error?: AppError },
  label: string,
): void {
  assert(!result.ok, `${label}: expected a Conflict error, got ok`);
  assert(
    result.error?.category === 'Conflict',
    `${label}: expected category 'Conflict', got '${result.error?.category}'`,
  );
}

/**
 * The full contract as an ordered list of cases. The caller registers each with its own test runner and
 * hands `run` a fresh, empty store. Covers: append+read round-trip, optimistic concurrency (fresh stream
 * and existing stream), the **exclusive** `readStream`/`readAll` lower bounds (ADR 0004 §4 — an inclusive
 * reader double-applies the boundary event), stream isolation, and cross-stream `position` ordering.
 * @returns the ordered contract cases to register with a test runner
 */
export function eventStoreContract(): readonly EventStoreContractCase[] {
  return [
    {
      name: 'append to a new stream (expectedVersion 0) then readStream returns them in version order',
      run: async (store) => {
        const append = await store.append('agg-1' as EntityId, 0, [
          makeEvent('agg-1', 1, 1),
          makeEvent('agg-1', 2, 2),
        ]);
        assert(append.ok, 'append to a new stream should succeed');
        const events = await store.readStream('agg-1' as EntityId);
        assert(events.length === 2, `expected 2 events, got ${events.length}`);
        assert(
          events[0]?.version === 1 && events[1]?.version === 2,
          'events must come back in ascending version order',
        );
        assert(
          typeof events[0]?.position === 'number' && events[0].position > 0,
          'the store must assign a positive position on append',
        );
      },
    },
    {
      name: 'append with a stale expectedVersion on a new stream fails with Conflict',
      run: async (store) => {
        // Nothing appended yet → current version is 0; claiming 1 is stale.
        const result = await store.append('agg-1' as EntityId, 1, [makeEvent('agg-1', 2, 1)]);
        assertConflict(result, 'stale expectedVersion on an empty stream');
        const events = await store.readStream('agg-1' as EntityId);
        assert(events.length === 0, 'a rejected append must persist nothing');
      },
    },
    {
      name: 'append with the correct expectedVersion after existing events succeeds and continues the stream',
      run: async (store) => {
        assert((await store.append('agg-1' as EntityId, 0, [makeEvent('agg-1', 1, 1)])).ok, 'seed');
        const second = await store.append('agg-1' as EntityId, 1, [makeEvent('agg-1', 2, 2)]);
        assert(second.ok, 'append with the matching expectedVersion should succeed');
        const events = await store.readStream('agg-1' as EntityId);
        assert(events.length === 2, `expected 2 events, got ${events.length}`);
      },
    },
    {
      name: 'append with a stale expectedVersion on an existing stream fails with Conflict and persists nothing',
      run: async (store) => {
        assert((await store.append('agg-1' as EntityId, 0, [makeEvent('agg-1', 1, 1)])).ok, 'seed');
        // Current version is now 1; a concurrent writer still thinks it is 0.
        const stale = await store.append('agg-1' as EntityId, 0, [makeEvent('agg-1', 2, 99)]);
        assertConflict(stale, 'stale expectedVersion on an existing stream');
        const events = await store.readStream('agg-1' as EntityId);
        assert(events.length === 1, 'the rejected second append must not persist');
      },
    },
    {
      name: 're-appending the identical event (same id + content) is an idempotent no-op, not Conflict (#151)',
      run: async (store) => {
        const event = makeEvent('agg-1', 1, 1);
        assert((await store.append('agg-1' as EntityId, 0, [event])).ok, 'seed');
        // Re-deliver the exact same event. The stream is already at version 1, so a naive optimistic check
        // (expectedVersion 0 ≠ current 1) would return Conflict — but a re-delivered event must be an
        // idempotent SUCCESS (ADR 0005 §3), and must not double-persist.
        const redelivered = await store.append('agg-1' as EntityId, 0, [event]);
        assert(
          redelivered.ok,
          're-delivering an identical event must succeed (idempotent), not Conflict',
        );
        const events = await store.readStream('agg-1' as EntityId);
        assert(
          events.length === 1,
          `re-delivery must not duplicate — expected 1 event, got ${events.length}`,
        );
      },
    },
    {
      name: 'appending an existing id with DIFFERENT content is corruption — throws, distinct from Conflict (#151)',
      run: async (store) => {
        const original = makeEvent('agg-1', 1, 1);
        assert((await store.append('agg-1' as EntityId, 0, [original])).ok, 'seed');
        // Same id, different body → a data-integrity violation (an id must immutably identify one event).
        const tampered: EventEnvelope = { ...original, payload: { version: 1, seq: 999 } };
        let threw: unknown;
        try {
          await store.append('agg-1' as EntityId, 1, [tampered]);
        } catch (error) {
          threw = error;
        }
        assert(
          threw !== undefined,
          'same id + different content must throw (corruption), not return a Result',
        );
        assert(
          (threw as { code?: string }).code === EVENT_ID_MISMATCH_CODE,
          `expected code '${EVENT_ID_MISMATCH_CODE}', got '${(threw as { code?: string }).code}'`,
        );
        // The corrupt append must persist nothing — the original stays, unchanged.
        const events = await store.readStream('agg-1' as EntityId);
        assert(events.length === 1, 'a rejected corrupt append must not persist');
        assert(
          JSON.stringify(events[0]?.payload) === JSON.stringify(original.payload),
          'the original event body must be untouched',
        );
      },
    },
    {
      name: 'readStream fromVersion is EXCLUSIVE (returns strictly version > fromVersion)',
      run: async (store) => {
        assert(
          (
            await store.append('agg-1' as EntityId, 0, [
              makeEvent('agg-1', 1, 1),
              makeEvent('agg-1', 2, 2),
              makeEvent('agg-1', 3, 3),
            ])
          ).ok,
          'seed',
        );
        const after1 = await store.readStream('agg-1' as EntityId, 1);
        assert(
          after1.length === 2 && after1[0]?.version === 2,
          'readStream(…, 1) must EXCLUDE version 1 (double-apply bug if inclusive)',
        );
        const afterAll = await store.readStream('agg-1' as EntityId, 3);
        assert(afterAll.length === 0, 'readStream past the last version returns nothing');
      },
    },
    {
      name: 'readStream isolates by stream (never returns another aggregate’s events)',
      run: async (store) => {
        assert((await store.append('agg-1' as EntityId, 0, [makeEvent('agg-1', 1, 1)])).ok, 'a');
        assert((await store.append('agg-2' as EntityId, 0, [makeEvent('agg-2', 1, 2)])).ok, 'b');
        const one = await store.readStream('agg-1' as EntityId);
        assert(
          one.length === 1 && one[0]?.aggregateId === ('agg-1' as EntityId),
          'readStream must only return the requested stream',
        );
      },
    },
    {
      name: 'readAll returns events across streams in position order; fromPosition is EXCLUSIVE',
      run: async (store) => {
        assert((await store.append('agg-1' as EntityId, 0, [makeEvent('agg-1', 1, 1)])).ok, 'a');
        assert((await store.append('agg-2' as EntityId, 0, [makeEvent('agg-2', 1, 2)])).ok, 'b');
        assert((await store.append('agg-1' as EntityId, 1, [makeEvent('agg-1', 2, 3)])).ok, 'c');

        const all = await store.readAll();
        assert(all.length === 3, `expected 3 events across streams, got ${all.length}`);
        for (let i = 1; i < all.length; i++) {
          assert(
            (all[i]?.position ?? 0) > (all[i - 1]?.position ?? 0),
            'readAll must be strictly ascending by position',
          );
        }
        const afterFirst = await store.readAll(all[0]?.position);
        assert(
          afterFirst.length === 2,
          'readAll(fromPosition) must EXCLUDE the event at fromPosition (double-process bug if inclusive)',
        );
      },
    },
  ];
}
