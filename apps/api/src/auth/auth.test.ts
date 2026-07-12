/**
 * Tests for the auth-proxy routes (#120 E2), driven in-process via `app.request()` against a **fake**
 * {@link SupabaseAuthClient} — deterministic, no network. They pin the proxy's contract that the real
 * Supabase integration is verified against separately (the `scripts/auth-smoke.ts` live smoke): the
 * refresh token goes **only** into an `HttpOnly`, path-scoped cookie and never a JSON body (ADR 0012 §5);
 * bad credentials map to `401 problem+json`; refresh rotates the cookie; an invalid refresh clears it.
 */

import { describe, expect, test } from 'bun:test';
import { appError } from '@grimora/core-domain';
import { err, ok } from '@grimora/shared-types';
import { createApp } from '../app';
import { testComposition } from '../test-support';
import type { SupabaseAuthClient } from './supabase-auth-client';

/** A configurable fake GoTrue client — happy-path by default; override a method to force a failure. */
function createFakeAuth(overrides: Partial<SupabaseAuthClient> = {}): SupabaseAuthClient {
  return {
    signInWithPassword: async () =>
      ok({ accessToken: 'at-1', refreshToken: 'rt-1', expiresIn: 3600, userId: 'u-1' }),
    refresh: async () =>
      ok({ accessToken: 'at-2', refreshToken: 'rt-2', expiresIn: 3600, userId: 'u-1' }),
    signOut: async () => ok(undefined),
    ...overrides,
  };
}

/** Build an app whose auth client is the given fake. */
function appWith(auth: SupabaseAuthClient) {
  return createApp(testComposition({ auth }));
}

const jsonPost = (body: unknown, headers: Record<string, string> = {}) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
});

describe('auth proxy', () => {
  test('POST /sign-in (valid) → 200 with access token + identity, refresh only in an HttpOnly cookie', async () => {
    const res = await appWith(createFakeAuth()).request(
      '/api/v1/auth/sign-in',
      jsonPost({ email: 'a@example.com', password: 'pw' }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      accessToken: string;
      userId: string;
      refreshToken?: string;
    };
    expect(body.accessToken).toBe('at-1');
    expect(body.userId).toBe('u-1');
    // The refresh token must NEVER appear in the JSON body (ADR 0012 §5).
    expect(body.refreshToken).toBeUndefined();

    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('grimora_refresh=rt-1');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Path=/api/v1/auth');
    expect(cookie.toLowerCase()).toContain('samesite=strict');
  });

  test('POST /sign-in (invalid) → 401 problem+json and no cookie set', async () => {
    const auth = createFakeAuth({
      signInWithPassword: async () => err(appError('auth.invalid_credentials', 'Unauthorized')),
    });
    const res = await appWith(auth).request(
      '/api/v1/auth/sign-in',
      jsonPost({ email: 'a@example.com', password: 'wrong' }),
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { category: string };
    expect(body.category).toBe('Unauthorized');
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  test('POST /refresh with no cookie → 401', async () => {
    const res = await appWith(createFakeAuth()).request('/api/v1/auth/refresh', { method: 'POST' });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('auth.no_refresh_cookie');
  });

  test('POST /refresh with a valid cookie → 200 with a new access token and a rotated cookie', async () => {
    const res = await appWith(createFakeAuth()).request('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { cookie: 'grimora_refresh=rt-1' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { accessToken: string };
    expect(body.accessToken).toBe('at-2');
    expect(res.headers.get('set-cookie') ?? '').toContain('grimora_refresh=rt-2');
  });

  test('POST /refresh with an invalid cookie → 401 and the cookie is cleared', async () => {
    const auth = createFakeAuth({
      refresh: async () => err(appError('auth.invalid_credentials', 'Unauthorized')),
    });
    const res = await appWith(auth).request('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { cookie: 'grimora_refresh=stale' },
    });
    expect(res.status).toBe(401);
    // Cleared → Set-Cookie with an immediate expiry (Max-Age=0), so the client stops resending it.
    expect(res.headers.get('set-cookie') ?? '').toContain('Max-Age=0');
  });

  test('POST /sign-out → 204 and clears the refresh cookie', async () => {
    const res = await appWith(createFakeAuth()).request('/api/v1/auth/sign-out', {
      method: 'POST',
      headers: { cookie: 'grimora_refresh=rt-1', authorization: 'Bearer at-1' },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('set-cookie') ?? '').toContain('Max-Age=0');
  });
});
