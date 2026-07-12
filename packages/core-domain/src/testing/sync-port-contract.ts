/**
 * A **transport-engine-agnostic contract test suite** for `SyncPort` (ADR 0005 §3/§4, ADR 0011 §7, and
 * ADR 0017 port-contract tests). It exists so the in-memory fake (`createInMemorySyncPort`) and every real
 * adapter (the custom HTTP-over-`apps/api` engine, PowerSync/Electric later) can be proven **behaviourally
 * equivalent** against one shared spec — the whole point of the `SyncPort` swap boundary (ADR 0005 §8).
 *
 * Like `event-store-contract.ts`, it is deliberately **free of any test framework** (`bun:test` is never
 * imported here): this module is compiled into the published `@grimora/core-domain/testing` subpath, so
 * pulling a runner into shipped source is undesirable, and staying framework-agnostic lets any runner drive
 * it. Each case is a `{ name, run }` pair; the consuming `*.test.ts` creates one **fresh, empty** sync port
 * per case and passes it to `run`. A failing assertion throws — the runner reports it as that named test.
 */

import type { EntityId, EventEnvelope, IsoTimestamp } from '@grimora/shared-types';
import type { SyncPort, SyncPushResult } from '../application/ports';

/**
 * One named contract case over an already-constructed, empty sync port. `run` throws on a contract
 * violation (via the local {@link assert}).
 */
export interface SyncPortContractCase {
  /** Human-readable behaviour under test, used as the registered test's name. */
  readonly name: string;
  /** Exercise the behaviour against a fresh `sync`; throws if the contract breaks. */
  readonly run: (sync: SyncPort) => Promise<void>;
}

/**
 * Minimal assertion helper — kept local so this module needs no `node:assert` (core-domain has no
 * `@types/node`) and no test framework. Throws an `Error` the runner surfaces as a failure.
 * @param condition  the invariant that must hold
 * @param message    what was expected, shown when it does not
 */
function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`SyncPort contract violated: ${message}`);
}

/**
 * Build a minimal valid {@link EventEnvelope} for the contract. Only the fields the sync protocol reasons
 * about (`id`, `aggregateId`, `version`) are meaningful; the concrete `type`/`payload` are irrelevant to
 * replication (sync is rule-agnostic), so a synthetic type is used.
 * @param aggregateId  the stream the event belongs to
 * @param version      the 1-based per-aggregate version (assigned by the use-case, not the sync port)
 * @param seq          a per-test sequence that keeps each event `id` globally unique
 * @returns            a fully-formed envelope ready to push
 */
function makeEvent(aggregateId: string, version: number, seq: number): EventEnvelope {
  return {
    id: `evt-${aggregateId}-${version}-${seq}` as EntityId,
    aggregateId: aggregateId as EntityId,
    aggregateType: 'test-aggregate',
    type: 'test.happened',
    version,
    schemaVersion: 1,
    occurredAt: '2026-07-12T00:00:00.000Z' as IsoTimestamp,
    payload: { version, seq },
  };
}

/**
 * Find the push result for a given event `id`, asserting exactly one exists.
 * @param results  the per-event results returned by `push`
 * @param id       the event id to look up
 * @param label    context for the failure message
 * @returns        the single {@link SyncPushResult} for that id
 */
function resultFor(results: readonly SyncPushResult[], id: string, label: string): SyncPushResult {
  const matches = results.filter((r) => r.id === (id as EntityId));
  assert(
    matches.length === 1,
    `${label}: expected exactly one result for ${id}, got ${matches.length}`,
  );
  return matches[0] as SyncPushResult;
}

/** Unwrap an ok `Result`, asserting it is not an error. */
function unwrap<T>(result: { readonly ok: boolean; readonly value?: T }, label: string): T {
  assert(result.ok, `${label}: expected ok, got an error`);
  return result.value as T;
}

/**
 * The full contract as an ordered list of cases. Covers: happy-path ingest with ascending positions,
 * idempotent dedup-by-`id`, per-aggregate version conflict reporting, per-event partial success on a mixed
 * batch, the **exclusive** `pull(sincePosition)` lower bound + returned checkpoint, and stream-scoped pull
 * that still advances the checkpoint past the head (no re-request gap).
 * @returns the ordered contract cases to register with a test runner
 */
