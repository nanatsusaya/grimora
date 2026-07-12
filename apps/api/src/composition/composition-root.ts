/**
 * The `apps/api` **composition root** (ADR 0003 §8, ADR 0027 §4): the one place allowed to import
 * `core-domain` + concrete adapters + plugins together and wire them into the ports the HTTP layer needs.
 *
 * **Scope so far:** the plugin host (DSA5 rule system, exposed as `RuleSystemRegistryPort`) for the read
 * endpoint, and — added in #120 E2 — the **Supabase auth client** + cookie policy for the auth proxy. The
 * adapters are **injected** here (not constructed) so tests wire fakes and only `server.ts` reads real env
 * (ADR 0010 §4). The Postgres sync `EventStorePort` (#107), `SecretsPort`, etc. are still to come.
 */

import { createPluginHost, type RuleSystemRegistryPort } from '@grimora/core-domain';
import dsa5 from '@grimora/plugin-dsa5';
import type { SupabaseAuthClient } from '../auth/supabase-auth-client';
import type { CookieConfig } from '../config';

/** The ports the `apps/api` HTTP layer consumes. Grows as the real backend wires more adapters. */
export interface ApiComposition {
  /** the in-process rule-system registry (plugin catalog), backing the master-data read endpoints */
  readonly rules: RuleSystemRegistryPort;
  /** the Supabase Auth (GoTrue) client backing the auth-proxy routes (ADR 0012 §5) */
  readonly auth: SupabaseAuthClient;
  /** how the auth routes set the refresh cookie (Secure toggle for local http dev, ADR 0012 §5) */
  readonly cookie: CookieConfig;
}

/**
 * Build the API composition: load the first-party plugin(s) into an in-process host and combine them with
 * the injected adapters. The auth client + cookie policy are **injected** (not read from env here) so tests
 * pass fakes and env-reading stays at the `server.ts` entry (ADR 0010 §4).
 * @param deps  the externally-wired adapters: the Supabase `auth` client and the `cookie` policy
 * @returns     the wired {@link ApiComposition}
 */
export function createApiComposition(deps: {
  readonly auth: SupabaseAuthClient;
  readonly cookie: CookieConfig;
}): ApiComposition {
  const host = createPluginHost();
  host.load(dsa5);
  return { rules: host, auth: deps.auth, cookie: deps.cookie };
}
