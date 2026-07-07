# ADR 0022 — Walking Skeleton / Golden Use Cases (architecture-validation gate)

- **Status:** Accepted
- **Date:** 2026-07-07 (accepted via PR #60, issue #42)
- **Deciders:** project owner + AI agents
- **Depends on:** [ADR 0003](0003-overall-architecture.md) (§1 dependency rule, §3 module map, §9
  bounded contexts), [ADR 0004](0004-event-sourcing-cqrs.md) (§2 envelope, §3 command handling, §5
  projections, §9 determinism, §10 `describe()`), [ADR 0005](0005-persistence-and-sync.md) (§3 sync
  push/pull, §4 domain rebase), [ADR 0006](0006-plugin-system.md) (§3 SDK Definition/Behaviour APIs,
  §5 in-process first-party, §9 rule-system binding), [ADR 0020](0020-core-vs-plugin-boundary.md)
  (trait meta-model + revisable boundary cases), [ADR 0021](0021-rules-execution.md) (formula AST,
  roll model, seeded RNG), [ADR 0017](0017-testing-strategy.md) (test layers, determinism/fixtures,
  sync-simulation harness). **Informs (does not yet decide):** ADR 0012 (frontend), ADR 0011 (§12 API
  framework), ADR 0015 (consent), ADR 0023 (event-payload privacy)

## Context

The accepted ADRs describe Grimora's bounded contexts (ADR 0003 §9) and its rule-agnostic trait
meta-model (ADR 0020) at a deliberately **abstract** level. The 2026-07-07 external ADR review
(`docs/STATUS.md`) named the risk this creates: an abstract architecture can be internally consistent
on paper yet still be *mis-abstracted* — the meta-model too generic to be usable, or secretly
DSA5-specific — and that only shows up against **real code**. A thin vertical slice ("walking skeleton")
is the cheap way to find out **which decisions actually hold and which further ADRs actually block**,
before broad Phase-2 code hardens the wrong shapes.

This ADR is a **gate document**, not a product feature: it defines the slice, its scope boundaries, and
the **pass criteria** that let the Phase-1→Phase-2 transition proceed. It was written **after** a full
architecture validation pass across all 13 accepted ADRs against the golden use case in issue #42; the
findings from that pass (F1–F7 below) are folded directly into the decisions here rather than
rediscovered during implementation.

**Repo state at the time of writing:** only `packages/shared-types` has real code (the pre-extension
`EventEnvelope`, `Result`, `EntityId`); `apps/` and `plugins/` do not physically exist yet (bun
tolerates the empty workspace globs; the full local chain — install/lint/typecheck/arch/test/build — is
green). The forward-looking `arch` fitness functions (issue #9) therefore match nothing today and begin
enforcing the moment the skeleton adds `core-domain`, `plugin-sdk`, and `plugins/dsa5` — which is itself
one of the things the skeleton validates.

**Blocking ADRs now exist.** The slice exercises rules execution (ADR 0021, Accepted) and testing
(ADR 0017, Accepted), the two ADRs the external review said had to precede it; nothing the slice needs
is still `Planned` **once this ADR scopes the UI out** (F1 below).

## Decision

### 1. What the walking skeleton is — and is not

The skeleton is a **thin, end-to-end vertical slice through the core** that demonstrates the golden use
case (§2) against real code. It is explicitly:

- **A validation gate, not a shipped feature** — its success criterion is "the architecture holds," not
  "a user can do X in production."
- **Scoped to the core/backend slice, not a UI end-to-end** (finding **F1**). ADR 0017 §1 calls the
  walking skeleton "the canonical first E2E suite" (Playwright, layer 5), but a Playwright E2E needs a
  running app (`apps/web`), which needs ADR 0012 (frontend rendering/state — still `Planned`). Rather
  than block the skeleton on 0012, this ADR **resolves that tension by scoping**: the skeleton validates
  `command → domain → event store → projection → read model → sync harness → authorization`, and the
  Playwright UI-E2E version is explicitly deferred until after `apps/web` exists (ADR 0012). This keeps
  the most load-bearing ADRs (0003/0004/0005/0006/0020/0021) validated now, without prematurely deciding
  frontend questions.
- **Allowed to be provisional** (see §3) — the skeleton may concretize shapes that later ADRs will
  formally freeze, provided it labels them as provisional and does not silently harden them.

### 2. The golden use-case slice (scoped to layers, per F1/F6)

The ten steps from issue #42, each mapped to the layer it exercises and how the skeleton demonstrates it:

| # | Step | Exercised layer / ADR | How the skeleton shows it |
| --- | --- | --- | --- |
| 1 | User creates a campaign | Domain aggregate + event store (0004/0020) | `campaign.created` event appended; provisional owner = creator (§7) |
| 2 | Enable DSA5 plugin | Plugin host + registry (0006 §9) | DSA5 plugin registered in-process (0006 §5); rule-system bound to the character |
| 3 | Create a character | Domain aggregate (0020) | `character.created` with plugin provenance (0006 §4) |
| 4 | Plugin supplies attribute schema | Definition API (0006 §3, 0020) | DSA5 declares trait definitions (provisional shape, §3) |
| 5 | Character gets generic attributes | Trait container (0020) | attributes stored generically (abstract ids, no copyrighted names/values) |
| 6 | Execute a check/roll | Rules runtime (0021) | formula AST evaluated; `RollRequest`→`RollResult` via plugin resolution fn; seeded RNG |
| 7 | Store roll as an event | Event store (0004 §2, 0021 §4) | `character.checkRolled` with extended envelope (§4) |
| 8 | Read model shows sheet + history | Projection + `describe()` (0004 §5/§10) | **read-model data + rendered event history asserted** — not a themed UI (F6; theming/UI = 0007/0012, deferred) |
| 9 | Offline edit later syncs | Sync harness (0005 §3/§4, 0017 §1) | in-memory multi-client harness drives push/pull/rebase; asserts convergence |
| 10 | AI runs the same use case only after authz | AI tool path (0008 §2, 0009) | fake `AiProviderPort`; tool call hits the **same** `PolicyPort` as the UI path (§7) |

### 3. Provisional SDK / meta-model shapes (finding F2)

The skeleton **must** concretize the trait meta-model's data shape (attribute/skill definitions) and the
plugin registration surface (`definePlugin`/`register`, Behaviour-API signatures) to run — yet **no
accepted ADR pins those shapes**, and defining a public SDK contract is a `CLAUDE.md` stop-and-ask item.

**Decision:** the skeleton's SDK and trait-meta-model shapes are **provisional v0 validation artifacts,
explicitly not the frozen public contract.** They live in `packages/plugin-sdk` and `packages/core-domain`
marked as such (module doc-comments + a note in the package README). The formal **plugin-SDK v0 freeze**
gets its **own dedicated ADR** (**R3**), informed by the skeleton's findings but not constituted by them —
because the SDK is a public, third-party-facing contract (a `CLAUDE.md` stop-and-ask surface) that
deserves its own reviewable decision rather than being buried in the gate's implementation. This
provisional-shape discipline is what makes the "keep the code" choice (**R1**, §10) safe: the skeleton
concretizes enough to run without silently hardening the SDK contract that ADR 0006 owns.

### 4. Event envelope extension (finding F3)

The skeleton pulls in the **ADR 0004 §2 envelope extension** that `shared-types` does not carry yet:
`aggregateType`, `schemaVersion`, `metadata` (`actorId`/`correlationId`/`causationId`/`context`), a
UUIDv7 `id`, and `PersistedEvent = EventEnvelope + store-assigned position`. Per ADR 0004 §2 (Accepted),
the extended envelope lives in `@grimora/shared-types` — this ADR does **not** re-decide that. **Note for
the harness:** when the `shared-types` leaf-guard fitness function (external-review constraint A) is
implemented, it must **permit** these generic event-sourcing infrastructure fields (including
`metadata.context`'s `sessionId`/`deviceId`/`participantsPresent`) — they are ES infrastructure, not
domain or plugin vocabulary, so they do not violate the leaf rule. (The genuinely borderline "where does
`metadata.context` live" nuance is raised as **O2** only to the extent it interacts with the leaf-guard;
the envelope itself follows 0004 §2.)

### 5. Determinism as the validation backbone (positive finding)

The skeleton runs **entirely deterministically and without real infrastructure** — no Docker, no
Supabase, no network. This is possible because the accepted ADRs already compose into a coherent
deterministic spine: fake `ClockPort`/`IdGeneratorPort` + seeded RNG (ADR 0004 §9, ADR 0021 §3) +
deterministic projections (ADR 0004 §5) + the in-memory multi-client sync-simulation harness (ADR 0017
§1). Every layer of the slice is validated with fakes; real SQLite/Postgres/MinIO adapters are **out of
scope** for the gate (they get their own contract tests per ADR 0017 §1 when built). This is a genuine
architectural strength the skeleton leans on, not something it has to invent.

### 6. Roll-vs-rebase assertion (finding F4)

A subtle interaction the skeleton must assert explicitly: ADR 0021 §3 derives the roll seed from the
aggregate stream id + a per-aggregate roll sequence number, while ADR 0005 §4 can **rebase** an event to
a new version during sync. A roll is an **immutable fact** (ADR 0004): ADR 0021 §4 stores the full
`RollResult` in the `character.checkRolled` event, so a rebased/synced roll **carries its already-rolled
result and does not re-roll**. This is *implied* by both ADRs but stated by neither, so the skeleton
**asserts it directly** (a rebased roll event's result equals its pre-rebase result). If that assertion
turns out awkward or false in practice, it triggers a one-line clarifying amendment to ADR 0021/0005 —
exactly the kind of latent seam this gate exists to surface.

### 7. Provisional minimal authorization + AI parity (findings F5, and step 10)

The full authorization matrix (concrete roles × actions × resources, co-GM, invites, ownership transfer)
is deliberately deferred (external-review P0 #15, backlog Epic #52). The skeleton therefore uses a
**provisional minimal** model — **creator = owner/GM of the aggregate they created** — behind a minimal
`PolicyPort`, and **explicitly flags it as not the final authz matrix**. Step 10 validates the property
that actually matters architecturally: an AI **tool call runs the same use case through the same
`PolicyPort` as the UI path** (ADR 0008 §2, ADR 0009), using a **fake `AiProviderPort`** — no external
provider, no consent flow (that is ADR 0015's, and the skeleton uses the local/no-consent path by
construction). "AI may run it only after authorization" is proven by showing an unauthorized actor's
tool call is rejected by the *same* policy check that rejects it in the UI path.

### 8. Fake, non-personal data (finding F7)

The skeleton uses **obvious fake, non-personal data** (invented fantasy names, no real persons), so it
**does not exercise crypto-shredding** (ADR 0010 §6) or the event-payload privacy classification
(ADR 0023, deliberately deferred to before *real* aggregates). This is consistent with both the
`CLAUDE.md` guardrail ("no real personal data … in tests, fixtures, snapshots") and ADR 0023's trigger
("before real aggregates"): the skeleton is a validation artifact, not real user data, so it does not
prematurely pull ADR 0023 forward.

### 9. Pass criteria (the gate)

The skeleton **passes** — unblocking broad Phase-2 build — when all of the following are demonstrated by
deterministic tests (ADR 0017):

1. Each of the ten steps (§2) is exercised end-to-end through the core slice.
2. **Replay determinism:** folding a stream twice, and rebuilding the read model from `position 0`,
   yields byte-identical state (ADR 0004 §5/§9).
3. **Sync convergence:** the multi-client harness, after concurrent offline edits + rebase, converges to
   identical state on all clients (ADR 0005 §4).
4. **Roll carry:** a rebased roll event keeps its original result (§6).
5. **Authz parity:** the AI tool path and the UI path hit the same `PolicyPort`; an unauthorized actor is
   rejected identically on both (§7).
6. **Boundaries hold on real code:** adding `core-domain`/`plugin-sdk`/`plugins/dsa5` keeps `bun run arch`
   green — the forward-looking dependency/plugin-import rules (issue #9) now bite on real modules.

A **fail** is a finding, not a defect to hide: if a step cannot be built cleanly, or an ADR 0020
boundary-case proves mis-placed (e.g. something core turns out to belong in the plugin, or vice versa),
the outcome is a recorded boundary revision — via an owner-authorized amendment or a superseding ADR
(ADR 0001/0020's revisitation clause) — **before** Phase-2 code hardens it.

### 10. What the skeleton builds, and what it explicitly does not

**Builds (minimal, provisional):** `packages/core-domain` (the campaign/character aggregates, ports,
minimal `PolicyPort`, projection), `packages/plugin-sdk` (v0 provisional surface, §3), `plugins/dsa5`
(mechanics/structure only — no copyrighted Ulisses content, per `docs/legal/dsa5-content-boundary.md`),
in-memory adapter fakes (event store, read-model store, clock, id, RNG, AI provider), and a thin
**runnable entry** (a script/CLI that "walks" the golden path once for observation — true to a *walking*
skeleton and to `CLAUDE.md`'s "verify by exercising it end-to-end"), in addition to the test suites.

**Confirmed R1 (kept, not throwaway):** this code is the **seed** the real `core-domain`/`plugin-sdk`
grows from — kept, not deleted after validation — made safe by the provisional-shape discipline (§3) and
the dedicated SDK-v0 freeze ADR (R3). **Confirmed R2 (DSA5 depth):** the DSA5 slice is **minimal but
spans different trait *kinds*** — one attribute, one derived value (via a formula, ADR 0021), and one
skill check — deliberately not three of the same kind, so the meta-model (ADR 0020) is stressed across
categories rather than merely covered; broader DSA5 content is Phase-3 work.

**Does not build:** `apps/web` (ADR 0012), the `apps/api` HTTP/OpenAPI adapter (ADR 0011 §12 framework
deferred), real SQLite/Postgres/MinIO adapters, the untrusted-plugin sandbox (ADR 0006 §5 — first-party
DSA5 runs in-process), and any themed UI (ADR 0007). These are validated later, when their owning ADRs
are decided; the gate does not wait on them.

**Phase framing:** creating these provisional packages is part of the **Phase-1 validation gate**, not
the start of unblocked Phase-2 build. Epic #10 (Phase 2) stays blocked until the gate passes and the
resulting boundary findings are folded back into the ADRs.

## Consequences

**Positive:** the most load-bearing ADRs (0003/0004/0005/0006/0020/0021) get validated against real code
**cheaply and deterministically** (no infra); the meta-model's "just abstract enough" risk (ADR 0020) is
de-risked before it hardens; the skeleton reveals which further ADRs actually block Phase 2 (rather than
writing them speculatively); the 0017↔0012 E2E tension is resolved by explicit scoping; several latent
seams (F3/F4) become explicit assertions instead of future surprises.

**Negative / costs:** the skeleton is **provisional** effort — kept as the seed of the real core (R1),
not thrown away, but its SDK/meta-model shapes (§3) risk being mistaken for the frozen contract if the
"provisional v0" labeling is not disciplined (mitigated by R3's dedicated freeze ADR); scoping the UI out
(F1) means frontend integration (ADR 0012) and real-adapter behavior are validated **later**, so the gate
proves the core holds, not that the whole product stack does. These are accepted trade-offs: validating
the core cheaply now is worth more than a slower, infra-heavy full-stack slice that also front-runs
undecided frontend ADRs.

## Alternatives considered

- **A full UI-to-storage E2E now** (Playwright through `apps/web`) — rejected: blocked on ADR 0012
  (frontend, `Planned`) and would force premature frontend decisions; the core slice validates the
  higher-risk ADRs first.
- **Skip the skeleton, go straight to Phase-2 core** — rejected: this is exactly what the external review
  warned against; the meta-model would harden untested and boundary mistakes (ADR 0020) would be
  expensive to unwind later.
- **Build the skeleton as production-grade core from day one** (no "provisional" allowance) — rejected:
  conflates validation with the real build and would silently freeze the SDK contract (F2) that ADR 0006
  and a later SDK-v0 step own.
- **A pure paper/diagram validation** (no code) — rejected: the whole point of the finding is that
  abstract consistency ≠ buildable; only real code reveals a mis-abstracted meta-model.

## Resolved questions (owner decisions, 2026-07-07)

All three review questions were resolved by the owner (following the recommended default in each case);
the decisions above already reflect them.

- **R1 — Throwaway spike vs. seed.** *Confirmed: seed, with provisional-shape discipline* (§10). The
  skeleton code is **kept** as the seed the real `core-domain`/`plugin-sdk` grows from — not deleted
  after validation. Throwaway would be cleaner but wasteful for a solo/pre-revenue project; the "seed"
  risk (provisional shapes silently hardening) is contained by §3's explicit "provisional v0" labeling
  plus the dedicated SDK-v0 freeze ADR (R3).
- **R2 — DSA5 depth.** *Confirmed: minimal, spanning different trait kinds* (§10). One attribute, one
  derived value (via a formula), and one skill check — deliberately across *different kinds* so the
  meta-model (ADR 0020) is stressed by category variety, not merely covered. Broader DSA5 content is
  Phase-3 work; the gate is about the seams between layers, not DSA5 coverage.
- **R3 — SDK-v0 freeze location.** *Confirmed: its own dedicated ADR* (§3). Freezing the public
  plugin-SDK v0 contract — informed by, but not constituted by, the skeleton — gets a dedicated,
  reviewable ADR rather than an ADR 0006 amendment or a buried skeleton follow-up, because the SDK is a
  public, third-party-facing contract (a `CLAUDE.md` stop-and-ask surface).

## References

- [ADR 0003](0003-overall-architecture.md) (§1 dependency rule, §3 module map, §9 bounded contexts),
  [ADR 0004](0004-event-sourcing-cqrs.md) (§2 envelope/`position`, §3 commands, §5 projections, §9
  determinism, §10 `describe()`), [ADR 0005](0005-persistence-and-sync.md) (§3 push/pull, §4 rebase),
  [ADR 0006](0006-plugin-system.md) (§3 SDK APIs, §5 in-process first-party, §9 rule-system binding),
  [ADR 0020](0020-core-vs-plugin-boundary.md) (trait meta-model, revisitation clause),
  [ADR 0021](0021-rules-execution.md) (formula AST, roll model, seeded RNG), [ADR 0017](0017-testing-strategy.md)
  (test layers, determinism/fixtures, sync-simulation harness), ADR 0008 (§2 AI authz parity), ADR 0009
  (`PolicyPort`), ADR 0010 (§6 crypto-shredding — not exercised), ADR 0011 (§12 API framework deferred),
  ADR 0012 (frontend — deferred UI E2E), ADR 0015 (consent — not exercised), ADR 0023 (event-payload
  privacy — not exercised), [`docs/legal/dsa5-content-boundary.md`](../legal/dsa5-content-boundary.md).
  Issue #42.
