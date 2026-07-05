# ADR 0005 — Persistence & offline-first sync

- **Status:** Proposed (→ Accepted on merge of the PR for issue #4)
- **Date:** 2026-07-05
- **Deciders:** project owner + AI agents
- **Depends on:** [ADR 0003](0003-overall-architecture.md), [ADR 0004](0004-event-sourcing-cqrs.md)

## Context

Grimora is **offline-first**: the device is the local source of truth, the cloud is a sync target,
backup, and the medium for multi-device and **shared play** (a campaign shared with a group). ADR 0004
fixed the event model (append-only, globally-unique `id`, per-aggregate `version`, store-local
`position`, `context` metadata) and the `EventStorePort` / `ReadModelStorePort`. This ADR decides the
concrete **local store**, **cloud store**, the **sync protocol + conflict resolution**, **object
storage** for assets, and **migrations** — all behind ports (ADR 0003 §4), storage-engine-agnostic,
free-tier-friendly and self-hostable.

## Decision

### 1. Local store (adapter)

**SQLite** is the primary local engine: native on mobile (Expo) and desktop (Tauri), **SQLite-WASM
over OPFS** on web (IndexedDB as a fallback where OPFS is unavailable). It implements
`EventStorePort` + `ReadModelStorePort` behind the ports from ADR 0004 — so it is swappable and the
Domain/Application never see SQLite.

### 2. Cloud store (adapter)

**Supabase Postgres** holds the **canonical append-only events table** plus optional server-side
projections for API queries/analytics. **Row-Level Security** restricts each client to the streams it
owns or is authorized for. It implements the same ports server-side.

### 3. Sync model — event-log replication

**Key insight:** the event log is **insert-only with globally-unique ids** (ADR 0004 §2), so
**storage-level replication is conflict-free** — replicate inserts and de-duplicate by `id`. The only
real conflict is a *domain* one (§4), handled separately.

Custom protocol via a **`SyncPort`** + API push/pull (ADR 0003 `apps/api`):

- **Pull:** client requests events with cloud `position` greater than its last-pulled checkpoint (for
  its authorized streams), applies them **idempotently** (dedup by `id`), advances the checkpoint, and
  updates local projections.
- **Push:** client sends un-synced local events; the server ingests them with a **per-aggregate
  optimistic-concurrency check** (expected `version`), assigns the **canonical cloud `position`**, and
  returns accepted ids + positions.
- **Checkpoints:** each client tracks *last-pulled cloud position* and *last-pushed local position*
  (the `position` vs `version` split from ADR 0004).
- **Ordering:** the **cloud assigns the canonical global order** (`position`); per-aggregate `version`
  gives causal order within a stream. Clients remain fully functional offline; only the *global* order
  needs the server.

### 4. Conflict resolution — domain rebase

Storage sync never conflicts (insert-only). The real conflict is **concurrent aggregate advancement**:
two offline devices both produce `version N+1` for the same aggregate.

- On push, the server **rejects the late writer** with a version conflict.
- The client then **rebases** (git-like): pull the canonical stream, re-apply the *intent* of its
  pending command(s) against the updated state, emitting new events at the next free version.
- Because events carry **intent** (ADR 0004 §10: *set* vs *raise*), many concurrent edits **auto-merge**
  on rebase (e.g. two different attributes raised). Only genuine semantic clashes (e.g. the same
  attribute *set* to two different absolute values) are surfaced as a **conflict for user/GM
  resolution**. Each aggregate defines its rebase/merge policy in the Domain layer.
- **Idempotency by `id`** guarantees retries never double-apply.

### 5. Object storage (adapter)

An **`ObjectStoragePort`** for assets (images, maps, tokens): **MinIO** (local/self-host) /
**Cloudflare R2** / Supabase Storage — swappable. Assets are **content-addressed** (by hash) where
possible; events reference a stable `assetId`, and the **binary syncs separately** from the log
(offline: queue upload; download on demand + cache). Large binaries never travel through the event log.

### 6. Migrations

- **Read models are rebuildable from events** (ADR 0004 §5): a breaking read-model change bumps the
  **projection version** and triggers a **local replay** — no `ALTER`/data migration. Major offline-first
  simplification.
- **Event log** shape is stable (append-only + upcasters, ADR 0004 §6); no destructive migration.
- **Local engine** (SQLite) structural migrations: versioned scripts at startup (mainly the
  event/checkpoint tables).
- **Cloud** (Postgres) migrations: Supabase migration tooling; the events table is additive.
- **Master data** (relational plugin/asset catalogs) is versioned by the plugin/catalog itself.

### 7. Authorization & security boundary

- Sync endpoints are authenticated (ADR 0009); Supabase **RLS** ensures a device only pulls/pushes
  streams the user owns or is authorized for. A **shared campaign** replicates its streams to all group
  members — this is the mechanism behind **playing together in a session**.
- Transport is TLS everywhere. **At-rest encryption** (ADR 0010) and **PII erasure via crypto-shredding**
  (ADR 0010/0015) are decided there; sync must **propagate erasure/redaction** events.

### 8. Technology choice & swappability

**Decision: custom event-log sync via `SyncPort` + API push/pull.** Rationale: the append-only,
unique-id, versioned log makes the protocol simple and well-understood; it matches the domain-rebase
conflict model exactly (which generic row-sync engines do not); and it needs **no extra vendor/service**
— cheapest, self-hostable, least lock-in (ADR 0003 §4). The `SyncPort` keeps **PowerSync / ElectricSQL
/ RxDB** available as drop-in adapters if managed sync infrastructure is wanted later.

## Consequences

**Positive:** storage sync is trivially conflict-free; domain conflicts are handled precisely and
mostly auto-merge via intent; read-model migrations are replays, not `ALTER`s; storage- and
provider-agnostic; cheap and self-hostable; shared-stream sync enables co-play.

**Negative / costs:** we implement the sync protocol and per-aggregate rebase/merge policies (bounded,
well-understood complexity); the server is the **canonical ordering authority** (clients stay fully
offline-capable, but global order/positions require the server to have been reached).

## Alternatives considered

- **PowerSync / ElectricSQL** (managed Postgres↔SQLite row sync): mature offline infra, but built for
  row/state sync with LWW/custom conflict — mismatched with our event-log + domain-rebase model, and
  adds a service/vendor. Could replicate the insert-only events table, but we'd still build the domain
  layer. **Kept as a possible `SyncPort` adapter.**
- **RxDB** (client reactive DB + replication): flexible, but couples the client to RxDB's model; our
  port abstraction is lighter.
- **CRDTs**: elegant for some value types, but ill-suited to rich aggregate invariants as a general
  mechanism; rejected globally (may be used for specific value objects later).
- **Last-writer-wins**: rejected — silently loses domain data.

## References

- [ADR 0003](0003-overall-architecture.md) (ports, swappability), [ADR 0004](0004-event-sourcing-cqrs.md)
  (event model, `EventStorePort`/`ReadModelStorePort`, `position`/`version`, `context`), ADR 0009
  (auth/security on sync), ADR 0010 (at-rest crypto), ADR 0015 (erasure/consent), ADR 0019 (analytics
  uses the same streams). Issue #4.
