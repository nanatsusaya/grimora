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

### 2. Sync-trust model — hard server enforcement of tenancy/provenance; own-aggregate fabrication is social contract (O1)

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
**higher-trust modes are opt-in** for competitive contexts (server-side revalidation, GM-verified or
commit-reveal rolls — §3, O1). This makes ADR 0010 §1's "forged sync events" boundary **precise**:
cross-tenant forgery is mitigated **hard**; own-aggregate fabrication is a **named, bounded** residual, not
a silent hole. *(This refines ADR 0010 §1's threat row → §10 flagged amendment.)*

### 3. Unpredictable seeds for online rolls (fairness) — server-contributed entropy (O3)

ADR 0021 §3's seed (stream id + sequence number) is fine for **offline/solo** replay but is **predictable**
in shared play. Decision: an **online/shared** roll's seed must mix in **entropy the rolling client cannot
predict** — a **server-issued roll nonce** folded into the seed derivation, so no participant can precompute
the outcome. `RollResult.seed` (ADR 0021 §3) records the nonce alongside the existing inputs, preserving
**auditability and replay** (the nonce is part of the recorded derivation). Offline/solo rolls keep the
pure-deterministic seed but are **flagged lower-trust** (acceptable for solo/cooperative). **Commit-reveal**
(the stronger mutual scheme) is **deferred** unless real competitive play needs it (O3). *(Adding
server-nonce entropy changes ADR 0021 §3's seed derivation → §10 flagged amendment.)*

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

Three accepted ADRs would need a small **owner-authorized amendment** (ADR 0001) to stay consistent with
this ADR; they are **flagged, not edited**, and become amendment PRs once O1/O3 are resolved:

- **ADR 0021 §3** — fold a server-contributed nonce into the seed derivation for online rolls (§3, O3).
- **ADR 0021 §2** — clarify that `visibility` is enforced by stream routing/encryption, not a client filter
  (§4).
- **ADR 0010 §1** — point the "forged sync events" tampering row at this ADR's precise sync-trust model
  (§2).

## Consequences

**Positive:** the ephemeral/durable split keeps a single source of truth (the event log) while enabling
live co-play; **sync-trust is made honest** — cross-tenant forgery is hard-blocked, own-aggregate
fabrication is a named/bounded social-contract residual rather than a pretended mitigation; online rolls
become **unpredictable** without losing auditable replay; **visibility** finally has a real enforcement
mechanism (stream routing) instead of a toothless flag; the **late-join backfill** closes a concrete
data-loss gap **additively**; presence is cleanly ephemeral, so it never pollutes the immutable log or
erasure model.

**Negative / costs:** a realtime transport + `RealtimePort` is new infrastructure to build and operate
(reconnection, backpressure, scaling — budgets are ADR 0013's); visibility-by-routing multiplies the number
of streams (a campaign now has audience-scoped sub-streams) and adds routing logic; server-nonce rolls add
a round-trip for online rolls and a required ADR 0021 amendment; the social-contract trust default (O1)
means the platform does **not** cryptographically prevent a player from fabricating **their own** rolls —
an accepted, bounded limit for a cooperative TTRPG, revisited only if competitive play demands it.

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

## Open questions (for owner review)

- **O1 — Sync-trust / anti-cheat level (§2).** Confirm the **social-contract default** — the server
  hard-enforces authorization, actor-binding, provenance and cross-aggregate integrity, but does **not**
  re-execute rules to prevent a player fabricating **their own** aggregate's events — with higher-trust
  modes (server-side revalidation, GM-verified / commit-reveal rolls) **opt-in** for competitive contexts?
  **Recommendation: yes** — it matches a cooperative TTRPG's real trust model (you could lie at a physical
  table too) and offline-first, keeps everything attributable, and avoids over-building anti-cheat; build a
  higher-trust mode only when real competitive play needs it. (Product/security call.)
- **O2 — Realtime transport (§6).** **Supabase Realtime** (managed, already in the stack, self-hostable) vs.
  a **custom WebSocket** service vs. **SSE** — all behind `RealtimePort`. **Recommendation: Supabase
  Realtime**, least new infrastructure and consistent with ADR 0002/0009, swappable via the port if we
  outgrow it. (Infra/vendor call.)
- **O3 — Online-roll fairness mechanism (§3).** **(a)** server-contributed **nonce entropy** (recommended;
  needs an ADR 0021 §3 amendment), **(b)** full **commit-reveal** (strongest, more round-trips/UX), or
  **(c)** accept predictability (rejected for competitive). **Recommendation: (a) now** — unpredictable and
  cheap, keeping auditable replay — with **(b) deferred** to if/when competitive play needs it. Confirming
  (a) authorizes the flagged ADR 0021 §3 amendment (§10).

## References

- [ADR 0004](0004-event-sourcing-cqrs.md) (durable event log, version/position, immutable history),
  [ADR 0005](0005-persistence-and-sync.md) (§3 pull/push + checkpoints, §4 domain rebase, §7
  stream-granular RLS), [ADR 0009](0009-cross-cutting-concerns.md) (§3 auth/authz + RBAC, RLS
  defense-in-depth), [ADR 0010](0010-security-and-privacy-by-design.md) (§1 STRIDE — forged-sync-events
  row), [ADR 0011](0011-api-design.md) (§7 sync endpoints, §8 SSE-for-AI + realtime routed here),
  [ADR 0021](0021-rules-execution.md) (§2 roll visibility, §3 seeded RNG), [ADR 0023](0023-event-payload-privacy.md)
  (per-audience encryption, presence classification), ADR 0012 (conflict-UX — Planned), ADR 0013
  (latency/backpressure budgets — Planned), ADR 0019 (presence vs. analytics — Planned). Issue #44.
