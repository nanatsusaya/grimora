/**
 * The **push orchestration** over a {@link SyncPort} (#107 slice 3a, ADR 0005 §3/§4) — the thin layer
 * "above the port" (ADR 0005 §4) that decides *what* to replicate and *how far* the client has synced.
 * It reads the local events accumulated since the last push checkpoint, ships them, and advances the
 * checkpoint over the contiguous run the cloud accepted.
 *
 * **Scope (Option A, owner-approved 2026-07-12, see `docs/STATUS.md` + issue #176):** `pushPending`
 * (offline → cloud, slice 3a) and `pullPending` (cloud → local apply → cross-device *view*, slice 3b).
 * Neither re-applies intent on a `conflict` — full domain **rebase** is deferred with cross-device
 * co-editing (#176). Under Option A a given aggregate stream is only written on its origin device, so
 * concurrent writers — the sole source of a `conflict`/divergence — do not arise in normal use; a push
 * `conflict` is treated **defensively** (the checkpoint stops at it so the conflicting event and everything
 * after stays pending, **never dropped**), and a pull divergence surfaces from `replicate` as a thrown error
 * rather than a silent overwrite. Both are to be resolved once #176 lands.
 */

import type { AppError, SyncPort } from '@grimora/core-domain';
import { type EntityId, err, ok, type PersistedEvent, type Result } from '@grimora/shared-types';

/**
 * The persisted "how far have we synced" cursor store. `ReadModelStorePort` satisfies this structurally, so
 * the web composition passes its OPFS-backed read store; kept as a narrow interface so the service stays
 * decoupled from the full read-model surface and is trivially faked in tests (ADR 0017). Separate cursors
 * (push vs. pull) live under distinct names in the same store.
 */
export interface SyncCheckpointStore {
  /** the last confirmed cursor position for `cursor` (0 = nothing yet): a local `position` (push) or a cloud `position` (pull) */
  getCheckpoint(cursor: string): Promise<number>;
  /** persist the advanced cursor after a successful run */
  setCheckpoint(cursor: string, position: number): Promise<void>;
}

/**
 * The slice of the local event store the sync service needs: `readAll` (to gather un-pushed events) and
 * `replicate` (to apply a pulled cloud page idempotently by id, #107 slice 3b). Narrower than the full
 * store interface so both the OPFS-backed proxy and the in-memory fake satisfy it, and tests stay light.
 */
export interface SyncEventLog {
  /** events after `fromPosition` (EXCLUSIVE), in local `position` order — the un-pushed tail (ADR 0004 §4). */
  readAll(fromPosition?: number): Promise<readonly PersistedEvent[]>;
  /** apply cloud-pulled events into the local log, insert-only + idempotent by `id` (ADR 0005 §3). */
  replicate(events: readonly PersistedEvent[]): Promise<void>;
}

/** The checkpoint cursor name for the push side — distinct from the pull cursor + any projection checkpoint. */
const PUSH_CURSOR = 'sync:push';
/** The checkpoint cursor name for the pull side — a **cloud** `position` (ADR 0005 §7), distinct from push. */
const PULL_CURSOR = 'sync:pull';

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

/**
 * The outcome of one {@link SyncService.pullPending} run — a non-sensitive summary. `pulled` is how many
 * cloud events the page returned; because the local apply is idempotent by id (ADR 0005 §3), some may have
 * already been present. `checkpoint` is the cloud `position` the pull cursor now stands at.
 */
export interface SyncPullSummary {
  /** cloud events returned by this pull page (applied locally idempotently; some may already have existed) */
  readonly pulled: number;
  /** the pull cursor (a cloud `position`) after the run */
  readonly checkpoint: number;
}

/** The client-side sync orchestrator: push (offline → cloud) and pull (cloud → local apply), #107 slice 3. */
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
  /**
   * Pull the account's cloud events after the pull checkpoint and apply them to the local log idempotently
   * by id (ADR 0005 §3), then advance the checkpoint to the page's cloud `position`. Idempotent to re-run:
   * the advanced checkpoint means an already-pulled page is not re-requested, and a re-applied event is a
   * no-op. The caller re-runs its read-model projection afterwards so the UI reflects the applied events.
   * @returns a {@link SyncPullSummary} on success, or the transport/auth `AppError` when the pull failed
   *          (in which case the checkpoint is left untouched)
   */
  pullPending(): Promise<Result<SyncPullSummary, AppError>>;
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
  readonly events: SyncEventLog;
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

    async pullPending(): Promise<Result<SyncPullSummary, AppError>> {
      const from = await checkpoints.getCheckpoint(PULL_CURSOR);
      const result = await syncPort.pull(from);
      if (!result.ok) return err(result.error);
      const { events: pulled, checkpoint } = result.value;

      // Apply the page locally before advancing the checkpoint, so a failure mid-apply re-pulls the same
      // page rather than skipping it. `replicate` is idempotent by id, so re-applying is safe (ADR 0005 §3).
      if (pulled.length > 0) await events.replicate(pulled);
      // The checkpoint is a CLOUD position and advances even when a stream filter returned fewer events than
      // the server considered (ADR 0005 §7), so the client never re-requests a gap.
      if (checkpoint > from) await checkpoints.setCheckpoint(PULL_CURSOR, checkpoint);
      return ok({ pulled: pulled.length, checkpoint });
    },
  };
}
