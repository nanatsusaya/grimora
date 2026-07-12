/**
 * Tests for the HTTP `SyncPort` adapter ({@link createHttpSyncPort}) against a fake `fetch` (ADR 0017 — no
 * real network). They pin the wire contract the live client-smoke exercises against `apps/api`: the Bearer
 * token is attached per request (and omitted when signed out), an empty push short-circuits, and the
 * `401`/transport cases map to the right `AppError` category so the orchestrator can react.
 */

import { describe, expect, test } from 'bun:test';
import type { EntityId, EventEnvelope, IsoTimestamp } from '@grimora/shared-types';
import { createHttpSyncPort } from './http-sync-port';

/** A recording fake `fetch` returning a canned response; captures the last request for assertions. */
function fakeFetch(response: {
  status?: number;
  body?: unknown;
  throws?: boolean;
  jsonThrows?: boolean;
}) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    if (response.throws) throw new Error('network down');
    return {
      ok: (response.status ?? 200) >= 200 && (response.status ?? 200) < 300,
      status: response.status ?? 200,
      // `jsonThrows` models a 200 whose body is not valid JSON (e.g. a proxy's HTML error page).
      json: async () => {
        if (response.jsonThrows) throw new SyntaxError('Unexpected token < in JSON');
        return response.body;
      },
    } as Response;
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const sampleEvent: EventEnvelope = {
  id: 'e1' as EntityId,
  aggregateId: 'char-1' as EntityId,
  aggregateType: 'character',
  type: 'character.attributeRaised',
  version: 1,
  schemaVersion: 1,
  occurredAt: '2026-07-12T00:00:00.000Z' as IsoTimestamp,
  payload: { attributeId: 'COU', value: 11 },
};

describe('createHttpSyncPort.push', () => {
  test('sends the batch with a Bearer token and returns the per-event results', async () => {
    const { fn, calls } = fakeFetch({
      body: { results: [{ id: 'e1', status: 'accepted', position: 7 }] },
    });
    const port = createHttpSyncPort({ getAccessToken: () => 'tok-123', fetch: fn });

    const result = await port.push([sampleEvent]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]).toEqual({ id: 'e1' as EntityId, status: 'accepted', position: 7 });
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer tok-123');
    expect(calls[0]?.url).toContain('/api/v1/sync/push');
  });

  test('omits the Authorization header when signed out', async () => {
    const { fn, calls } = fakeFetch({ body: { results: [] } });
    const port = createHttpSyncPort({ getAccessToken: () => undefined, fetch: fn });
    await port.push([sampleEvent]);
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers.authorization).toBeUndefined();
  });

  test('short-circuits an empty batch without a network call', async () => {
    const { fn, calls } = fakeFetch({ body: { results: [] } });
    const port = createHttpSyncPort({ getAccessToken: () => 'tok', fetch: fn });
    const result = await port.push([]);
    expect(result.ok).toBe(true);
    expect(calls.length).toBe(0);
  });

  test('maps a 401 to an Unauthorized error', async () => {
    const { fn } = fakeFetch({ status: 401, body: {} });
    const port = createHttpSyncPort({ getAccessToken: () => 'tok', fetch: fn });
    const result = await port.push([sampleEvent]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.category).toBe('Unauthorized');
  });

  test('maps a transport failure to an Infrastructure error', async () => {
    const { fn } = fakeFetch({ throws: true });
    const port = createHttpSyncPort({ getAccessToken: () => 'tok', fetch: fn });
    const result = await port.push([sampleEvent]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.category).toBe('Infrastructure');
  });

  test('a 200 with invalid JSON becomes an Infrastructure error, not a thrown exception (F-09)', async () => {
    const { fn } = fakeFetch({ status: 200, jsonThrows: true });
    const port = createHttpSyncPort({ getAccessToken: () => 'tok', fetch: fn });
    // Must resolve to an err Result, never reject — the old `(await res.json()) as T` let the parse throw.
    const result = await port.push([sampleEvent]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.category).toBe('Infrastructure');
    expect(result.error.code).toBe('sync.malformed_response');
  });

  test('a 200 whose body has the wrong shape becomes an Infrastructure error (F-09)', async () => {
    const { fn } = fakeFetch({ status: 200, body: { results: 'not-an-array' } });
    const port = createHttpSyncPort({ getAccessToken: () => 'tok', fetch: fn });
    const result = await port.push([sampleEvent]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('sync.malformed_response');
  });

  test('recovers from a 401 by refreshing once and retrying with the new token (M-2)', async () => {
    let token = 'expired';
    let calls = 0;
    const fetchFn = (async () => {
      calls += 1;
      if (calls === 1) return { ok: false, status: 401, json: async () => ({}) } as Response;
      return {
        ok: true,
        status: 200,
        json: async () => ({ results: [{ id: 'e1', status: 'accepted', position: 7 }] }),
      } as Response;
    }) as unknown as typeof fetch;
    const port = createHttpSyncPort({
      getAccessToken: () => token,
      fetch: fetchFn,
      onUnauthorized: async () => {
        token = 'fresh'; // a successful refresh installs a new access token
        return true;
      },
    });

    const result = await port.push([sampleEvent]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]?.status).toBe('accepted');
    expect(calls).toBe(2); // the request was retried once after the refresh
  });

  test('a 401 whose refresh fails still maps to Unauthorized — no infinite retry (M-2)', async () => {
    const { fn, calls } = fakeFetch({ status: 401, body: {} });
    const port = createHttpSyncPort({
      getAccessToken: () => 'tok',
      fetch: fn,
      onUnauthorized: async () => false, // refresh could not re-establish a session
    });
    const result = await port.push([sampleEvent]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.category).toBe('Unauthorized');
    expect(calls.length).toBe(1); // not retried when the refresh failed
  });
});

describe('createHttpSyncPort.pull', () => {
  test('requests events after the checkpoint and returns the page', async () => {
    const { fn, calls } = fakeFetch({
      body: { events: [{ ...sampleEvent, position: 3 }], checkpoint: 3 },
    });
    const port = createHttpSyncPort({ getAccessToken: () => 'tok', fetch: fn });

    const result = await port.pull(2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.checkpoint).toBe(3);
    expect(result.value.events).toHaveLength(1);
    expect(calls[0]?.url).toContain('since=2');
  });

  test('maps a 401 to an Unauthorized error', async () => {
    const { fn } = fakeFetch({ status: 401, body: {} });
    const port = createHttpSyncPort({ getAccessToken: () => undefined, fetch: fn });
    const result = await port.pull(0);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.category).toBe('Unauthorized');
  });

  test('a 200 with a malformed event in the page becomes an Infrastructure error, not a bad apply (F-09)', async () => {
    // `events[0]` is missing required fields (only an id) — it must be rejected before it can reach the
    // local replicate, not cast through as a PersistedEvent.
    const { fn } = fakeFetch({ status: 200, body: { events: [{ id: 'x' }], checkpoint: 3 } });
    const port = createHttpSyncPort({ getAccessToken: () => 'tok', fetch: fn });
    const result = await port.pull(0);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('sync.malformed_response');
  });

  test('a 200 with a negative checkpoint is rejected (F-09)', async () => {
    const { fn } = fakeFetch({ status: 200, body: { events: [], checkpoint: -1 } });
    const port = createHttpSyncPort({ getAccessToken: () => 'tok', fetch: fn });
    const result = await port.pull(0);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('sync.malformed_response');
  });
});
