/**
 * Proves the SQLite adapter (a) satisfies the shared `EventStorePort` contract — the same cases the
 * in-memory fake passes, so the two are behaviourally interchangeable (ADR 0017 port-contract tests) —
 * and (b) meets the adapter-specific guarantees this ticket (#103) adds over the fake: a real
 * storage-level `UNIQUE(aggregate_id, version)` constraint, UNIQUE→Conflict mapping, and durability
 * across a close/reopen.
 */

import { Database } from 'bun:sqlite';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eventStoreContract } from '@grimora/core-domain/testing';
import type { EntityId, EventEnvelope, IsoTimestamp } from '@grimora/shared-types';
import { createSqliteEventStore } from './index';

/** Build a minimal valid envelope (mirrors the contract's helper; local to keep the test self-contained). */
function event(aggregateId: string, version: number, id: string): EventEnvelope {
  return {
    id: id as EntityId,
    aggregateId: aggregateId as EntityId,
    aggregateType: 'test-aggregate',
    type: 'test.happened',
    version,
    schemaVersion: 1,
    occurredAt: '2026-07-10T00:00:00.000Z' as IsoTimestamp,
    payload: { version },
  };
}

describe('EventStorePort contract — SQLite adapter (in-memory)', () => {
  for (const contractCase of eventStoreContract()) {
    test(contractCase.name, async () => {
      const store = createSqliteEventStore();
      try {
        await contractCase.run(store);
      } finally {
        store.close();
      }
    });
  }
});

