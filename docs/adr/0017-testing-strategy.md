# ADR 0017 — Testing strategy

- **Status:** Proposed
- **Date:** 2026-07-07
- **Deciders:** project owner + AI agents
- **Depends on:** [ADR 0002](0002-tech-stack-and-tooling.md) (bun test-runner precedent),
  [ADR 0003](0003-overall-architecture.md) (§1 dependency rule, §4 swappability, §6.1 no ambient
  authority, §8 testability), [ADR 0004](0004-event-sourcing-cqrs.md) (§3 command handling, §5
  projections, §6 upcasting, §9 determinism), [ADR 0005](0005-persistence-and-sync.md) (§3 sync
  push/pull, §4 domain rebase), [ADR 0006](0006-plugin-system.md) (§3 SDK Definition/Behaviour APIs),
  [ADR 0009](0009-cross-cutting-concerns.md) (ports, error taxonomy), [ADR 0010](0010-security-and-privacy-by-design.md)
  (§7 security fitness functions — relation, not duplication), [ADR 0011](0011-api-design.md) (§2
  OpenAPI contract), [ADR 0021](0021-rules-execution.md) (§1 formula AST, §3 determinism/seeded RNG)

## Context

ADR 0003 §8 named testability a first-class architectural criterion ("the hexagon makes the core
testable without infrastructure; strategy in ADR 0017") and deferred the concrete design here.
`CLAUDE.md` already states a one-line testing principle that presupposes this ADR: *"Tests are
deterministic — abstract time, randomness, storage, network, AI and secrets behind ports/fakes; prefer
pure Domain/Application tests over adapter/E2E. (Full strategy: ADR 0017.)"* This ADR is that strategy:
the layer-by-layer test pyramid, tooling, determinism/fixture conventions, coverage policy, and CI
wiring — closing that forward reference.

Testing was **pulled forward** in the roadmap (`docs/STATUS.md`, 2026-07-07 external ADR review) ahead
of Event Store / Sync / Plugin-SDK code, because Event Sourcing + Offline Sync + Plugins + Sandbox + AI
Tools each need a testing design *before* their first line of code, not retrofitted after — a wrongly
tested (or untested) port/adapter/plugin contract is expensive to discover late.

**Repo state at the time of writing:** only `packages/shared-types` has real code, with one colocated
`index.test.ts` using **`bun test`**. `scripts/arch/` (issue #9) already established the pattern this
ADR generalizes: ADR-cited fitness-function tests written against `dependency-cruiser`'s JS API via
`bun test`, run as `bun run arch`, wired into CI ahead of `test`. This ADR extends that pattern from
*architectural* conformance to the full *behavioral* test surface.

**Scope.** This ADR decides the pyramid, tooling, determinism/fixture rules, coverage policy, and CI
wiring. It does **not** decide: accessibility test specifics (ADR 0016), performance-budget numbers
(ADR 0013), or the walking-skeleton scenario itself (ADR 0022) — those are *consumers* of the test types
defined here, not owned by this ADR.

## Decision

### 1. Test pyramid — five layers, cheapest and most numerous first

1. **Domain unit tests** (`core-domain`, pure). No I/O, no ports. Aggregates, value objects and domain
   services are tested by invoking behavior and asserting the emitted events or typed errors (`Result`,
   ADR 0009 §1). Fastest and most numerous; run on every save.
2. **Application unit tests.** Command/query handlers tested against **state-based fakes** for every
   port they use (an in-memory `EventStorePort`, deterministic `ClockPort`/`IdGeneratorPort`, …) — never
   call-sequence mocks (see Alternatives). Still no real infrastructure.
3. **Contract tests** — the mechanism that turns two existing promises into something CI actually
   checks, instead of only documentation:
   - **Port contract tests**: one reusable suite per port (e.g. `eventStorePortContractTests(makeAdapter)`),
     declared alongside the port in `core-domain`, run by **every** adapter that implements it (SQLite
     *and* Postgres run the *same* `EventStorePort` suite). This is what actually verifies ADR 0003 §4's
     swappability claim ("adding an adapter … with zero changes to Domain/Application") rather than
     merely asserting it.
   - **Plugin SDK contract tests**: an analogous kit shipped inside `@grimora/plugin-sdk` (e.g.
     `runPluginContractTests(plugin)`) that `plugins/dsa5` — and any third-party plugin — runs to prove
     SDK compliance: manifest validates against its JSON Schema (ADR 0006 §3), Behaviour API functions
     are pure (no ambient I/O, checked via an instrumented harness call, not code review) and
     deterministic under a fixed seed (ADR 0021 §3). A plugin is "compliant" exactly when it passes this
     suite — not by manual review.
4. **Adapter / infrastructure integration tests.** An adapter's own logic against the real or emulated
   infrastructure it wraps (a SQLite file, dockerized Postgres, MinIO). Fewer and slower than layers
   1–3; verifies the adapter itself, while layer 3 verifies it honors its port.
5. **End-to-end tests** — **Playwright**, exercising real user-facing flows through the actual stack.
   Fewest, slowest. The walking-skeleton scenario (ADR 0022, once written) is the canonical first E2E
   suite.

**Cross-cutting categories** (concerns, not separate layers — each lives inside layers 1–4 above but is
named explicitly because it was called out by issue #19 and the external ADR review):

- **Determinism/replay tests** — same seed + same event stream ⇒ identical folded state (ADR 0004 §9,
  ADR 0021 §3).
- **Upcaster tests** — one test per event `schemaVersion` transition (ADR 0004 §6), proving an old
  payload shape upcasts to the current one correctly.
- **Projection-rebuild tests** — replaying a stream from `position 0` reproduces an identical read model
  (ADR 0004 §5).
- **Sync/rebase simulation tests** — a **multi-client harness** (in-memory `EventStorePort` fakes for
  *N* clients plus one in-memory "cloud" store) drives push/pull/domain-rebase sequences (ADR 0005 §3/§4)
  and asserts convergence (all clients fold to the same state). This is the concrete answer to "how is
  offline/sync tested" (issue #19); it is a reusable harness, not a one-off test file.
- **Property-based tests** (via **fast-check**, §2) for the formula-AST interpreter (ADR 0021 §1 — a pure
  function over a small, closed grammar) and the domain-rebase/merge policy (ADR 0005 §4 — properties
  like "rebase is idempotent" or "auto-merge of non-conflicting intents is commutative" generalize far
  better than enumerated examples).

### 2. Tooling — `bun test` + Playwright + fast-check; no second unit-test runner

- **`bun test`** (Bun's built-in runner) for layers 1–4. Already the de facto choice (`packages/shared-types`,
  `scripts/arch/`); Node-compatible per ADR 0002 is unaffected since it is a dev-time tool, never shipped
  runtime code. Mirrors ADR 0002's "one tool over two" bias (biome over ESLint+Prettier): `bun test`
  already covers mocking, snapshots, watch mode and coverage reporting (`bun test --coverage`), so
  **Vitest is rejected** — no capability gap identified that would justify a second test runner.
- **Playwright** for E2E (layer 5) — cross-browser, TypeScript-first, the tool issue #19 already named.
  App-specific fixtures/setup are ADR 0012's (frontend) to detail; the tool choice itself is fixed here
  as a testing-strategy decision.
- **fast-check** for property-based tests — the standard TypeScript/JavaScript PBT library, used for the
  two targets named in §1 (formula-AST interpreter, domain-rebase/merge policy).

### 3. Determinism & fixtures — formalizing the existing `CLAUDE.md` principle

- Every event-sourced test uses **fake `ClockPort`/`IdGeneratorPort`** (deterministic, injected) — never
  real wall-clock time or random UUID generation (ADR 0004 §9, reaffirmed here as the enforceable rule).
- Every roll/dice/formula test uses a **fixed RNG seed** (ADR 0021 §3).
- **No real network, AI provider, or secret** reaches a test — `AiProviderPort`/`SecretsPort` are always
  fakes/stubs in tests, extending ADR 0003 §6.1's "no ambient authority" to the test environment itself,
  not only to production code paths.
- **No real personal data, secrets, API keys, or copyrighted rulebook text** in fixtures or snapshots —
  an existing `CLAUDE.md` guardrail, reaffirmed here, not re-decided.
- Fixtures are **colocated** with source (`*.test.ts` next to the file it tests) — the pattern already
  used in `packages/shared-types`. Where reusable fakes/contract-test kits live is decided in **O1**.

### 4. Coverage policy — a qualitative bar, not a numeric percentage gate (for now)

- **No blanket numeric coverage threshold enforced in CI at this phase** — with almost no real code
  existing yet, a percentage would be either meaningless or arbitrary (CLAUDE.md: scale decisions to the
  project's actual stage, avoid over-engineering).
- Instead, a **qualitative bar**: every Domain aggregate's stated invariants and every Application use
  case's success **and** failure paths have at least one test (see **O4** for whether this is a hard
  review expectation); adapters are covered by the shared port-contract suite (layer 3) rather than by
  mirroring Domain-level test depth; E2E covers golden paths, not exhaustive UI-state enumeration.
- **Explicitly not unit-tested**: an adapter's interaction with real infrastructure specifics (covered by
  layers 3–4, not 1–2); generated code (OpenAPI-generated clients, ADR 0011 §2).
- Numeric coverage **reporting** (not gating) via `bun test --coverage` is fine to wire into CI now as a
  visibility signal; whether to add a hard threshold later is **O2**, not settled here.

### 5. CI wiring

- `bun run test` (already a `turbo` task) runs layers 1–4. These need no infrastructure beyond what
  `docker-compose` already provides locally; in CI, the equivalent services (Postgres, MinIO) run as CI
  job services, mirroring the local stack.
- **E2E (Playwright) is a separate CI job**, not part of `bun run test` — heavier (needs a running app).
  Its exact cadence (every PR vs. merge-to-main/nightly) is **O3**, not decided here.
- **Relation to `bun run arch` (issue #9):** the conformance harness is conceptually this pyramid's
  fastest, "layer 0" tier — structural/architectural fitness functions with no runtime behavior. It
  already runs as its own CI step before `test` (`CLAUDE.md`'s documented order: install → lint →
  typecheck → arch → test → build). This ADR does not change that order, only names where it sits
  relative to the behavioral layers defined here.

## Consequences

**Positive:** every future package has an unambiguous answer to "which layer does my test belong to";
port and plugin-SDK contract tests turn ADR 0003's swappability claim and ADR 0006's SDK-compliance claim
from documentation into something CI actually verifies; the determinism/fixture rules formalize what
`CLAUDE.md` already asserts, closing its "full strategy: ADR 0017" forward reference; a qualitative
coverage bar avoids both failure modes of a numeric gate (blocking good work, or providing false
confidence from a low bar); reusing `bun test` (already adopted) avoids a second test-runner to maintain,
mirroring the ADR 0002 biome precedent.

**Negative / costs:** building and maintaining reusable contract-test kits (per port, plus the plugin SDK)
and the multi-client sync-simulation harness is real upfront engineering, ahead of most of the code that
will consume them — mitigated by building each incrementally as its first real adapter/plugin appears,
not as a big-bang test-infrastructure sprint. A qualitative coverage bar is inherently more subjective to
enforce in review than a number, and this ADR explicitly defers (rather than settles) whether to add a
numeric floor later (**O2**) — this area may need revisiting once enough real code exists to calibrate
one. E2E cadence and its CI cost are likewise deferred (**O3**), so this ADR does not fully pin down E2E's
ongoing cost.

## Alternatives considered

- **Vitest instead of/alongside `bun test`** — rejected: no capability gap identified that `bun test`
  doesn't already cover (colocated tests, mocking, snapshots, coverage); adding it duplicates ADR 0002's
  "one tool per job" bias for no identified benefit.
- **A numeric coverage threshold enforced now** (e.g. 80% lines) — rejected for now: with almost no real
  code existing, a number would be either meaningless (100% of nothing) or arbitrary; revisit once
  `core-domain`/adapters have enough real code to calibrate a sensible floor (flagged as **O2**, not
  silently deferred forever).
- **Call-sequence mocking libraries** (e.g. `jest.fn()`-style mocks) for Application-layer port tests —
  rejected in favor of **state-based fakes**: a fake exercises the actual contract behavior (an in-memory
  `EventStorePort` really enforces optimistic concurrency), while a call-sequence mock couples a test to
  implementation detail and cannot be reused as a target for the port-contract-test kit (§1) the way a
  fake can.
- **Testing plugins purely by manual/code review**, no shipped contract-test kit — rejected: doesn't
  scale to third-party plugin authors (ADR 0006's stated audience) and gives no CI-enforceable signal.

## Open questions (for owner review)

- **O1 — Where do reusable test fakes/contract-test kits live?** (a) a new `packages/test-kit` added to
  ADR 0003 §3's module map now, or (b) each port's fake/contract-suite lives alongside its declaration in
  `core-domain` (a `testing` sub-path), with the plugin-SDK's kit living inside `plugin-sdk` itself — no
  new package. Recommend **(b)**: avoids adding a package to the module map for what is fundamentally
  test-only tooling, and keeps each fake next to the port it fakes; revisit only if reuse pressure across
  many packages later argues for extraction.
- **O2 — Numeric coverage floor:** enforce a percentage threshold in CI now, or report-only (no gate)
  until enough real code exists to calibrate a sensible number? Recommend **report-only for now**
  (`bun test --coverage` as a visibility signal, not a merge gate); add a numeric floor once
  `core-domain`/adapters exist and a baseline can be measured, rather than guessing a number today.
- **O3 — E2E (Playwright) cadence in CI:** every PR (fastest feedback, higher CI time/cost) vs. only on
  merge-to-`main`/nightly (cheaper, slower regression feedback)? Given the project's cost-consciousness
  (`docs/hosting.md`: maximize free tiers) balanced against wanting trustworthy fast feedback as a solo
  owner, recommend **starting with every PR** once E2E tests exist (they will be few at first —
  walking-skeleton scale, ADR 0022) and revisiting the cadence only once suite runtime becomes a real
  friction point.
- **O4 — Should the qualitative coverage bar (§4) be a hard PR-review expectation** — every guarded
  Domain transition must have an explicit rejection-path test, not just a happy-path one — or is that
  left to reviewer judgement per case? Recommend making it **explicit** (a hard expectation), since it is
  what operationalizes §4's "success *and* failure paths" bar into something enforceable in review rather
  than aspirational — but this changes what a reviewer can block a PR for, so it is worth the owner's
  explicit sign-off.

## References

- [ADR 0002](0002-tech-stack-and-tooling.md) (`bun test` precedent), [ADR 0003](0003-overall-architecture.md)
  (§1 dependency rule, §4 swappability, §6.1 no ambient authority, §8 testability), [ADR 0004](0004-event-sourcing-cqrs.md)
  (§3 command handling, §5 projections, §6 upcasting, §9 determinism), [ADR 0005](0005-persistence-and-sync.md)
  (§3 sync push/pull, §4 domain rebase), [ADR 0006](0006-plugin-system.md) (§3 SDK Definition/Behaviour
  APIs), [ADR 0009](0009-cross-cutting-concerns.md) (ports, error taxonomy), [ADR 0010](0010-security-and-privacy-by-design.md)
  (§7 security fitness functions — relation, not duplication), [ADR 0011](0011-api-design.md) (§2 OpenAPI
  contract), [ADR 0021](0021-rules-execution.md) (§1 formula AST — PBT target, §3 determinism/seeded RNG),
  [`scripts/arch/README.md`](../../scripts/arch/README.md) (the existing fitness-function pattern this
  ADR generalizes), `CLAUDE.md` ("Tests are deterministic" guardrail this ADR fulfills). Issue #19.