export function syncPortContract(): readonly SyncPortContractCase[] {
  return [
    {
      name: 'push to an empty cloud accepts every event and assigns strictly ascending positions',
      run: async (sync) => {
        const results = unwrap(
          await sync.push([makeEvent('agg-1', 1, 1), makeEvent('agg-1', 2, 2)]),
          'push two new events',
        );
        const first = resultFor(results, 'evt-agg-1-1-1', 'first');
        const second = resultFor(results, 'evt-agg-1-2-2', 'second');
        assert(
          first.status === 'accepted' && second.status === 'accepted',
          'both must be accepted',
        );
        assert(
          first.status === 'accepted' &&
            second.status === 'accepted' &&
            second.position > first.position,
          'positions must be strictly ascending in ingest order',
        );
      },
    },
    {
      name: 'pushing the same ids again is an idempotent no-op (all duplicate, nothing re-ingested)',
      run: async (sync) => {
        const events = [makeEvent('agg-1', 1, 1), makeEvent('agg-1', 2, 2)];
        await sync.push(events);
        const replay = unwrap(await sync.push(events), 're-push the same events');
        assert(
          replay.every((r) => r.status === 'duplicate'),
          'a replay of already-accepted ids must all be duplicate',
        );
        // Prove nothing was re-ingested: the full pull still returns exactly the two originals.
        const page = unwrap(await sync.pull(0), 'pull after replay');
        assert(
          page.events.length === 2,
          `expected 2 events after replay, got ${page.events.length}`,
        );
      },
    },
    {
      name: 'a stale or gapped per-aggregate version is reported as conflict with the current version',
      run: async (sync) => {
        await sync.push([makeEvent('agg-1', 1, 1)]); // cloud now at version 1
        // A concurrent writer still thinks the stream is at 0 → re-submits version 1 with a new id.
        const stale = unwrap(await sync.push([makeEvent('agg-1', 1, 2)]), 'stale version');
        const staleResult = resultFor(stale, 'evt-agg-1-1-2', 'stale');
        assert(staleResult.status === 'conflict', 'a re-used version must conflict');
        assert(
          staleResult.status === 'conflict' && staleResult.currentVersion === 1,
          'conflict must report the current version (1) so the client can rebase',
        );
        // A gapped version (skipping 2) is equally a conflict — ingest must stay contiguous.
        const gapped = unwrap(await sync.push([makeEvent('agg-1', 3, 3)]), 'gapped version');
        assert(
          resultFor(gapped, 'evt-agg-1-3-3', 'gapped').status === 'conflict',
          'a gapped version must conflict too (no non-contiguous ingest)',
        );
        // Neither rejected event was ingested.
        const page = unwrap(await sync.pull(0), 'pull after conflicts');
        assert(page.events.length === 1, 'rejected events must not be ingested');
      },
    },
    {
      name: 'a mixed batch resolves per-event (accepted / duplicate / conflict) — not all-or-nothing',
      run: async (sync) => {
        await sync.push([makeEvent('agg-1', 1, 1)]); // seed: agg-1 at version 1
        const mixed = unwrap(
          await sync.push([
            makeEvent('agg-1', 1, 1), // duplicate (same id as the seed)
            makeEvent('agg-1', 1, 9), // conflict (version 1 re-used, different id)
            makeEvent('agg-2', 1, 2), // accepted (new stream)
            makeEvent('agg-1', 2, 3), // accepted (continues agg-1)
          ]),
          'mixed batch',
        );
        assert(
          resultFor(mixed, 'evt-agg-1-1-1', 'dup').status === 'duplicate',
          'seed id → duplicate',
        );
        assert(
          resultFor(mixed, 'evt-agg-1-1-9', 'conf').status === 'conflict',
          're-used version → conflict',
        );
        assert(
          resultFor(mixed, 'evt-agg-2-1-2', 'new').status === 'accepted',
          'new stream → accepted',
        );
        assert(
          resultFor(mixed, 'evt-agg-1-2-3', 'cont').status === 'accepted',
          'contiguous next → accepted',
        );
      },
    },
    {
      name: 'pull(sincePosition) is EXCLUSIVE and returns a checkpoint the next pull starts after',
      run: async (sync) => {
        await sync.push([
          makeEvent('agg-1', 1, 1),
          makeEvent('agg-1', 2, 2),
          makeEvent('agg-1', 3, 3),
        ]);
        const first = unwrap(await sync.pull(0), 'pull from 0');
        assert(
          first.events.length === 3,
          `expected 3 events from position 0, got ${first.events.length}`,
        );
        assert(
          first.checkpoint === (first.events[2]?.position ?? -1),
          'the checkpoint must equal the last returned position',
        );
        const next = unwrap(await sync.pull(first.checkpoint), 'pull from the checkpoint');
        assert(next.events.length === 0, 'pull(checkpoint) must EXCLUDE everything already pulled');
        assert(
          next.checkpoint === first.checkpoint,
          'an empty pull must not move the checkpoint backwards',
        );
      },
    },
    {
      name: 'pull(…, streams) returns only the requested streams but still advances past the head',
      run: async (sync) => {
        await sync.push([makeEvent('agg-A', 1, 1), makeEvent('agg-B', 1, 2)]); // positions 1, 2
        const page = unwrap(await sync.pull(0, ['agg-A' as EntityId]), 'stream-scoped pull');
        assert(
          page.events.length === 1 && page.events[0]?.aggregateId === ('agg-A' as EntityId),
          'a stream-scoped pull must return only the requested stream',
        );
        assert(
          page.checkpoint === 2,
          'the checkpoint must advance past the filtered-out event (2), so no gap is re-requested',
        );
      },
    },
  ];
}
