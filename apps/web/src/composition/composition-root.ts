/**
 * The `apps/web` **composition root** (#105-C, ADR 0003 §8): the single place that wires concrete adapters
 * to the core ports and hands back ready-to-use `CommandDeps`. Per the hexagon, this is the *only* module
 * allowed to import adapters + core + (later) a plugin together; the Domain/Application never see a
 * concrete store, clock, or worker.
 *
 * What it wires for the offline-first slice:
 *   - **event store + read-model store:** the OPFS SQLite adapters (#105-B), reached via the store worker
 *     because OPFS SAHPool is worker-only (`../store/worker-backed-stores.ts`).
 *   - **clock:** the real system clock (the Domain still never reads wall-clock time itself, ADR 0004 §9).
 *   - **id generator:** production UUIDv7 (`./id-generator.ts`).
 *   - **policy:** the skeleton owner-only `createOwnerPolicy` (ADR 0022 §7) — correct for an unbound device
 *     whose implicit identity owns everything it creates (ADR 0012 §13); #106 swaps in the real matrix.
 *   - **rules:** an (empty) plugin host satisfying `RuleSystemRegistryPort`; the DSA5 plugin and the
 *     character path are loaded in #105-D, keeping this ticket to the store/identity wiring.
 *
 * No `AuthPort`, Supabase, or network is on this path (deferred to #105-E) — the app boots and writes from
 * purely local data.
 */

import type { Actor, ClockPort, ReadModelStorePort } from '@grimora/core-domain';
import { type CommandDeps, createPluginHost } from '@grimora/core-domain';
import { createOwnerPolicy } from '@grimora/core-domain/testing';
import type { IsoTimestamp } from '@grimora/shared-types';
import { createWorkerBackedStores } from '../store/worker-backed-stores';
import { createUuidV7IdGenerator } from './id-generator';
import { ensureOfflineIdentity } from './offline-identity';

/** The real system clock: the production `ClockPort`. Kept out of the Domain, which stays time-injected. */
const systemClock: ClockPort = {
  now(): IsoTimestamp {
    return new Date().toISOString() as IsoTimestamp;
  },
};

/** Everything a `apps/web` surface needs from the wired hexagon: the command ports, the actor, and boot state. */
export interface AppComposition {
  /** the wired command ports for writes (OPFS event store + UUIDv7 ids + system clock + owner policy + host) */
  readonly deps: CommandDeps;
  /**
   * the read-model store, kept separate from {@link CommandDeps} because it belongs to the *projection*
   * side (`ProjectionDeps`), not the command side; #105-D's character-sheet view reads through it
   */
  readonly reads: ReadModelStorePort;
  /** the implicit local identity every offline use case runs as (ADR 0012 §13) */
  readonly actor: Actor;
  /** resolves once the OPFS stores are open; await before the first read/write, and to surface init errors */
  readonly ready: Promise<void>;
  /** release the store worker (tests/HMR); the running app keeps a single composition for its lifetime */
  terminate(): void;
}

/**
 * Build the offline-first composition: open the OPFS stores (via the worker), assemble the command ports,
 * and resolve the device's implicit identity. Cheap and synchronous — it returns immediately with a
 * `ready` promise for the asynchronous store startup, so the UI can render the shell without blocking.
 * @returns the wired {@link AppComposition}
 */
export function createAppComposition(): AppComposition {
  const { events, reads, ready, terminate } = createWorkerBackedStores();
  const ids = createUuidV7IdGenerator();

  const deps: CommandDeps = {
    events,
    ids,
    clock: systemClock,
    policy: createOwnerPolicy(),
    rules: createPluginHost(),
  };

  // Identity is resolved synchronously from local config (ADR 0012 §13) — no store round-trip needed, so
  // it is available before the stores finish opening.
  const actor = ensureOfflineIdentity(ids);

  return { deps, reads, actor, ready, terminate };
}
