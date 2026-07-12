/**
 * The `apps/api` **composition root** (ADR 0003 §8, ADR 0027 §4): the one place allowed to import
 * `core-domain` + concrete adapters + plugins together and wire them into the ports the HTTP layer needs.
 *
 * **Scope so far:** the plugin host (DSA5 rule system, exposed as `RuleSystemRegistryPort`) for the read
 * endpoint; the **Supabase auth client** + cookie policy for the auth proxy (#120 E2); and — added in #107
 * — the **Postgres sync store** + the **JWKS token verifier** for the sync endpoints. The adapters are
 * **injected** here (not constructed) so tests wire fakes and only `server.ts` reads real env (ADR 0010 §4).
 */

import { createPluginHost, type RuleSystemRegistryPort } from '@grimora/core-domain';
import dsa5 from '@grimora/plugin-dsa5';
import type { TokenVerifier } from '../auth/jwt';
import type { SupabaseAuthClient } from '../auth/supabase-auth-client';
import type { CookieConfig } from '../config';
import type { SyncStore } from '../sync/pg-sync-store';

/** The ports the `apps/api` HTTP layer consumes. Grows as the real backend wires more adapters. */
export interface ApiComposition {
  /** the in-process rule-system registry (plugin catalog), backing the master-data read endpoints */
  readonly rules: RuleSystemRegistryPort;
  /** the Supabase Auth (GoTrue) client backing the auth-proxy routes (ADR 0012 §5) */
  readonly auth: SupabaseAuthClient;
  /** how the auth routes set the refresh cookie (Secure toggle for local http dev, ADR 0012 §5) */
  readonly cookie: CookieConfig;
  /** the cloud event ingestion store backing the sync endpoints (#107, ADR 0005 §3) */
  readonly syncStore: SyncStore;
  /** verifies Supabase access tokens for the sync endpoints' actor-binding (#107, ADR 0024 §2) */
  readonly tokenVerifier: TokenVerifier;
}

/**
 * Build the API composition: load the first-party plugin(s) into an in-process host and combine them with
 * the injected adapters. All adapters are **injected** (not read from env here) so tests pass fakes and
 * env-reading stays at the `server.ts` entry (ADR 0010 §4).
 * @param deps                the externally-wired adapters
 * @param deps.auth           the Supabase Auth (GoTrue) client
 * @param deps.cookie         the refresh-cookie policy
 * @param deps.syncStore      the cloud event ingestion store
 * @param deps.tokenVerifier  the access-token verifier
 * @returns                   the wired {@link ApiComposition}
 */
export function createApiComposition(deps: {
  readonly auth: SupabaseAuthClient;
  readonly cookie: CookieConfig;
  readonly syncStore: SyncStore;
  readonly tokenVerifier: TokenVerifier;
}): ApiComposition {
  const host = createPluginHost();
  host.load(dsa5);
  return {
    rules: host,
    auth: deps.auth,
    cookie: deps.cookie,
    syncStore: deps.syncStore,
    tokenVerifier: deps.tokenVerifier,
  };
}
