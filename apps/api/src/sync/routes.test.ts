/**
 * Tests for the sync routes (#107), driven in-process against a **fake** {@link SyncStore} +
 * {@link TokenVerifier}. They pin the HTTP contract the live push/pull smoke verifies against real
 * Postgres: both routes require a valid bearer token (else `401`), and — the security-critical part —
 * the store is always called with the **verified account id** as owner, never a client-supplied value
 * (actor-binding, ADR 0024 §2).
 */

import { describe, expect, test } from 'bun:test';
import { ok } from '@grimora/shared-types';
import { createApp } from '../app';
import type { TokenVerifier } from '../auth/jwt';
import { testComposition } from '../test-support';
import type { SyncStore } from './pg-sync-store';

/** A verifier that accepts any token as account `acc-1`. */
const acceptVerifier: TokenVerifier = { verify: async () => ok({ accountId: 'acc-1' }) };

/** A sync store that records how it was called and echoes the events back as accepted. */
function recordingStore() {
  const calls: { ownerId?: string; sincePosition?: number; eventCount?: number } = {};
  const store: SyncStore = {
    async push(ownerId, events) {
      calls.ownerId = ownerId;
      calls.eventCount = events.length;
      return events.map((e) => ({ id: e.id, status: 'accepted' as const, position: 1 }));
    },
    async pull(ownerId, sincePosition) {
      calls.ownerId = ownerId;
      calls.sincePosition = sincePosition;
      return { events: [], checkpoint: sincePosition };
    },
    async close() {
      return undefined;
    },
  };
  return { store, calls };
}

const sampleEvent = {
  id: 'e1',
  aggregateId: 'a1',
  aggregateType: 'character',
  type: 'character.attributeSet',
  version: 1,
  schemaVersion: 1,
  occurredAt: '2026-07-12T00:00:00.000Z',
  payload: { attributeId: 'COU', value: 12 },
};

describe('sync routes', () => {
  test('POST /sync/push without a token → 401', async () => {
    const app = createApp(testComposition()); // default verifier rejects
    const res = await app.request('/api/v1/sync/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ events: [] }),
    });
    expect(res.status).toBe(401);
  });

  test('POST /sync/push with a valid token ingests as the verified account (actor-binding)', async () => {
    const { store, calls } = recordingStore();
    const app = createApp(testComposition({ tokenVerifier: acceptVerifier, syncStore: store }));
    const res = await app.request('/api/v1/sync/push', {
      method: 'POST',
      headers: { authorization: 'Bearer tok', 'content-type': 'application/json' },
      body: JSON.stringify({ events: [sampleEvent] }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { results: { status: string }[] };
    expect(body.results[0]?.status).toBe('accepted');
    // The owner is the verified account id — the route never trusts a client-supplied owner.
    expect(calls.ownerId).toBe('acc-1');
    expect(calls.eventCount).toBe(1);
  });

  test('GET /sync/pull without a token → 401', async () => {
    const app = createApp(testComposition());
    const res = await app.request('/api/v1/sync/pull?since=0');
    expect(res.status).toBe(401);
  });

  test('GET /sync/pull with a valid token pulls the account’s events after `since`', async () => {
    const { store, calls } = recordingStore();
    const app = createApp(testComposition({ tokenVerifier: acceptVerifier, syncStore: store }));
    const res = await app.request('/api/v1/sync/pull?since=5', {
      headers: { authorization: 'Bearer tok' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { checkpoint: number };
    expect(body.checkpoint).toBe(5);
    expect(calls.ownerId).toBe('acc-1');
    expect(calls.sincePosition).toBe(5);
  });
});
