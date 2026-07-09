# ADR 0024 — Realtime session, presence & sync-trust

- **Status:** Proposed
- **Date:** 2026-07-09
- **Deciders:** project owner + AI agents
- **Depends on:** [ADR 0004](0004-event-sourcing-cqrs.md) (§2 event/version/position, immutable durable
  log), [ADR 0005](0005-persistence-and-sync.md) (§3 pull/push sync + checkpoints, §4 domain rebase, §7
  stream-granular RLS/replication), [ADR 0009](0009-cross-cutting-concerns.md) (§3 `AuthPort`/
  `AuthorizationPort`/`PolicyPort` + RBAC, RLS defense-in-depth), [ADR 0010](0010-security-and-privacy-by-design.md)
  (§1 STRIDE threat model — the "forged sync events"/tampering row this ADR makes precise),
  [ADR 0011](0011-api-design.md) (§7 sync endpoints + per-event partial success, §8 SSE-for-AI +
  "bidirectional realtime/presence out of scope → ADR 0024"), [ADR 0021](0021-rules-execution.md) (§2
  roll `visibility` field, §3 seeded-RNG seed derivation), [ADR 0023](0023-event-payload-privacy.md)
  (per-subject/per-audience key model reused for hidden content; classification of presence data).
  Relates to ADR 0012 (conflict-UX / presentation — Planned), ADR 0013 (latency/backpressure budgets —
  Planned), ADR 0019 (presence vs. analytics boundary — Planned).

## Context

