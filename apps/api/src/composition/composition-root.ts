/**
 * The `apps/api` **composition root** (ADR 0003 §8, ADR 0027 §4): the one place allowed to import
 * `core-domain` + concrete adapters + plugins together and wire them into the ports the HTTP layer needs.
 *
 * **Scaffold scope (ADR 0027 R3):** this walking-skeleton wires only what the minimal endpoints need — the
 * plugin host with the DSA5 rule system, exposed as a `RuleSystemRegistryPort` for the read endpoint. The
 * *real* backend adds the Postgres sync `EventStorePort` (#107), the `AuthPort` adapter, `SecretsPort`, and
 * the rest — trigger-gated to Phase 3+ (ADR 0014 §3). No secrets or I/O adapters exist yet, so nothing here
 * reads the environment; when they do, they are injected here via `SecretsPort` (ADR 0010 §4), never deeper.
 */

import { createPluginHost, type RuleSystemRegistryPort } from '@grimora/core-domain';
import dsa5 from '@grimora/plugin-dsa5';

/** The ports the `apps/api` HTTP layer consumes. Grows as the real backend wires more adapters. */
export interface ApiComposition {
  /** the in-process rule-system registry (plugin catalog), backing the master-data read endpoints */
  readonly rules: RuleSystemRegistryPort;
}

/**
 * Build the API composition: load the first-party plugin(s) into an in-process host and expose the wired
 * ports. Pure wiring (no network/filesystem), matching the `apps/skeleton-walk` pattern.
 * @returns the wired {@link ApiComposition}
 */
export function createApiComposition(): ApiComposition {
  const host = createPluginHost();
  host.load(dsa5);
  return { rules: host };
}
