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
 *   - **policy:** the real `createRoleMatrixPolicy` (#106, ADR 0009 §3) — an unbound device's implicit
 *     identity needs no special case here: it owns everything it creates locally (ADR 0012 §13), which is
 *     the ordinary owner branch the matrix already grants.
 *   - **rules:** a plugin host with the **DSA5 plugin loaded** (#105-D) — the one place a composition root
 *     is allowed to import a plugin alongside core + adapters; the character path binds to `dsa5`.
 *   - **auth:** the client-side `AuthPort` (#120 E3) — the HTTP adapter over the `apps/api` auth proxy. The
 *     app still **boots and writes locally** under the ADR 0012 §13 device identity regardless of auth;
 *     login is additive. `restore()` runs once at boot to re-establish a session from the refresh cookie.
 */

import type { Actor, AuthPort, ClockPort, ReadModelStorePort } from '@grimora/core-domain';
import { type CommandDeps, createPluginHost, createRoleMatrixPolicy } from '@grimora/core-domain';
import { createHttpSyncPort, createSyncService, type SyncService } from '@grimora/offline-sync';
import dsa5 from '@grimora/plugin-dsa5';
import type { IsoTimestamp } from '@grimora/shared-types';
import { createHttpAuthPort } from '../auth/http-auth-port';
import { createWorkerBackedStores } from '../store/worker-backed-stores';
import { createUuidV7IdGenerator } from './id-generator';
import { bindDeviceOnFirstLogin, ensureOfflineIdentity } from './offline-identity';

/** The real system clock: the production `ClockPort`. Kept out of the Domain, which stays time-injected. */
const systemClock: ClockPort = {
  now(): IsoTimestamp {
    return new Date().toISOString() as IsoTimestamp;
  },
};

/** Everything a `apps/web` surface needs from the wired hexagon: the command ports, the actor, and boot state. */
export interface AppComposition {
  /** the wired command ports for writes (OPFS event store + UUIDv7 ids + system clock + role-matrix policy + host) */
  readonly deps: CommandDeps;
  /**
   * the read-model store, kept separate from {@link CommandDeps} because it belongs to the *projection*
   * side (`ProjectionDeps`), not the command side; #105-D's character-sheet view reads through it
   */
  readonly reads: ReadModelStorePort;
  /** the implicit local identity every offline use case runs as (ADR 0012 §13) */
  readonly actor: Actor;
  /** the client-side authentication port (login/session over the `apps/api` proxy, ADR 0012 §5) */
  readonly auth: AuthPort;
  /**
   * the client-side cloud **push** service (#107 slice 3a): replicates local events to the cloud once the
   * user is signed in. Push runs automatically on login and can be triggered from the UI; the pull half
   * (cross-device view) is slice 3b (see `docs/STATUS.md` / issue #176 for the Option-A scope)
   */
  readonly sync: SyncService;
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
  const { events, reads, ready, terminate: terminateStores } = createWorkerBackedStores();
  const ids = createUuidV7IdGenerator();

  // Load the DSA5 rule system into the in-process plugin host so character commands + the sheet
  // projection can resolve its traits/checks (ADR 0006 §5). This composition root is the only place
  // allowed to import a plugin together with core + adapters (ADR 0003 §2).
  const rules = createPluginHost();
  rules.load(dsa5);

  const deps: CommandDeps = {
    events,
    ids,
    clock: systemClock,
    policy: createRoleMatrixPolicy(),
    rules,
  };

  // Identity is resolved synchronously from local config (ADR 0012 §13) — no store round-trip needed, so
  // it is available before the stores finish opening.
  const actor = ensureOfflineIdentity(ids);

  // Client-side auth over the apps/api proxy. `restore()` is fire-and-forget: it re-establishes a session
  // from the HttpOnly refresh cookie if present, but must never block boot or the offline path — when
  // apps/api is unreachable (pure offline) it silently no-ops and the §13 device identity carries on.
  const auth = createHttpAuthPort();
  // Record the device → account binding on the first session (ADR 0012 §13 first-bind, #120 E4). Installed
  // BEFORE restore() so a session recovered from the refresh cookie is bound too; idempotent thereafter.
  const unbindFirstLogin = bindDeviceOnFirstLogin(auth, actor.userId, () => systemClock.now());

  // Client-side cloud push (#107 slice 3a). The sync adapter reads the Bearer access token live from the
  // auth adapter on each request (the token stays in that adapter's memory-only closure, ADR 0012 §5); the
  // push cursor persists in the OPFS read store (`reads`), which structurally satisfies the checkpoint port.
  const sync = createSyncService({
    syncPort: createHttpSyncPort({ getAccessToken: () => auth.getAccessToken() }),
    events,
    checkpoints: reads,
  });
  // Push on login: when a session becomes current (fresh sign-in or a restore() from the refresh cookie),
  // replicate whatever accumulated offline. Fire-and-forget and best-effort — a failed/offline push must
  // never disrupt the local-first path (the events stay pending for the next attempt). `ready` guards the
  // first store access so a push triggered by an early cookie-restore does not race OPFS startup.
  const unbindPushOnLogin = auth.onSessionChange((session) => {
    if (!session) return;
    void ready.then(() => sync.pushPending()).catch(() => undefined);
  });
  void auth.restore();

  return {
    deps,
    reads,
    actor,
    auth,
    sync,
    ready,
    terminate() {
      unbindPushOnLogin();
      unbindFirstLogin();
      terminateStores();
    },
  };
}
