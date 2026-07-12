# @grimora/offline-sync

Client-side cloud-sync **adapter** (ADR 0003 §7, ADR 0005 §3/§4/§8) for the offline-first app: it
replicates the local event log to the cloud through the `apps/api` sync endpoints. It is the deliberate
swap point (ADR 0005 §8) — a custom HTTP transport today, PowerSync/Electric conceivable later — so nothing
above the `SyncPort` changes if the transport does.

## What's here

- **`createHttpSyncPort`** — the `SyncPort` (core-domain) over `POST/GET /api/v1/sync/{push,pull}`.
  Transport only: it moves envelopes and maps per-event results; it never orchestrates a rebase. Reads the
  Bearer access token *per request* from an injected getter so the token stays in the auth adapter's
  memory-only closure (ADR 0012 §5) and a post-refresh token is always current.
- **`createSyncService`** — the orchestration "above the port" (ADR 0005 §4):
  - `pushPending` — read the local events after the push checkpoint, ship them, advance the checkpoint over
    the confirmed run.
  - `pullPending` — pull the account's cloud events after the pull checkpoint and apply them to the local
    log **idempotently by id** (`SyncEventLog.replicate`), then advance the checkpoint. The caller re-runs
    its read-model projection afterwards so the UI reflects the applied events.

## Scope: "Option A" (owner-approved 2026-07-12)

Cloud sync ships in capability steps, not all at once. This package implements **push + pull**.

| Step | What | Status |
| --- | --- | --- |
| Push (slice 3a) | offline → cloud replication of local events | **implemented here** |
| Pull + local apply (slice 3b) | cloud → local, idempotent-by-id (`replicate`); the view re-projects | **implemented here** |
| Character list / picker (slice 3c) | browse + open a *newly-pulled* cross-device character in the UI | **done** (a read-model character index + a picker in `apps/web`) |
| Co-editing (#176) | editing, on device B, an aggregate created on device A | **deferred** |

### Why co-editing is deferred — the consequence to know

Under the ADR 0012 §13 **"Reading 2"** identity model, a device keeps a stable **device principal**, and
events are immutable (ADR 0004): an aggregate created offline carries the device pseudonym as its owner. On
push, the server stamps the storage `owner_id` from the verified JWT (the account, ADR 0024 §2), so another
device signed into the same account can **pull and view** those events. But local authorization is
**owner-only** (ADR 0009 / #106): the second device's own principal ≠ the first device's pseudonym, so it
**cannot edit** that aggregate. True multi-device editing therefore needs the Reading 1↔2 identity
resolution — recorded and tracked in **issue #176**, not decided in code here.

Because only an aggregate's origin device writes its stream under Option A, concurrent writers — the sole
source of a `conflict` (push) / divergence (pull) — do not arise in normal use. The push orchestration
**parks** at a `conflict` (never drops the event, never marks anything past it as synced); the local
`replicate` **throws** on a divergent `(aggregate_id, version)` rather than silently overwriting. The full
domain **rebase** (re-applying command intent, ADR 0005 §4) lands with #176.

## Tests & live verification

Unit tests cover the HTTP mapping and the push/pull orchestration against fakes (ADR 0017). The paths are
additionally verified **end-to-end against real `apps/api` + real Postgres** by two gated dev tools (not in
CI): `apps/web/scripts/sync-push-smoke.ts` (offline → cloud) and `apps/web/scripts/sync-pull-smoke.ts`
(two same-account "devices": A pushes, B pulls + applies — the cross-device round-trip).
