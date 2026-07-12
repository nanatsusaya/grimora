/**
 * Walking-skeleton tests for the `apps/api` scaffold (ADR 0027 R3): they drive the app **in-process** via
 * Hono's `app.request()` (no network, deterministic) and prove the framework + structure choices work end
 * to end — routing, typed request/response, the composition-root port wiring, `problem+json` error mapping,
 * and OpenAPI generation. This is the "validate the choice with running code" the owner asked for (R3).
 */

import { describe, expect, test } from 'bun:test';
import { appError } from '@grimora/core-domain';
import { err, ok } from '@grimora/shared-types';
import { createApp } from './app';
import type { SupabaseAuthClient } from './auth/supabase-auth-client';
import { createApiComposition } from './composition/composition-root';

/** A no-op auth client — these scaffold tests exercise the non-auth routes; auth has its own suite. */
const stubAuth: SupabaseAuthClient = {
  signInWithPassword: async () => err(appError('auth.invalid_credentials', 'Unauthorized')),
  refresh: async () => err(appError('auth.invalid_credentials', 'Unauthorized')),
  signOut: async () => ok(undefined),
};

const app = createApp(createApiComposition({ auth: stubAuth, cookie: { secure: true } }));

describe('apps/api scaffold', () => {
  test('GET /health → 200 { status: "ok" }', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  test('GET /api/v1/rule-systems/dsa5 → 200 with a DTO (not the raw definition)', async () => {
    const res = await app.request('/api/v1/rule-systems/dsa5');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; traitCount: number; checkCount: number };
    expect(body.id).toBe('dsa5');
    expect(body.traitCount).toBeGreaterThan(0);
    expect(body.checkCount).toBeGreaterThan(0);
  });

  test('GET an unknown rule system → 404 problem+json (category NotFound)', async () => {
    const res = await app.request('/api/v1/rule-systems/nope');
    expect(res.status).toBe(404);
    const body = (await res.json()) as { code: string; category: string };
    expect(body.category).toBe('NotFound');
    expect(body.code).toBe('rule_system.not_found');
  });

  test('GET /api/v1/openapi.json → the generated OpenAPI 3.1 document', async () => {
    const res = await app.request('/api/v1/openapi.json');
    expect(res.status).toBe(200);
    const doc = (await res.json()) as { openapi: string; paths: Record<string, unknown> };
    expect(doc.openapi).toBe('3.1.0');
    // The typed routes are the single source; the spec is generated from them (code-first, ADR 0027 §3).
    expect(doc.paths['/api/v1/rule-systems/{id}']).toBeDefined();
  });
});
