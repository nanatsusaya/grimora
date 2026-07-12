/**
 * Unit tests for the client-side {@link createHttpAuthPort} adapter (#120 E3), driven against a **fake
 * `fetch`** so they are deterministic and need no running `apps/api`/Supabase (ADR 0017). They pin the
 * client contract the live browser flow (E3b) then exercises for real: sign-in adopts the session, a 401
 * maps to `Unauthorized`, `restore()` re-establishes a session from the (server-sent) refresh cookie,
 * sign-out clears it, non-password methods are rejected, and subscribers are notified on every change.
 */

import { describe, expect, test } from 'bun:test';
import type { EntityId } from '@grimora/shared-types';
import { createHttpAuthPort } from './http-auth-port';

type Endpoint = 'sign-in' | 'refresh' | 'sign-out';

/** Build a fake `fetch` that answers each auth endpoint with a supplied `Response`. */
function fakeFetch(handlers: Partial<Record<Endpoint, () => Response>>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    const key = (['sign-in', 'refresh', 'sign-out'] as const).find((k) => url.endsWith(`/${k}`));
    const handler = key ? handlers[key] : undefined;
    return handler ? handler() : new Response(null, { status: 404 });
  }) as unknown as typeof fetch;
}

const session = (userId: string) =>
  new Response(JSON.stringify({ accessToken: 'at-1', expiresIn: 3600, userId }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
const status = (code: number) => () => new Response(null, { status: code });

describe('createHttpAuthPort', () => {
  test('signIn (password) adopts the session and notifies subscribers', async () => {
    const auth = createHttpAuthPort({ fetch: fakeFetch({ 'sign-in': () => session('u-1') }) });
    const seen: (EntityId | undefined)[] = [];
    auth.onSessionChange((s) => seen.push(s?.userId));

    const result = await auth.signIn({
      method: 'password',
      email: 'a@example.com',
      password: 'pw',
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.value.userId).toBe('u-1' as EntityId);
    expect(await auth.getSession()).toEqual({ userId: 'u-1' as EntityId });
    expect(seen).toEqual(['u-1' as EntityId]);
  });

  test('signIn maps a 401 to Unauthorized and leaves no session', async () => {
    const auth = createHttpAuthPort({ fetch: fakeFetch({ 'sign-in': status(401) }) });
    const result = await auth.signIn({
      method: 'password',
      email: 'a@example.com',
      password: 'bad',
    });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.category).toBe('Unauthorized');
    expect(await auth.getSession()).toBeUndefined();
  });

  test('signIn rejects a non-password method without any network call', async () => {
    // No handlers → any fetch would 404; a reached fetch would still not be Unauthorized, proving we
    // short-circuit before the network.
    const auth = createHttpAuthPort({ fetch: fakeFetch({}) });
    const result = await auth.signIn({ method: 'otp', email: 'a@example.com', token: '123456' });
    expect(!result.ok && result.error.category).toBe('Validation');
  });

  test('restore re-establishes a session from a valid refresh cookie', async () => {
    const auth = createHttpAuthPort({ fetch: fakeFetch({ refresh: () => session('u-1') }) });
    await auth.restore();
    expect(await auth.getSession()).toEqual({ userId: 'u-1' as EntityId });
  });

  test('restore is a no-op when there is no valid refresh cookie (401)', async () => {
    const auth = createHttpAuthPort({ fetch: fakeFetch({ refresh: status(401) }) });
    await auth.restore();
    expect(await auth.getSession()).toBeUndefined();
  });

  test('signOut clears the session and notifies (even if the network call fails)', async () => {
    const auth = createHttpAuthPort({
      fetch: fakeFetch({ 'sign-in': () => session('u-1'), 'sign-out': status(500) }),
    });
    await auth.signIn({ method: 'password', email: 'a@example.com', password: 'pw' });
    const seen: (EntityId | undefined)[] = [];
    auth.onSessionChange((s) => seen.push(s?.userId));

    const result = await auth.signOut();

    expect(result.ok).toBe(true);
    expect(await auth.getSession()).toBeUndefined();
    expect(seen).toEqual([undefined]); // the post-signIn subscriber saw exactly the clear
  });

  test('onSessionChange unsubscribe stops further notifications', async () => {
    const auth = createHttpAuthPort({ fetch: fakeFetch({ 'sign-in': () => session('u-1') }) });
    const seen: (EntityId | undefined)[] = [];
    const unsubscribe = auth.onSessionChange((s) => seen.push(s?.userId));
    unsubscribe();
    await auth.signIn({ method: 'password', email: 'a@example.com', password: 'pw' });
    expect(seen).toEqual([]);
  });
});
