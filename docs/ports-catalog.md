# Ports catalog

A single, current reference of every port in the hexagon (ADR 0003 §1/§7). ADR 0003 §7 introduced this
table as a **stub** ("expanded by ADRs 0004–0010") — this doc is that expansion, kept up to date as
Phase 2 actually builds adapters against it. It is **not** a decision record: every port's contract is
owned by the ADR(s) in the "Owning ADR(s)" column; this doc only indexes and tracks implementation
status. If a port's contract changes, the ADR changes (by amendment or superseding ADR) and this table
is updated to match — never the other way round.

**Where ports live in code:** every port is a TypeScript interface in
[`packages/core-domain/src/application/ports.ts`](../packages/core-domain/src/application/ports.ts)
(Domain/Application depend only on these, never on concrete adapters — ADR 0003 §1 dependency rule).
Adapters (SQLite, Postgres, Supabase Auth, pino, …) live outside the hexagon and are wired at a
composition root (`apps/*`). The walking skeleton (#61) implements every port used so far as an
**in-memory fake** (`packages/core-domain/src/testing/fakes.ts`, ADR 0017 R1) — real adapters are a
Phase-2 deliverable, not a Phase-1 one.

## Status legend

- **Real (in-process)** — the port's implementation *is* the core logic (no external I/O to swap), so
  there is nothing further to build beyond the existing code.
- **Skeleton fake** — an in-memory, deterministic stand-in exists (`testing/fakes.ts`) and is exercised
  by tests/the walking skeleton; no adapter with real I/O exists yet.
- **Not yet implemented** — declared only in an ADR; no interface, fake, or adapter exists in code yet.

## Catalog

| Port | Purpose | Owning ADR(s) | Status now | Planned adapter(s) (local / cloud) | Phase-2 driver |
| --- | --- | --- | --- | --- | --- |
| `EventStorePort` | Append-only per-aggregate event log, optimistic concurrency via `expectedVersion` | ADR 0004 §4, ADR 0005 §1 | **Real (native)** — `@grimora/event-store` `createSqliteEventStore` (`bun:sqlite`, durable, `UNIQUE(aggregate_id, version)`), held to the shared `eventStoreContract`; in-memory fake still used for pure tests. **Web (OPFS/WASM) driver deferred to #105** (needs a browser to verify). | SQLite native ✅ / OPFS (web) → #105; Postgres (Supabase) cloud via sync → #107 | #103 ✅ (native); OPFS sub-task under #105 |
| `ReadModelStorePort` | Denormalized, checkpointed read models the UI queries — never the event store | ADR 0004 §5, ADR 0005 §1 | Skeleton fake (`createInMemoryReadModelStore`) | Same local/cloud targets as `EventStorePort` | *Persistent read-model projections* ticket (to be opened) |
| `ClockPort` | Injected time — Domain never reads the wall clock directly | ADR 0004 §9 | Skeleton fake (`createFixedClock`); production adapter is a thin `Date`/`Temporal` wrapper | System clock (prod) / fixed instant (tests) | Trivial — wire alongside the first real composition root |
| `IdGeneratorPort` | Injected id generation — deterministic in tests | ADR 0004 §2 | Skeleton fake (`createSequentialIdGenerator`); production adapter is UUIDv7 | UUIDv7 (prod) / sequential-prefixed (tests) | Trivial — wire alongside the first real composition root |
| `PolicyPort` (+ `AuthorizationPort`, ADR 0009 §3) | Pure `(actor, action, resource) → boolean` authorization decision, enforced per use case | ADR 0009 §3, ADR 0010 §2 | Skeleton fake, **owner-only** (`createOwnerPolicy` — ADR 0022 §7 provisional policy) | Real Owner/GM/Player/Spectator role×resource matrix | *Real authorization* ticket (to be opened) — Epic #52 carry-over |
| `AuthPort` | Authentication: login, session, token issuance/validation | ADR 0009 §3 | Not yet implemented | Supabase Cloud / self-hosted GoTrue (ADR 0009 §3) | `apps/web` shell ticket (to be opened) — first thing that needs a real session; interacts with the offline-session identity amendment (ADR 0012 §13): the implicit local identity exists *before* any `AuthPort` session |
| `SecretsPort` | Secret injection at the composition root only | ADR 0010 §4 | Not yet implemented | env / vault, composition-root only | Whichever ticket first wires a real secret (Supabase keys, AI provider keys) — likely the `apps/web`/`apps/api` composition root work |
| `CryptoPort` | Encryption primitives for per-subject DEKs / crypto-shredding | ADR 0005, ADR 0010, ADR 0023 | Not yet implemented | WebCrypto (web) / libsodium (native) | #92 (privacy classification on the event seed) is the natural first caller |
| `AiProviderPort` | AI *proposes* a tool call; the agent loop executes it through the same use case + authz as the UI | ADR 0008 §1 | Skeleton fake (`createScriptedAiProvider`) | Ollama (no-consent default) / Claude / OpenAI (opt-in, ADR 0008/0015) | Not in this vertical slice — deferred until an AI chat surface is built |
| `RuleSystemRegistryPort` | In-process rule-system/plugin registry (loaded definitions, provenance) | ADR 0006 §5, ADR 0020, ADR 0021, ADR 0025 | **Real** (`createPluginHost`, `application/plugin-host.ts`) — in-process logic, no external I/O to swap | `plugins/dsa5` (first-party) | Already real; extended as new plugins/rule systems are added |
| `SyncPort` | Insert-only replication + domain rebase against the cloud | ADR 0005 §3/§4, ADR 0024 | Not yet implemented as a port/adapter — validated via the **test-only** `sync-harness.ts` (direct `InMemoryEventStore.replicate`/`reset`, not through a `SyncPort` interface) | Custom sync engine over Supabase Postgres | *Sync adapter* ticket (to be opened) — last in the vertical slice |
| `ObjectStoragePort` | Binary asset storage | ADR 0005 | Not yet implemented | MinIO (local) / Cloudflare R2 (cloud) | Trigger-gated (asset pipeline, Epic #52) — not in this slice |
| `PluginHostPort` | In-process plugin loader (load/register) | ADR 0006 | **Real** — folded into `createPluginHost` (`application/plugin-host.ts`), same implementation backing `RuleSystemRegistryPort` | n/a (in-process) | Already real |
| `LoggerPort` | Structured logging, PII-redacted at the adapter | ADR 0009 §2 | Not yet implemented | pino (backend) / Sentry (frontend) | Whichever composition root lands first (likely `apps/web` shell or the event-store adapter) |
| `ConsentPort` | Event-sourced, versioned, resource-scoped consent record | ADR 0015 §2 | Not yet implemented | — (in-core, event-sourced) | #73 (already ticketed, currently blocked) |
| `RealtimePort` | Liveness-only "new events for stream X" signal — never a second data path into the UI | ADR 0024 §6 | Not yet implemented | Supabase Realtime | After the sync adapter exists; not required for this slice's exit criteria |

## Notes

- **`AuthorizationPort` vs. `PolicyPort`:** ADR 0009 §3 and ADR 0003 §7 name both; the skeleton's single
  `PolicyPort` interface (`ports.ts`) already covers the authorization-decision contract both refer to —
  there is no separate `AuthorizationPort` type in code, and none is planned; treat the two ADR names as
  synonyms for one port.
- **Ports with no adapter gap:** `ClockPort`/`IdGeneratorPort` are trivial to make "real" (a thin
  system-clock/UUIDv7 wrapper) and are not tracked as their own tickets — they get wired in as a side
  effect of the first real composition root, not as standalone work.
- **Keep this table in sync** with `packages/core-domain/src/application/ports.ts` whenever a port is
  added, renamed, or gains a real adapter — a stale ports catalog is worse than none (CLAUDE.md: stale
  documentation is a defect).

## References

- [ADR 0003](adr/0003-overall-architecture.md) §7 (the original stub table this doc expands)
- [ADR 0004](adr/0004-event-sourcing-cqrs.md), [ADR 0005](adr/0005-persistence-and-sync.md) (event
  store / read models / sync / object storage)
- [ADR 0006](adr/0006-plugin-system.md) (plugin host / rule-system registry)
- [ADR 0008](adr/0008-ai-provider-abstraction.md) (AI provider)
- [ADR 0009](adr/0009-cross-cutting-concerns.md), [ADR 0010](adr/0010-security-and-privacy-by-design.md)
  (auth, authorization, secrets, crypto, logging)
- [ADR 0012](adr/0012-web-rendering-and-state.md) §13 (offline-session identity — interacts with
  `AuthPort`)
- [ADR 0015](adr/0015-compliance-and-data-protection.md) (consent)
- [ADR 0024](adr/0024-realtime-presence-sync-trust.md) (realtime)
- `docs/STATUS.md` — "Phase 2 — first slice" (the vertical-slice tickets this catalog's "Phase-2 driver"
  column points at)
