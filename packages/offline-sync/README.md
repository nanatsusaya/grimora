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
- **`createSyncService`** — the thin push orchestration "above the port" (ADR 0005 §4): read the local
  events after the push checkpoint, ship them, advance the checkpoint over the confirmed run.

## Scope: "Option A" (owner-approved 2026-07-12)

Cloud sync ships in capability steps, not all at once. This package currently implements the **push** half.

| Step | What | Status |
| --- | --- | --- |
| Push (slice 3a) | offline → cloud replication of local events | **implemented here** |
| Pull + local apply (slice 3b) | cloud → local, idempotent-by-id, projection rebuild → cross-device **view** | next PR |
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
source of a `conflict` — do not arise in normal use. The push orchestration still handles a `conflict`
**defensively**: it **parks** at the conflict (never drops the event, never marks anything past it as
synced), leaving the full domain **rebase** (re-applying command intent, ADR 0005 §4) to land with #176.

## Tests & live verification

Unit tests cover the HTTP mapping and the push orchestration against fakes (ADR 0017). The push path is
additionally verified **end-to-end against real `apps/api` + real Postgres** by
`apps/web/scripts/sync-push-smoke.ts` (a gated dev tool, not in CI).
