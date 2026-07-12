/**
 * Shared test doubles + a composition factory for `apps/api` route tests, so each suite wires the same
 * all-stub composition and overrides only the adapter it exercises (avoids duplicating stubs across
 * suites). Only `*.test.ts` import this; it is not on any production path.
 */

import { appError } from '@grimora/core-domain';
import { err, ok } from '@grimora/shared-types';
import type { TokenVerifier } from './auth/jwt';
import type { SupabaseAuthClient } from './auth/supabase-auth-client';
import { type ApiComposition, createApiComposition } from './composition/composition-root';
import type { SyncStore } from './sync/pg-sync-store';

/** A GoTrue client that always rejects — suites that test auth pass their own configured fake. */
const stubAuth: SupabaseAuthClient = {
  signInWithPassword: async () => err(appError('auth.invalid_credentials', 'Unauthorized')),
  refresh: async () => err(appError('auth.invalid_credentials', 'Unauthorized')),
  signOut: async () => ok(undefined),
};

/** A sync store that ingests/returns nothing — suites that test sync pass their own configured fake. */
const stubSyncStore: SyncStore = {
  push: async () => [],
  pull: async () => ({ events: [], checkpoint: 0 }),
  close: async () => undefined,
};

/** A verifier that rejects every token — suites that test authorized paths pass an accepting fake. */
const stubVerifier: TokenVerifier = {
  verify: async () => err(appError('auth.invalid_token', 'Unauthorized')),
};

/**
 * Build an `apps/api` composition with all-stub adapters, overriding only the ones a suite exercises.
 * @param overrides                the adapters to replace (all optional)
 * @param overrides.auth           the GoTrue auth client
 * @param overrides.syncStore      the cloud sync store
 * @param overrides.tokenVerifier  the access-token verifier
 * @param overrides.cookie         the refresh-cookie policy
 * @returns                        a wired {@link ApiComposition} for in-process route tests
 */
export function testComposition(
  overrides: {
    readonly auth?: SupabaseAuthClient;
    readonly syncStore?: SyncStore;
    readonly tokenVerifier?: TokenVerifier;
    readonly cookie?: { readonly secure: boolean };
  } = {},
): ApiComposition {
  return createApiComposition({
    auth: overrides.auth ?? stubAuth,
    cookie: overrides.cookie ?? { secure: true },
    syncStore: overrides.syncStore ?? stubSyncStore,
    tokenVerifier: overrides.tokenVerifier ?? stubVerifier,
  });
}
