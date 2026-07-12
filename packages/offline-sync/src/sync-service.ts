/**
 * The **push orchestration** over a {@link SyncPort} (#107 slice 3a, ADR 0005 §3/§4) — the thin layer
 * "above the port" (ADR 0005 §4) that decides *what* to replicate and *how far* the client has synced.
 * It reads the local events accumulated since the last push checkpoint, ships them, and advances the
 * checkpoint over the contiguous run the cloud accepted.
 *
 * **Scope (Option A, owner-approved 2026-07-12, see `docs/STATUS.md` + issue #176):** this is the
 * offline → cloud **push** half. It does **not** re-apply intent on a `conflict` — full domain rebase is
 * deferred with cross-device co-editing (#176). Under Option A a given aggregate stream is only written on
 * its origin device, so concurrent writers — the sole source of `conflict` — do not arise in normal use;
 * a `conflict` is therefore treated **defensively**: the checkpoint stops at it so the conflicting event
 * (and everything after) stays pending and is **never dropped**, to be resolved once #176 lands.
 *
 * The pull half (cloud → local apply, cross-device *view*) is slice 3b and lives elsewhere.
 */

import type { AppError, EventStorePort, SyncPort, SyncPushResult } from '@grimora/core-domain';
import { type EntityId, err, ok, type Result } from '@grimora/shared-types';

/**
 * The persisted "how far have we pushed" cursor. `ReadModelStorePort` satisfies this structurally, so the
 * web composition passes its OPFS-backed read store; kept as a narrow interface so the service stays
 * decoupled from the full read-model surface and is trivially faked in tests (ADR 0017).
 */
export interface SyncCheckpointStore {
  /** the last local `position` confirmed replicated for the named cursor (0 = nothing pushed yet) */
  getCheckpoint(cursor: string): Promise<number>;
  /** persist the advanced cursor after a successful push run */
  setCheckpoint(cursor: string, position: number): Promise<void>;
}

/** The checkpoint cursor name for the push side — distinct from any projection checkpoint sharing the store. */
const PUSH_CURSOR = 'sync:push';

/**
 * The outcome of one {@link SyncService.pushPending} run — a non-sensitive summary for logging/UI. Counts
 * are per event; `checkpoint` is where the push cursor now stands (unchanged from before the run if a
 * `conflict`/transport failure stopped it advancing).
 */
export interface SyncPushSummary {
  /** events newly ingested by the cloud this run (`accepted`) */
  readonly accepted: number;
  /** events the cloud already had (`duplicate`) — idempotent no-ops, safe to have re-sent (ADR 0005 §4) */
  readonly duplicates: number;
  /** events the cloud rejected as a stale version (`conflict`) — parked pending, awaiting rebase (#176) */
  readonly conflicts: number;
  /** the push cursor after the run (the local `position` up to which replication is confirmed) */
  readonly checkpoint: number;
}

/** The client-side sync orchestrator. Slice 3a exposes the push half only (see the module header). */
export interface SyncService {
  /**
   * Replicate the local events accumulated since the last push checkpoint, then advance the checkpoint
   * over the contiguous leading run the cloud confirmed (`accepted`/`duplicate`), stopping at the first
   * `conflict` so nothing past it is marked synced. Idempotent to re-run: already-pushed events return
   * `duplicate` and are skipped by the advanced checkpoint on the next run.
   * @returns a {@link SyncPushSummary} on success, or the transport/auth `AppError` when the whole request
   *          failed (in which case the checkpoint is left untouched and every event stays pending)
   */
  pushPending(): Promise<Result<SyncPushSummary, AppError>>;
}

/**
 * Build the push-side {@link SyncService}.
 * @param deps              the wired ports
 * @param deps.syncPort     the transport (the HTTP `SyncPort` adapter in production)
 * @param deps.events       the local event store to read un-synced events from (`readAll` after the cursor)
 * @param deps.checkpoints  the persisted push cursor store (the OPFS read store in production)
 * @returns                 the wired {@link SyncService}
 */
export function createSyncService(deps: {
  readonly syncPort: SyncPort;
  readonly events: EventStorePort;
  readonly checkpoints: SyncCheckpointStore;
}): SyncService {
  const { syncPort, events, checkpoints } = deps;

  return {
    async pushPending(): Promise<Result<SyncPushSummary, AppError>> {
      const from = await checkpoints.getCheckpoint(PUSH_CURSOR);
      // `readAll` is EXCLUSIVE on `from` and returns events in `position` order — so the results below are
      // in the same order, letting us advance the checkpoint over a contiguous confirmed prefix.
      const pending = await events.readAll(from);
      if (pending.length === 0)
        return ok({ accepted: 0, duplicates: 0, conflicts: 0, checkpoint: from });

      const result = await syncPort.push(pending);
      if (!result.ok) return err(result.error);
      const results = result.value;

      // Map each result back to the local `position` of its event so the checkpoint advances by real store
      // positions (results carry only the event `id`, not the local position).
      const positionById = new Map<EntityId, number>(pending.map((e) => [e.id, e.position]));

      let accepted = 0;
      let duplicates = 0;
      let conflicts = 0;
      let checkpoint = from;
      // Walk in order; advance the checkpoint over the leading run of confirmed events and STOP at the
      // first conflict — everything from the conflict onward stays pending (never dropped) for #176.
      let stillContiguous = true;
      for (const r of results) {
        if (r.status === 'accepted') accepted++;
        else if (r.status === 'duplicate') duplicates++;
        else conflicts++;

        if (!stillContiguous) continue;
        if (r.status === 'conflict') {
          stillContiguous = false;
          continue;
        }
        const pos = positionById.get(r.id);
        if (pos !== undefined) checkpoint = pos;
      }

      if (checkpoint > from) await checkpoints.setCheckpoint(PUSH_CURSOR, checkpoint);
      return ok({ accepted, duplicates, conflicts, checkpoint });
    },
  };
}
