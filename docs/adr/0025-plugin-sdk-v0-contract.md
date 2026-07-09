# ADR 0025 — Plugin-SDK v0 contract freeze

- **Status:** Accepted
- **Date:** 2026-07-08 (accepted via PR #69, issue #62)
- **Deciders:** project owner + AI agents
- **Depends on:** [ADR 0006](0006-plugin-system.md) (§1 plugin = bounded context on the SDK, §2
  capabilities, §3 Definition/Behaviour APIs, §4 manifest/semver, §5 trust/isolation),
  [ADR 0020](0020-core-vs-plugin-boundary.md) (trait meta-model kinds),
  [ADR 0021](0021-rules-execution.md) (§1 formula AST + R1 node set, R2 builder, §2 roll model, R3
  i18n outcome, §3 seeded RNG), [ADR 0022](0022-walking-skeleton.md) (§3 provisional-v0 shapes, R3 —
  this ADR is the freeze it mandated), [ADR 0017](0017-testing-strategy.md) (§1 plugin-SDK contract-test
  kit), [ADR 0010](0010-security-and-privacy-by-design.md) (§3 no ambient authority, R1 sandbox timing),
  [ADR 0003](0003-overall-architecture.md) (§2.4 dependency rule, §6.2 adapters validate input).
  Relates to ADR 0008 (§3 AI-tool descriptors), ADR 0011 (§8/§11 plugin API/tool contributions).

## Context

ADR 0022 R3 deliberately did **not** freeze the plugin-SDK contract inside the walking-skeleton
implementation — it kept the shapes **provisional v0** and mandated *this* dedicated ADR to freeze the
public contract, "informed by the skeleton," because the SDK is a public, third-party-facing surface (a
`CLAUDE.md` stop-and-ask boundary) that deserves its own reviewable decision.

**What the skeleton actually validated** (PR #64, `packages/plugin-sdk`): the formula AST + `f` builder,
the dice/roll model (`DiceTerm`/`RollRequest`/`RollResult` with an i18n-keyed opaque outcome),
`definePlugin`/`register`/`PluginRegistry`/`PluginManifest`, the `BehaviourContext` (seeded RNG + scoped
log) + `ResolveCheck` + `PluginError`, and **three** of ADR 0020's trait kinds (attribute, skill,
derivedValue) — exercised by **one minimal DSA5 plugin** (three attributes, one derived value, one skill
check).

**What it did *not* validate:** the other five ADR 0020 trait kinds (ability, advantage, resource, item,
template); JSON-Schema validation of Definition APIs (the skeleton used TypeScript types only, not the
load-time schema validation ADR 0006 §3 requires); plugin-contributed **AI-tool descriptors** (the
skeleton's AI tools live in `core-domain`, none contributed via the SDK); themes / content packs /
UI-slots / import-export capabilities; and a shipped **contract-test kit** (the DSA5 test exercises the
check mechanic, but there is no `runPluginContractTests(plugin)` yet).

The central tension this ADR must resolve honestly: **freezing a public, third-party-facing contract
from a single minimal plugin risks freezing the wrong shapes.** So "v0" cannot mean a permanent freeze;
it must be an honest, staged stability commitment.

## Decision

### 1. v0 is a pre-1.0 semver line, not a permanent freeze

The plugin SDK is versioned by **semver** (ADR 0006 §4). This ADR freezes **`0.x`** — a line that is
**real and depended-on** (the DSA5 plugin, Phase 3, targets it; the manifest declares `sdkVersion`; the
host advertises the SDK major(s) it supports, ADR 0006 §4) — but that **explicitly reserves the right to
make breaking changes within `0.x`**, each accompanied by **migration notes** and a bumped compatibility
range. The **1.0 stability commitment** — after which breaking changes require a new major — is
**trigger-gated (R1)**: 1.0 is committed to once **the full DSA5 plugin (Phase 3) and at least one
second rule system have been built against the SDK**, not made now. Committing earlier would repeat the
"one-sample freeze" mistake this ADR avoids — real, diverse usage is what earns a permanent
backward-compatibility promise. This matches the project's "scale to actual stage, avoid
over-engineering" rule (`CLAUDE.md`).

### 2. What `0.x` freezes (the skeleton-validated surface)

These shapes are **stable within `0.x`** — changed only additively, or with migration notes for a
breaking change — because the skeleton exercised them end-to-end:

- **Registration**: `definePlugin(manifest, register)`, the `PluginRegistry` a plugin writes into, and
  the `PluginManifest` (`id` reverse-DNS, `name`, `version` semver, `sdkVersion` — ADR 0006 §4).
- **Trait meta-model — the three validated kinds only**: `attribute`, `skill`, `derivedValue`
  (bounded rated values + a formula-computed value). The remaining ADR 0020 kinds are **reserved**, not
  frozen (§4).
- **Rules runtime shapes** (ADR 0021): the **closed formula-AST node set** (R1) + the **`f` builder**
  (R2); the **`DiceTerm` / `RollRequest` / `RollResult`** roll model (§2) with the **opaque,
  i18n-keyed outcome** (R3).
- **Behaviour API**: the **`BehaviourContext`** (a seeded `rng` derived from `IdGeneratorPort` + a scoped
  `log`), the **`ResolveCheck`** resolution-function signature, and the **`PluginError`** value
  (namespaced code + i18n `messageKey` + closed category) crossing the boundary as a value, never a
  thrown exception (ADR 0006 §3, ADR 0009 §1).

### 3. The security boundary is frozen hard (least privilege)

Independently of the `0.x`/1.0 question, the **capability boundary is a permanent invariant** (ADR 0006
§5, ADR 0010 §3): a plugin receives, through the SDK, **only** its capability-scoped `BehaviourContext`
(seeded RNG + scoped log) — **never** a port, secret, network, filesystem, DOM, timer, global, host
function, or another plugin's state. The SDK's public entry (`@grimora/plugin-sdk`) exports **only**
contract types + pure helpers (the builder, `definePlugin`), never host/adapter/port types. This is a
supply-chain trust boundary, so it is **not** subject to the `0.x` "may break" latitude — widening it is
always additive and capability-gated. Enforced by the existing `plugins-only-sdk` fitness function
(ADR 0003 §2.4) plus a new check (§7) that the SDK entry re-exports no host/port types.

### 4. What `0.x` reserves (deferred, added when validated)

These are part of the plugin *model* (ADR 0006 §2, ADR 0020) but were **not** validated by the skeleton,
so `0.x` **reserves** them rather than freezing guessed shapes — they are added (additively, when a real
use validates them):

- The remaining ADR 0020 trait kinds: **ability, advantage, resource, item, template**.
- **Plugin-contributed AI-tool descriptors** (ADR 0006 §2, ADR 0008 §3, ADR 0011 §8/§11) — the shape a
  plugin uses to register a namespaced tool over a use case; added when the first plugin-contributed
  tool is built.
- The **theme, content-pack, UI-slot, and import/export** capabilities (ADR 0006 §2).

Reserving (vs. freezing) means the capability model anticipates them (a plugin declares capabilities in
its manifest) but their concrete Definition/Behaviour shapes are set by real use, not now.

### 5. Definition-API validation at load

ADR 0006 §3 requires Definition APIs to be **JSON-Schema-validated at load** (fail-fast on a malformed
plugin) — the skeleton validated shapes by TypeScript types only, which protects nothing at runtime
against an untrusted third-party plugin. This validation is **deferred (R2)** to a later `0.x` minor —
specifically, landing **before the third-party plugin registry opens** (the same trigger as the sandbox,
ADR 0010 R1), not now. TypeScript types + in-repo review suffice while every plugin is first-party;
runtime schema validation earns its real implementation cost exactly when untrusted plugins arrive
(ADR 0003 §6.2 "adapters validate input").

### 6. Contract-test kit defines "compliant"

ADR 0017 §1 makes the **plugin-SDK contract-test kit** the definition of SDK compliance (a plugin is
compliant exactly when it passes `runPluginContractTests(plugin)`, not by manual review). The **role** of
the kit is part of the contract; the **kit itself is a follow-up to build** — required **before the
third-party plugin registry opens** (ADR 0006 §5 / ADR 0010 R1), not now, because first-party DSA5 is
reviewed in-repo. Its stable shape is frozen when built, ahead of that registry.

### 7. Enforcement (fitness functions)

- Reaffirm `plugins-only-sdk`: a plugin imports **only** `@grimora/plugin-sdk` (+ `@grimora/shared-types`)
  — already enforced, validated by the skeleton on real modules (ADR 0022 §9 criterion 6).
- **New:** assert the `@grimora/plugin-sdk` public entry re-exports **no** host/adapter/port types (§3 —
  the SDK must not leak ambient authority into the plugin surface). Added to the harness (ADR 0003 §2 /
  ADR 0010 §7).
- Determinism in plugin behaviour (no `Math.random`/wall-clock) is already an ADR 0021 §3 fitness
  function; the SDK's seeded-`rng`-only context is what makes it satisfiable.

### 8. Third-party registry opens only at 1.0 (R3)

The plugin registry stays **first-party-only** (DSA5, reviewed in-repo) for the entire `0.x` line and
opens to third-party authors only **at or after 1.0** — i.e. once the SDK contract is stable (R1), the
JSON-Schema validation has landed (R2), the contract-test kit exists (§6), and the untrusted-execution
sandbox exists (ADR 0010 R1). Bundling these into one "third-party-ready" gate is deliberate: exposing a
still-moving `0.x` contract, without schema validation or a sandbox, to outside authors would trade the
project's own iteration speed for a trust boundary it cannot yet back up.

## Consequences

**Positive:** the SDK becomes a **named, depended-on contract** for DSA5 Phase 3 without pretending to a
stability it hasn't earned; the **security boundary is frozen hard** (no ambient authority) even while the
API surface stays `0.x`-flexible; the validated shapes are stable for real plugin work; the **reserve
model** lets the unvalidated surface (five trait kinds, AI tools, themes, …) be shaped by real use instead
of guessed and regretted; enforcement (SDK-leak check) makes the boundary machine-checkable.

**Negative / costs:** `0.x` is **not** a permanent stability promise — an early third-party author would
accept possible breaking changes (with migration notes), a real cost that is moot in practice since the
registry stays first-party-only until 1.0 (R3). True 1.0 stability is deliberately some way off (gated on
a second rule system, R1). JSON-Schema validation is deferred (R2), so fail-fast on malformed plugins is
weaker until it lands — acceptable only while plugins are first-party and reviewed in-repo.

## Alternatives considered

- **Freeze a hard 1.0 now** — rejected: one minimal plugin validated the surface; committing to
  permanent backward-compatibility from that sample would bake in shapes we'll regret when real plugins
  exercise the reserved surface.
- **Fold the freeze into ADR 0006 as an amendment** — rejected: ADR 0022 R3 chose a dedicated ADR, and
  the freeze (semver policy, scope, security boundary, enforcement) is substantial enough to review on
  its own rather than bloat an Accepted ADR.
- **Stay "provisional" indefinitely, no freeze** — rejected: DSA5 Phase 3 and any third party need a
  named contract with a *stated* stability policy, even a `0.x` one; "provisional forever" gives plugin
  authors nothing to rely on.
- **Freeze all eight ADR 0020 trait kinds now** — rejected: five are unvalidated; reserve them (§4).
- **Expose host ports/functions directly to plugins for convenience** — rejected: violates the ADR 0006
  §5 / ADR 0010 §3 no-ambient-authority boundary (§3); all host access stays capability-mediated.

## Resolved questions (owner decisions, 2026-07-09)

- **R1 — The 1.0 stability trigger.** Decided as recommended (§1): 1.0 is committed to once **the full
  DSA5 plugin (Phase 3) plus at least one second rule system have been built against the SDK** — real,
  diverse usage earns the permanent backward-compatibility promise; committing earlier would repeat the
  "one-sample freeze" mistake this ADR avoids.
- **R2 — JSON-Schema validation in `0.x` (§5).** Decided as recommended: **deferred** to a later `0.x`
  minor, landing **before the third-party registry opens** (same trigger as the sandbox, ADR 0010 R1).
  TypeScript types + in-repo review suffice while every plugin is first-party; runtime schema validation
  earns its cost exactly when untrusted plugins arrive.
- **R3 — Third-party registry gated on 1.0 (§8).** Decided as recommended: the plugin registry stays
  **first-party-only during `0.x`** and opens to third parties only **at/after 1.0** (once the contract
  is stable, R2 has landed, the contract-test kit exists, and the untrusted sandbox exists, ADR 0010 R1).
  This ties SDK stability, JSON-Schema validation (R2), the contract-test kit (§6) and the sandbox into
  one coherent "third-party-ready" gate, rather than exposing a moving `0.x` contract to outside authors.

## References

- [ADR 0006](0006-plugin-system.md) (SDK contract, capabilities, manifest/semver, trust model),
  [ADR 0020](0020-core-vs-plugin-boundary.md) (trait meta-model kinds), [ADR 0021](0021-rules-execution.md)
  (formula AST + builder, roll model, i18n outcome, seeded RNG), [ADR 0022](0022-walking-skeleton.md)
  (§3/R3 — the provisional shapes this ADR freezes), [ADR 0017](0017-testing-strategy.md) (§1 contract-test
  kit), [ADR 0010](0010-security-and-privacy-by-design.md) (§3 no ambient authority, R1 sandbox/registry
  timing), [ADR 0003](0003-overall-architecture.md) (§2.4 dependency rule, §6.2 input validation), ADR 0008
  (§3 AI-tool descriptors), ADR 0011 (§8/§11 plugin API/tool contributions),
  [`docs/legal/dsa5-content-boundary.md`](../legal/dsa5-content-boundary.md),
  `packages/plugin-sdk` (the provisional v0 this ADR freezes). Issue #62.