describe('SQLite adapter — storage-level guarantees (#103)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'grimora-event-store-schema-'));
  const file = join(dir, 'events.sqlite');

  beforeAll(() => {
    // Create the table on disk, then close so a raw handle can inspect the persisted schema.
    const store = createSqliteEventStore({ filename: file });
    store.close();
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  test('the events table declares a real UNIQUE(aggregate_id, version) constraint in the persisted schema', () => {
    // Read the recorded DDL straight from sqlite_master with an independent handle — this asserts the
    // constraint exists at the storage layer, not merely in the adapter's append() code (the AC is
    // explicitly "a real unique constraint, not just an application-level check").
    const raw = new Database(file, { readonly: true });
    try {
      const row = raw
        .query("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'events'")
        .get() as { sql: string } | undefined;
      expect(row?.sql).toContain('UNIQUE (aggregate_id, version)');
      // The event-id uniqueness is asserted whitespace-insensitively (and exercised behaviourally by
      // the duplicate-id test below), so this doesn't couple to the DDL's exact column formatting.
      expect(row?.sql?.replace(/\s+/g, ' ')).toContain('id TEXT NOT NULL UNIQUE');
    } finally {
      raw.close();
    }
  });

  test('a duplicate event id with DIFFERENT content throws corruption, not Conflict (#151)', async () => {
    const store = createSqliteEventStore();
    try {
      const seed = await store.append('agg-1' as EntityId, 0, [event('agg-1', 1, 'dup-id')]);
      expect(seed.ok).toBe(true);
      // Reusing id 'dup-id' with a different body (version 2, payload {version:2}) is a data-integrity
      // violation, not an optimistic-concurrency conflict: the adapter throws the distinct corruption error
      // (idempotent identical re-delivery + the version-collision Conflict are covered by the shared contract).
      await expect(
        store.append('agg-1' as EntityId, 1, [event('agg-1', 2, 'dup-id')]),
      ).rejects.toThrow(/already stored with different content/);
      // The rejected batch must not have persisted — the original stays.
      const events = await store.readStream('agg-1' as EntityId);
      expect(events.length).toBe(1);
      expect(events[0]?.version).toBe(1);
    } finally {
      store.close();
    }
  });

  test('duplicate (aggregate_id, version) is rejected (per-aggregate version uniqueness)', async () => {
    const store = createSqliteEventStore();
    try {
      await store.append('agg-1' as EntityId, 0, [event('agg-1', 1, 'id-a')]);
      // A stale writer that still thinks the stream is empty tries to write version 1 again with a
      // different id: the app-level check catches it first, but either way it must be a Conflict and
      // must not create a second version-1 row.
      const clash = await store.append('agg-1' as EntityId, 0, [event('agg-1', 1, 'id-b')]);
      expect(clash.ok).toBe(false);
      const events = await store.readStream('agg-1' as EntityId);
      expect(events.length).toBe(1);
      expect(events[0]?.id).toBe('id-a' as EntityId);
    } finally {
      store.close();
    }
  });
});

describe('SQLite adapter — replicate (sync pull apply, #107 slice 3b)', () => {
  /** A cloud-shaped persisted event (envelope + a cloud position, which the local store reassigns). */
  function persisted(aggregateId: string, version: number, id: string, cloudPosition: number) {
    return { ...event(aggregateId, version, id), position: cloudPosition };
  }

  test('applies pulled events into the local log, assigning fresh local positions', async () => {
    const store = createSqliteEventStore();
    try {
      await store.replicate([persisted('agg-1', 1, 'e1', 41), persisted('agg-1', 2, 'e2', 42)]);
      const all = await store.readAll();
      expect(all.map((e) => e.id)).toEqual(['e1' as EntityId, 'e2' as EntityId]);
      // Local positions are store-local (AUTOINCREMENT), not the cloud positions 41/42.
      expect(all[0]?.position).toBe(1);
      expect(all[1]?.position).toBe(2);
      // The cloud version is preserved.
      expect(all.map((e) => e.version)).toEqual([1, 2]);
    } finally {
      store.close();
    }
  });

  test('is idempotent by id — re-applying the same page does not duplicate', async () => {
    const store = createSqliteEventStore();
    try {
      await store.replicate([persisted('agg-1', 1, 'e1', 41)]);
      await store.replicate([persisted('agg-1', 1, 'e1', 41)]); // re-pull of the same event
      const all = await store.readAll();
      expect(all.length).toBe(1);
    } finally {
      store.close();
    }
  });

  test('replicated events coexist with locally-appended ones and read back in position order', async () => {
    const store = createSqliteEventStore();
    try {
      await store.append('agg-local' as EntityId, 0, [event('agg-local', 1, 'local-1')]);
      await store.replicate([persisted('agg-remote', 1, 'remote-1', 99)]);
      const all = await store.readAll();
      expect(all.map((e) => e.id)).toEqual(['local-1' as EntityId, 'remote-1' as EntityId]);
    } finally {
      store.close();
    }
  });

  test('a re-pull with the same id but DIFFERENT content throws — corruption, not a silent duplicate (F-04, #186)', async () => {
    const store = createSqliteEventStore();
    try {
      await store.replicate([persisted('agg-1', 1, 'e1', 41)]);
      // Same id, different body — previously swallowed by `ON CONFLICT (id) DO NOTHING` as if idempotent.
      const tampered = { ...persisted('agg-1', 1, 'e1', 41), payload: { tampered: true } };
      await expect(store.replicate([tampered])).rejects.toThrow(/different content/);
      const all = await store.readAll();
      expect(all.length).toBe(1);
    } finally {
      store.close();
    }
  });

  test('a divergent (aggregate_id, version) from a different id throws (deferred to #176)', async () => {
    const store = createSqliteEventStore();
    try {
      await store.append('agg-1' as EntityId, 0, [event('agg-1', 1, 'id-a')]);
      // A different event claims the same (agg-1, version 1) — concurrent cross-device divergence.
      await expect(store.replicate([persisted('agg-1', 1, 'id-b', 7)])).rejects.toThrow(
        /divergent/,
      );
    } finally {
      store.close();
    }
  });
});

describe('SQLite adapter — durability', () => {
  const dir = mkdtempSync(join(tmpdir(), 'grimora-event-store-'));
  const file = join(dir, 'events.sqlite');

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  test('events survive a close/reopen of the same file, in position order', async () => {
    const first = createSqliteEventStore({ filename: file });
    await first.append('agg-1' as EntityId, 0, [event('agg-1', 1, 'p-1')]);
    await first.append('agg-2' as EntityId, 0, [event('agg-2', 1, 'p-2')]);
    first.close();

    expect(existsSync(file)).toBe(true);

    const reopened = createSqliteEventStore({ filename: file });
    try {
      const all = await reopened.readAll();
      expect(all.map((e) => e.id)).toEqual(['p-1' as EntityId, 'p-2' as EntityId]);
      // A new append continues the store-local position sequence past the persisted rows.
      await reopened.append('agg-1' as EntityId, 1, [event('agg-1', 2, 'p-3')]);
      const after = await reopened.readAll(all[all.length - 1]?.position);
      expect(after.map((e) => e.id)).toEqual(['p-3' as EntityId]);
    } finally {
      reopened.close();
    }
  });
});