ADR 0005 decided the **durable, offline-first event-log sync** (insert-only, dedupe-by-`id`, domain
rebase) — the authoritative write path. It deliberately did **not** decide the **live-collaboration
tier**: "playing together" needs an **ephemeral/realtime** layer distinct from the durable log
(issue #44), and ADR 0011 §8 explicitly routed "bidirectional realtime/presence transport" here.

The 2026-07-09 parallel cross-model ADR review (ChatGPT + Claude Fable) additionally surfaced three
**distributed-reality gates** that live in exactly this layer and that the walking skeleton (in-memory,
single-device) never exercised — this ADR owns them so they do not harden into the sync protocol:

1. **Sync-trust / integrity.** ADR 0005 §3 has clients **push events**; the server checks authorization
   + version, but not domain **semantics**. Both reviewers flagged (the strongest shared finding) that a
   malicious client could push **domain-valid-looking but fabricated** events (a forged roll, a skipped
   cost). ADR 0010 §1's "forged sync events" mitigation row reads as if this is fully handled — it is not,
   for a client's **own** aggregate.
2. **Roll-seed predictability.** ADR 0021 §3 derives the roll seed from the stream id + a per-aggregate
   sequence number — both known to every participant — so a client can **precompute its next roll** and
   choose whether/when to roll (a timing/fairness cheat in shared play).
3. **Checkpoint backfill.** ADR 0005 §3's single global "last-pulled cloud position" checkpoint means a
   member **added to a campaign later** has a checkpoint already **beyond** the historical events of the
   newly-authorized stream — a plain `since=position` pull **misses** them.

Plus the **visibility** gate: ADR 0021 §2 gave rolls a `visibility: public|gmOnly|private` field but no
enforcement, while ADR 0005 §7 sync/RLS is **stream-granular** — so a `gmOnly` event in a shared stream
physically replicates to every member's device, making client-side "hiding" worthless.

**Repo state:** Phase 1 — no realtime code, no real sessions, no cloud sync running. This is a decision
record shaping the protocol before Phase 2. It **reuses** ADR 0005 (durable sync) and ADR 0023 (keys)
unchanged and **flags** — rather than silently makes — the few refinements to accepted ADRs it implies
(§10), for owner authorization.

## Decision

### 1. Two tiers: durable event log (ADR 0005) vs. ephemeral realtime (this ADR)

The **durable** tier (ADR 0005) stays the **single source of truth**: every state change that matters is
an event on the log, synced via `POST /sync/push` / `GET /sync/pull` (ADR 0011 §7). The **realtime** tier
this ADR adds is a **liveness + coordination** layer — presence, "new events available" signals, transient
selections — that is **never a second source of truth**: a realtime message can **never** be the origin of
a durable state change (§6, §7). This split is the load-bearing decision; everything below follows from it.

### 2. Sync-trust model — hard server enforcement of tenancy/provenance; own-aggregate fabrication is social contract (R1)

On `POST /sync/push` (ADR 0011 §7) the server **hard-enforces**, rejecting the batch otherwise:

- **Authentication + actor-binding** — the authenticated pusher is the event's authorized actor; a client
  **cannot impersonate** another `actorId` (ADR 0009 §3).
- **Stream authorization** — the pusher may write **only** streams it is authorized for (RLS + `PolicyPort`,
  ADR 0005 §7 / ADR 0009 §3); **cross-aggregate / cross-tenant tampering is blocked**.
- **Optimistic concurrency** — per-aggregate `version` (ADR 0004); stale writes → `409` → client rebase.
- **Schema + privacy-classification validity** — every event validates against its schema and has a
  complete privacy classification (ADR 0023 §2), or it is rejected.
- **Provenance** — `pluginId`/`version` (ADR 0006 §4) recorded and required.

What the server does **not** do by default: **re-execute the domain/plugin rules** to prove a client's
event about **its own aggregate** (a roll result, a spent resource) is *mechanically* legitimate. Full
server-side revalidation would require running plugins server-side and **contradicts offline-first**
("device is source of truth", ADR 0005). So **own-aggregate domain fabrication is a social-contract
matter by default** — a player could fabricate their own roll exactly as they could lie at a physical
table — **bounded** by three hard facts: it can **never** affect another player's aggregate (stream authz);
it is **fully attributable and auditable** (immutable log + provenance, ADR 0004/0010 §1 Repudiation); and
**higher-trust modes are opt-in / deferred** for any future competitive context (server-side revalidation,
GM-verified or commit-reveal rolls — R1). This makes ADR 0010 §1's "forged sync events" boundary **precise**:
cross-tenant forgery is mitigated **hard**; own-aggregate fabrication is a **named, bounded** residual, not
a silent hole. *(This refines ADR 0010 §1's threat row → §10 flagged amendment.)*

### 3. Rolls stay deterministic and (accepted) predictable — no server entropy now (R3)

Rolls remain **deterministic** in the ADR 0021 §3 sense — the seed derivation (stream id + per-aggregate
sequence number) is **unchanged**, so `RollResult.seed` keeps every roll **reproducible and auditable**
(anti-repudiation, ADR 0010 §1), keeps event-folding a **pure function** (replay convergence, ADR 0004 §9),
keeps plugin behaviour free of ambient entropy (ADR 0010 §3), and keeps tests reproducible (ADR 0017).

A deterministic seed derived from **public** inputs is also **predictable in advance** (a client could
precompute its next roll — a timing nuance). This ADR **accepts that predictability**: Grimora is a
**cooperative hobby TTRPG**, not a competitive or for-stakes context, so the timing nuance is handled by the
**same social contract as §2/R1** (bad-faith players leave the social group), and unpredictability machinery
would be over-engineering. Note that *determinism-on-replay* and *unpredictability-in-advance* are **not**
opposites — a **server-contributed seed nonce** (or full commit-reveal) would keep the roll fully
reproducible (the nonce is simply recorded in `RollResult.seed`) while making it unpredictable before the
roll. That machinery is therefore **not rejected, only deferred** — trigger-gated to if/when real **online
play with untrusted groups** exists. Consequently the ADR 0021 §3 seed derivation is **unchanged** (no
amendment — see §10).

### 4. Visibility is enforced by stream routing, not a client-side flag

ADR 0021 §2's `visibility` cannot be enforced client-side (the event is already on every member's device).
Decision: **visibility is realized by *routing* the event to a stream whose authorization matches its
audience** (ADR 0005 §7 stream-granular RLS), not by a client-side filter:

- `gmOnly` → written to a **GM-scoped (sub-)stream** players are **not authorized to pull** (so it never
  reaches their devices).
- `private` → an **owner-scoped stream**.
- `public` → the shared campaign stream.

For content that must live in an otherwise-shared stream yet stay hidden from some members (e.g. a hidden
annotation on a shared map), the fallback is **per-audience payload encryption** reusing the ADR 0023 key
model (encrypt for the authorized audience's key; it replicates to all but only they can decrypt). This
**fills the enforcement ADR 0021 §2 left open** (net-new); a clarifying cross-reference in ADR 0021 §2 is a
minor §10 flagged amendment.

### 5. Backfill on access grant (additive to ADR 0005 §3)

To close the late-join gap: on a **membership/authorization grant**, the client performs an **initial full
backfill pull of the newly-authorized stream from its start**, **independent** of its global checkpoint
(the server now serves that stream's history because RLS authorizes it). The global "last-pulled position"
checkpoint (ADR 0005 §3) continues to drive the **incremental** path. This is **purely additive** — a new
"on-grant backfill" step — so **ADR 0005 needs no amendment**. Symmetrically, on membership **revocation**
the already-replicated data on the ex-member's device is handled by the ADR 0023 §5 redaction/purge path
and its honest residual boundary (ADR 0023 R2) — named here, not re-decided.

### 6. Realtime delivery — a liveness signal over the pull-based sync (transport: O2)

Durable sync is pull-based (ADR 0005 §3 / ADR 0011 §7); clients need to learn **promptly** that new events
exist. A **`RealtimePort`** carries a lightweight **"new events available for stream X"** notification
(optionally the small changed envelope) that **triggers the client's normal authenticated pull** — the
realtime channel is a **liveness signal, not an authoritative write path**. Properties:

- **No durable write bypasses the trust checks (§2):** a realtime message can never be the source of a
  durable state change; all writes still go through `POST /sync/push`.
- **Channel authorization reuses stream scope:** a client may subscribe only to streams it is authorized
  for (RLS, ADR 0005 §7) — the realtime layer adds **no new authorization surface**.
- **Transport is swappable behind `RealtimePort`** — candidate **Supabase Realtime** (already in the stack,
  ADR 0002/0009; available in the self-hosted Supabase too), or a custom WebSocket / SSE (**O2**).

### 7. Presence & transient state is ephemeral — never event-sourced

**Presence** and transient coordination (who's online, whose turn *as a live hint*, cursors, typing,
transient map/token selections) are **ephemeral**: they live **only** on the `RealtimePort` channel, are
**never** written to the event store or read-model store (**fitness function, §9**), and are **lost on
disconnect** (reconnect re-establishes them). The distinction is:

- **Transient coordination** → realtime/ephemeral (this ADR).
- **Durable outcome** (a session *started*, an initiative order *committed*, a scene *changed*) → an
  **event** on the durable log (ADR 0004), synced normally.

**Presence is personal data** (who is online, when, with whom): it is **minimized**, **scoped to the
campaign audience**, and classified/consented per ADR 0023 where it reveals personal information; it is not
retained (ephemeral) and thus carries no erasure burden.

### 8. Reconnect & live-conflict UX reuse the durable rebase (no second conflict model)

On reconnect a client re-pulls (incremental + the §5 backfill for anything newly authorized) and
re-subscribes; presence re-establishes from scratch. **Concurrent edits during live play still resolve via
the ADR 0005 §4 domain rebase** — the realtime tier introduces **no second conflict-resolution model**; it
only makes a conflict **visible sooner**. Surfacing a genuine semantic clash to the GM/user (conflict-UX) is
a **presentation** concern reserved to **ADR 0012**; this ADR only guarantees the data to drive it exists.

### 9. Enforcement (fitness functions)

- **Presence/transient state is never persisted** — no realtime/presence adapter writes to the
  `EventStorePort` or `ReadModelStorePort` (ephemeral-only), asserted by the harness (ADR 0003 §2 / 0010 §7).
- **No authoritative write via the realtime channel** — the `RealtimePort` adapter has **no** path to the
  event store; every durable write goes through `SyncPort`/the command path with the §2 trust checks.
- **Visibility = routing** — a `gmOnly`/`private` event written to a shared (broader-audience) stream is a
  boundary violation (it must go to its audience-scoped stream, §4).
- **Server-side push enforcement (§2)** — `POST /sync/push` enforces actor-binding + stream authorization +
  `version` + schema/classification before accepting an event (contract/integration test on `apps/api`).

### 10. Refinements to accepted ADRs — flagged for owner authorization, not made here

Two small **owner-authorized amendments** (ADR 0001) would keep accepted ADRs cross-referenced with this
ADR; they are **flagged, not edited**, to become amendment PRs **if** the owner authorizes them. Neither is
consistency-critical — nothing in those ADRs is now *false*; these are completeness cross-references:

- **ADR 0021 §2** — add a cross-reference that roll `visibility` is *enforced* by stream routing /
  per-audience encryption (§4), which ADR 0021 left unspecified.
- **ADR 0010 §1** — point the "forged sync events" tampering row at this ADR's precise sync-trust model
  (§2), so the threat model reflects the cross-tenant-hard / own-aggregate-social-contract split.

*(The previously-flagged ADR 0021 §3 seed-derivation amendment is **no longer needed** — R3 keeps the
deterministic seed unchanged.)*

## Consequences

**Positive:** the ephemeral/durable split keeps a single source of truth (the event log) while enabling
live co-play; **sync-trust is made honest** — cross-tenant forgery is hard-blocked, own-aggregate
fabrication is a named/bounded social-contract residual rather than a pretended mitigation; rolls stay
**deterministic and auditable** with no added machinery (R3); **visibility** finally has a real enforcement
mechanism (stream routing) instead of a toothless flag; the **late-join backfill** closes a concrete
data-loss gap **additively**; presence is cleanly ephemeral, so it never pollutes the immutable log or
erasure model.

**Negative / costs:** a realtime transport + `RealtimePort` is new infrastructure to build and operate
(reconnection, backpressure, scaling — budgets are ADR 0013's); visibility-by-routing multiplies the number
of streams (a campaign now has audience-scoped sub-streams) and adds routing logic; the social-contract
trust default (R1) plus predictable seeds (R3) mean the platform does **not** cryptographically prevent a
player from fabricating or precomputing **their own** rolls — an accepted, bounded limit for a cooperative
hobby TTRPG, revisited (server revalidation / seed nonce, both trigger-gated) only if untrusted/competitive
play ever demands it.

## Alternatives considered

- **Full server-side revalidation of every pushed event** (re-run domain + plugins server-side) — rejected
  as the default: contradicts offline-first "device is source of truth" (ADR 0005), forces server-side
  plugin execution, and over-engineers anti-cheat for a cooperative game; kept as an **opt-in** higher-trust
  mode (O1).
- **Event-sourcing presence/cursors** — rejected: presence is transient coordination, not durable history;
  logging it would bloat the immutable log and the erasure model for data that is meaningless after
  disconnect.
- **A second (realtime) source of truth** (authoritative writes over the realtime channel) — rejected:
  splits truth across two paths, bypasses the §2 trust checks and the ADR 0005 rebase model; realtime stays
  a liveness signal only.
- **Client-side visibility filtering** (keep `visibility` as a display flag) — rejected: the event is
  already on every member's device; only stream routing / encryption actually hides it (§4).
- **Per-stream checkpoints replacing the global checkpoint** — considered for §5; rejected in favour of an
  **additive** on-grant backfill so ADR 0005 §3 needs no amendment.
- **Keep predictable seeds** (rely on social contract for all rolls) — rejected for online/competitive
  rolls: precomputable outcomes are a real fairness hole; server entropy is cheap (§3).

## Resolved questions (owner decisions, 2026-07-09)

- **R1 — Sync-trust / anti-cheat level (§2).** **Social-contract default confirmed.** The server
  hard-enforces authorization, actor-binding, provenance, `version` and cross-aggregate integrity (so
  cross-tenant forgery is blocked), but does **not** re-execute rules to prevent a player fabricating
  **their own** aggregate's events. Rationale (owner): it is a **cooperative game** where you should trust
  your table; bad-faith players are removed from the social group sooner or later anyway; everything stays
  attributable. Higher-trust modes (server-side revalidation, GM-verified / commit-reveal rolls) are
  **deferred, opt-in** for any future competitive context — not built now.
- **R2 — Realtime transport (§6).** **Supabase Realtime now**, kept behind the **`RealtimePort`** so it can
  be **swapped for a custom WebSocket service later with manageable effort**. Owner requirement made
  explicit: the abstraction must be present **from day one** — the port is mandatory, the transport is the
  swappable detail (least new infrastructure now, no lock-in).
- **R3 — Roll fairness (§3).** **(c) accept predictability, keep rolls purely deterministic** — the
  ADR 0021 §3 seed is **unchanged** (no server nonce, no commit-reveal). Rationale (owner): Grimora is a
  **hobby TTRPG for personal fun, not a casino / not for stakes**; unpredictability machinery would be
  over-engineering, and the timing nuance is covered by the same social contract as R1. Server-contributed
  entropy / commit-reveal are **not rejected, only deferred** — trigger-gated to if/when real online play
  with **untrusted** groups exists. **Consequence:** the ADR 0021 §3 amendment flagged in §10 is **no longer
  needed**.

## References

- [ADR 0004](0004-event-sourcing-cqrs.md) (durable event log, version/position, immutable history),
  [ADR 0005](0005-persistence-and-sync.md) (§3 pull/push + checkpoints, §4 domain rebase, §7
  stream-granular RLS), [ADR 0009](0009-cross-cutting-concerns.md) (§3 auth/authz + RBAC, RLS
  defense-in-depth), [ADR 0010](0010-security-and-privacy-by-design.md) (§1 STRIDE — forged-sync-events
  row), [ADR 0011](0011-api-design.md) (§7 sync endpoints, §8 SSE-for-AI + realtime routed here),
  [ADR 0021](0021-rules-execution.md) (§2 roll visibility, §3 seeded RNG), [ADR 0023](0023-event-payload-privacy.md)
  (per-audience encryption, presence classification), ADR 0012 (conflict-UX — Planned), ADR 0013
  (latency/backpressure budgets — Planned), ADR 0019 (presence vs. analytics — Planned). Issue #44.
