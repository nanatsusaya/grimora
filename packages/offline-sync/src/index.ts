/**
 * Public entry for `@grimora/offline-sync` (ADR 0003 §5) — the client-side cloud-sync adapter (#107).
 * Exposes the HTTP `SyncPort` transport and the push-side orchestration; the composition root wires them
 * to the auth adapter (for the access token) and the local event store. See each module's header for the
 * Option-A scope (push now; pull/cross-device view is slice 3b, co-editing is deferred — issue #176).
 */

export { createHttpSyncPort } from './http-sync-port';
export {
  createSyncService,
  type SyncCheckpointStore,
  type SyncEventLog,
  type SyncPullSummary,
  type SyncPushSummary,
  type SyncService,
} from './sync-service';
