# ADR 0004 — Event Sourcing & CQRS model

- **Status:** Proposed (→ Accepted on merge of the PR for issue #3)
- **Date:** 2026-07-05
- **Deciders:** project owner + AI agents
- **Depends on:** [ADR 0003](0003-overall-architecture.md) · **Feeds:** ADR 0005 (persistence/sync), 0009, 0017

## Context

Grimora stores non-master data as **events** (Event Sourcing) with a **CQRS** read side (ADR 0003,
vision). This must serve three hard requirements at once:

- **Offline-first**: events are produced on a device and synced later; the same events must merge
  deterministically across devices (details in ADR 0005).
- **Longevity**: the schema must evolve for years without rewriting stored history.
- **Storage-engine independence**: the model must not lock us to SQLite or Postgres (ADR 0003 §4).

This ADR fixes the event/aggregate model, the command/query split, the store **port**, projections,
and schema evolution — but **not** the concrete storage or sync mechanism (that is ADR 0005).

## Decision

### 1. Aggregates & events

- An **aggregate** is the consistency boundary: a stable `aggregateId` (`EntityId`), an
  `aggregateType` (e.g. `"character"`, `"campaign"`), and a monotonically increasing per-aggregate
  **`version`** (1-based). All invariants are enforced within one aggregate; cross-aggregate rules
  are eventually consistent via projections/process managers.
- **Events are immutable past-tense facts**, named `"<aggregateType>.<event>"`
  (e.g. `character.created`, `character.attributeChanged`). They are the source of truth.
- Aggregate **state is derived** by folding its events (pure `apply(state, event)` in the Domain
  layer). No state is stored directly except optional snapshots (§7).

### 2. Event envelope

We extend `EventEnvelope` from `@grimora/shared-types` (which already has `id`, `aggregateId`,
`type`, `version`, `occurredAt`, `payload`) with fields needed for evolution and sync:

- `aggregateType: string` — the stream's aggregate type.
- `schemaVersion: number` — payload schema version of this event **type** (for upcasting, §6).
- `metadata: { actorId?; correlationId?; causationId? }` — provenance/audit; no PII in metadata.
- `id` is a **globally unique** `EntityId`, generated via `IdGeneratorPort` as a **UUIDv7**
  (time-ordered → helps global ordering and sync).

A **`PersistedEvent`** is an `EventEnvelope` plus a store-assigned **`position`** (a global,
monotonic sequence within one store). `position` is *store-local* — it is **not** a cross-device
global order (ADR 0005 reconciles ordering across stores). This split (`version` per aggregate vs
`position` per store) is deliberate.

### 3. Command side (writes)

- **Commands** are intentions (`CreateCharacter`, `ChangeAttribute`) handled by **command handlers**
  in the **Application** layer (ADR 0003). A handler:
  1. rehydrates the aggregate via `EventStorePort.readStream` (or a snapshot + tail),
  2. calls pure Domain behavior, which returns **new events** or a typed error (`Result`),
  3. appends them via `EventStorePort.append` with an **`expectedVersion`** (optimistic concurrency).
- **Optimistic concurrency**: an append whose `expectedVersion` no longer matches fails with a
  `ConcurrencyError`; the caller retries or surfaces a conflict. This is also the hook sync uses
  (ADR 0005).
- The Domain never performs I/O; time and ids come from `ClockPort` / `IdGeneratorPort` (ADR 0003).

### 4. Event store port

Declared in `core-domain` (`application/ports`), implemented by adapters (ADR 0005). Sketch:

```ts
interface EventStorePort {
  append(
    streamId: EntityId,
    expectedVersion: number, // 0 for a new stream
    events: readonly EventEnvelope[],
  ): Promise<Result<void, ConcurrencyError>>;

  readStream(streamId: EntityId, fromVersion?: number): AsyncIterable<PersistedEvent>;

  // Global read for projections/sync, in store `position` order:
  readAll(fromPosition?: number): AsyncIterable<PersistedEvent>;

  // Live subscription for projections (at-least-once; idempotent consumers):
  subscribe(fromPosition: number, handler: (e: PersistedEvent) => Promise<void>): Unsubscribe;
}
```

No engine specifics leak through this port; SQLite (local) and Postgres/Supabase (cloud) are
interchangeable adapters (ADR 0003 §4, ADR 0005).

### 5. Query side (CQRS) & projections

- **Read models** are denormalized views optimized for queries, stored behind a
  **`ReadModelStorePort`**. The UI reads **only** read models — never the event store.
- **Projections** consume the event stream (`readAll`/`subscribe`) and update read models. They are:
  - **deterministic** (same events → same read model),
  - **idempotent** (keyed by event `id`/`position`; re-delivery is a no-op) — the store guarantees
    *at-least-once* delivery,
  - **checkpointed** (persist the last processed `position`) so they resume and can be **rebuilt**
    by replaying from `position 0`. Rebuildability is a first-class feature: new/changed views come
    from a replay, which makes large refactors cheap (ADR 0003 goal).
- Cross-aggregate workflows use **process managers/sagas** (projections that also emit commands),
  added later as needed.

### 6. Schema evolution (upcasting)

- Stored events are **append-only and never mutated**. Each event **type** carries `schemaVersion`.
- On read, an **upcaster** chain transforms an old payload to the current shape *before* the Domain
  or a projection sees it. Prefer **additive** changes; introduce **new event types** for genuinely
  new behavior; use upcasters only for shape migrations.
- This keeps decades of history readable without destructive migrations.

### 7. Snapshots (optional optimization)

Snapshots (a serialized aggregate state at a version) are an **optional** performance optimization
for long streams: rehydrate from the latest snapshot + subsequent events. Snapshots are derived and
disposable — **events remain the source of truth**; a snapshot can always be regenerated by replay.

### 8. Master data vs event-sourced

- **Event-sourced** (this ADR): user-generated, history-relevant aggregates — characters, campaigns,
  monster/NPC instances, play sessions, etc. History, audit and offline-merge add real value here.
- **Master data** (classic relational, *not* event-sourced): plugin rule definitions/catalogs, the
  asset catalog metadata, reference data, and auth/user records (Supabase). These are read-mostly and
  versioned by the plugin/catalog itself. Rationale: don't pay the ES cost where history isn't needed.

### 9. Determinism & offline alignment

- With injected `ClockPort`/`IdGeneratorPort`, event streams are **reproducible** in tests (ADR 0017).
- Events are self-contained facts with globally-unique ids and per-aggregate versions → **mergeable**
  across devices. Idempotent apply-by-`id` means re-delivered events during sync never double-apply.
  Cross-device ordering and conflict resolution are specified in **ADR 0005**; this ADR only ensures
  the model makes them possible.

### 10. Event naming, granularity & human-readable descriptions

The event list is what the owner (and auditors) actually read, so events must be **intention-revealing
domain events in the ubiquitous language** (DDD, ADR 0003 §9) — not generic CRUD field-setters where a
meaningful domain event exists.

- **Past-tense, intent-first names.** Prefer `character.renamed`, `character.attributeRaised`,
  `character.lifePointsChanged` over a catch-all `character.fieldChanged`. Capture the *operation's
  intent*: an absolute assignment during generation (`attributeSet`) and a relative change during
  advancement (`attributeRaised` with a delta) are **different events** because they mean different
  things (and enable correct undo/replay).
- **Right granularity.** Fine-grained where the domain acts in fine steps (each attribute raise during
  point-buy is its own event → full history/undo); coarser where the domain acts atomically. Avoid both
  "one giant event per save" and meaningless micro-events.
- **Rule-agnostic core, plugin language at the edge.** DSA5 terms such as *Courage*, *Agility* or
  *Life Points* belong to the **DSA5 plugin's bounded context** (ADR 0003 §9), not the core. So core
  `character` events stay generic — payloads carry an **attribute id + value/delta** — while *which*
  attributes exist and how they are labelled comes from the plugin. "Set Courage to 8" is the core
  event `character.attributeSet` `{ attributeId: "COU", value: 8 }` rendered through the DSA5 plugin.
- **Human-readable, localized descriptions.** The event-list/audit UI shows a rendered sentence, not the
  raw type/payload. Each event type provides a **`describe()`** — in the core for generic events, in the
  plugin for rule-specific labels — producing a ubiquitous-language, **localizable** string (i18n,
  ADR 0016). The stored event keeps `type` + structured `payload`; the description is *derived*, so
  history stays stable while wording/locale can change.

Worked example — the owner's list as core events on one `character` stream, rendered via the DSA5 plugin:

| ver | Event type (core) | Payload | Rendered (de) |
| --- | --- | --- | --- |
| 1 | `character.created` | `{}` | „Charakter erstellt" |
| 2 | `character.renamed` | `{ name: "Alrik" }` | „Name auf ‚Alrik' gesetzt" |
| 3 | `character.genderSet` | `{ gender: "female" }` | „Geschlecht auf weiblich gesetzt" |
| 4 | `character.attributeSet` | `{ attributeId: "COU", value: 8 }` | „Mut auf 8 gesetzt" |
| 7 | `character.attributeRaised` | `{ attributeId: "COU", by: 1 }` | „Mut um 1 erhöht" |
| 8 | `character.lifePointsSet` | `{ value: 30 }` | „Lebenspunkte auf 30 gesetzt" |
| 9 | `character.lifePointsChanged` | `{ by: 2 }` | „Lebenspunkte um 2 erhöht" |

## Consequences

**Positive:** full history/audit and time-travel; read models are rebuildable (cheap new views &
refactors); write/read concerns decoupled; storage-engine-agnostic; naturally offline-mergeable.

**Negative / costs:** more moving parts (projections, checkpoints, upcasters); the read side is
**eventually consistent**; events are forever, so event design needs discipline. Mitigations:
versioned events + upcasters, deterministic/idempotent projections, and the conformance harness (#9)
plus the testing strategy (ADR 0017).

## Alternatives considered

- **CRUD / state-oriented persistence** — simplest, but loses history, makes offline merge and audit
  hard. Rejected for user data; **kept for master data** (§8).
- **Event sourcing without CQRS** (query by rehydrating aggregates) — poor query flexibility/perf.
  Rejected; read models are required.
- **Snapshot-as-truth** — rejected; snapshots are a disposable optimization only (§7).

## References

- [ADR 0003](0003-overall-architecture.md) (layers, ports, swappability, **DDD §9**), ADR 0005
  (persistence & sync), ADR 0006 (plugin language), ADR 0009 (errors), ADR 0016 (i18n of event
  descriptions), ADR 0017 (testing). `@grimora/shared-types` `EventEnvelope`. Issue #3.
