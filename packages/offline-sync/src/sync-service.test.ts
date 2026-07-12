/**
 * Tests for the push orchestration ({@link createSyncService}) against the in-memory event store + sync
 * port fakes (ADR 0017 R1). They pin the slice-3a behaviour the live client-smoke verifies against real
 * Postgres: push the events after the checkpoint, advance the checkpoint over the confirmed prefix, stay
 * idempotent on re-run, and — the Option-A safety property — **park** at a `conflict` without dropping it
 * or marking anything past it as synced (full rebase deferred to #176).
 */

import { describe, expect, test } from 'bun:test';
import { appError } from '@grimora/core-domain';
import { createInMemoryEventStore, createInMemorySyncPort } from '@grimora/core-domain/testing';
import { type EntityId, type EventEnvelope, err, type IsoTimestamp } from '@grimora/shared-types';
import { createSyncService, type SyncCheckpointStore } from './sync-service';

/** A minimal in-memory checkpoint store (what the OPFS read store provides in production). */
function fakeCheckpoints(): SyncCheckpointStore {
  const cursors = new Map<string, number>();
  return {
    async getCheckpoint(cursor) {
      return cursors.get(cursor) ?? 0;
    },
    async setCheckpoint(cursor, position) {
      cursors.set(cursor, position);
    },
  };
}

/** Build an event envelope for stream `agg` at `version` — obvious fakes, no real data (agent guardrails). */
function event(agg: string, version: number, id: string): EventEnvelope {
  return {
    id: id as EntityId,
    aggregateId: agg as EntityId,
    aggregateType: 'character',
    type: 'character.attributeRaised',
    version,
    schemaVersion: 1,
    occurredAt: '2026-07-12T00:00:00.000Z' as IsoTimestamp,
    payload: { attributeId: 'COU', value: version + 10 },
  };
}

describe('createSyncService.pushPending', () => {
  test('pushes events after the checkpoint and advances it over the accepted run', async () => {
    const events = createInMemoryEventStore();
    await events.append('char-1' as EntityId, 0, [event('char-1', 1, 'e1')]);
    await events.append('char-1' as EntityId, 1, [event('char-1', 2, 'e2')]);
    const service = createSyncService({
      syncPort: createInMemorySyncPort(),
      events,
      checkpoints: fakeCheckpoints(),
    });

    const result = await service.pushPending();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.accepted).toBe(2);
    expect(result.value.conflicts).toBe(0);
    // The checkpoint is the local `position` of the last confirmed event (2 events → position 2).
    expect(result.value.checkpoint).toBe(2);
  });

  test('is idempotent: a second run finds nothing new and leaves the checkpoint put', async () => {
    const events = createInMemoryEventStore();
    await events.append('char-1' as EntityId, 0, [event('char-1', 1, 'e1')]);
    const checkpoints = fakeCheckpoints();
    const service = createSyncService({
      syncPort: createInMemorySyncPort(),
      events,
      checkpoints,
    });

    await service.pushPending();
    const second = await service.pushPending();
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.accepted).toBe(0);
    expect(second.value.duplicates).toBe(0); // nothing re-sent — the checkpoint already covers e1
    expect(second.value.checkpoint).toBe(1);
  });

  test('parks at a conflict: it is counted, not dropped, and the checkpoint does not pass it (Option A / #176)', async () => {
    const cloud = createInMemorySyncPort();
    // A "foreign writer" already advanced char-1 to version 1 in the cloud, so the local char-1 v1 (a
    // different id) will conflict. char-2 v1 is clean.
    await cloud.push([event('char-1', 1, 'foreign')]);

    const events = createInMemoryEventStore();
    await events.append('char-1' as EntityId, 0, [event('char-1', 1, 'local-c1')]); // position 1 → conflict
    await events.append('char-2' as EntityId, 0, [event('char-2', 1, 'local-c2')]); // position 2 → accepted
    const checkpoints = fakeCheckpoints();
    const service = createSyncService({ syncPort: cloud, events, checkpoints });

    const result = await service.pushPending();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.conflicts).toBe(1);
    // The checkpoint must NOT advance past the conflict (position 1), even though the later char-2 event
    // was accepted — parking everything from the conflict onward so nothing is silently marked synced.
    expect(result.value.checkpoint).toBe(0);
    // Re-running still sees both events as pending (the checkpoint never moved), so no data is lost.
    expect(await checkpoints.getCheckpoint('sync:push')).toBe(0);
  });

  test('propagates a transport failure and leaves the checkpoint untouched', async () => {
    const events = createInMemoryEventStore();
    await events.append('char-1' as EntityId, 0, [event('char-1', 1, 'e1')]);
    const checkpoints = fakeCheckpoints();
    const service = createSyncService({
      // A sync port whose whole request fails (offline) — distinct from a per-event conflict.
      syncPort: {
        async push() {
          return err(appError('sync.upstream_unreachable', 'Infrastructure'));
        },
        async pull() {
          return err(appError('sync.upstream_unreachable', 'Infrastructure'));
        },
      },
      events,
      checkpoints,
    });

    const result = await service.pushPending();
    expect(result.ok).toBe(false);
    expect(await checkpoints.getCheckpoint('sync:push')).toBe(0);
  });
});
