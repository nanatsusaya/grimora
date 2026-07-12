/**
 * `InMemoryEventStore.replicate` behaviour not covered by the shared `eventStoreContract` (ADR 0017 §1):
 * `replicate` is a sync-harness-only extension (not part of `EventStorePort` itself), so its own
 * invariants are tested directly here rather than via the cross-implementation contract suite.
 */

import { describe, expect, it } from 'bun:test';
import type { EntityId, EventEnvelope } from '@grimora/shared-types';
import { createInMemoryEventStore } from './fakes';

function event(overrides: Partial<EventEnvelope> = {}): EventEnvelope {
  return {
    id: 'e1' as EntityId,
    aggregateId: 'a1' as EntityId,
    aggregateType: 'character',
    type: 'character.created',
    version: 1,
    schemaVersion: 1,
    occurredAt: '2026-01-01T00:00:00.000Z' as EventEnvelope['occurredAt'],
    metadata: {},
    payload: {},
    ...overrides,
  };
}

describe('InMemoryEventStore.replicate', () => {
  it('is idempotent — re-replicating the same id is a no-op', async () => {
    const store = createInMemoryEventStore();
    await store.replicate([event()]);
    await store.replicate([event()]);
    expect(store.snapshotAll().length).toBe(1);
  });

  it('rejects a second event at the same (aggregateId, version) — per-aggregate version uniqueness (ADR 0004 §1/§2, ADR 0024 §3 C11 bound, #76)', async () => {
    const store = createInMemoryEventStore();
    await store.replicate([event({ id: 'e1' as EntityId })]);
    await expect(
      store.replicate([event({ id: 'e2' as EntityId })]), // different id, same (aggregateId, version)
    ).rejects.toThrow(/duplicate event/);
    expect(store.snapshotAll().length).toBe(1);
  });

  it('rejects the same id with DIFFERENT content — corruption, not an idempotent no-op (F-04, #186)', async () => {
    const store = createInMemoryEventStore();
    await store.replicate([event({ id: 'e1' as EntityId, payload: { v: 1 } })]);
    // Same id, different body: previously the id-dedup skipped it silently (a divergent event masquerading
    // as a duplicate). It must now surface as corruption, exactly like `append`'s #151 check.
    await expect(
      store.replicate([event({ id: 'e1' as EntityId, payload: { v: 2 } })]),
    ).rejects.toThrow(/different content/);
    expect(store.snapshotAll().length).toBe(1);
  });

  it('allows the same aggregate at a different version', async () => {
    const store = createInMemoryEventStore();
    await store.replicate([event({ id: 'e1' as EntityId, version: 1 })]);
    await store.replicate([event({ id: 'e2' as EntityId, version: 2 })]);
    expect(store.snapshotAll().length).toBe(2);
  });

  it('reset() clears the version-uniqueness tracking too, so a fresh sequence can reuse (aggregateId, version)', async () => {
    const store = createInMemoryEventStore();
    await store.replicate([event({ id: 'e1' as EntityId })]);
    store.reset();
    await store.replicate([event({ id: 'e1' as EntityId })]);
    expect(store.snapshotAll().length).toBe(1);
  });
});
