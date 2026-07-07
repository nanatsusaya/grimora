# ADR 0021 — Rules Execution: Formula, Dice & Deterministic Runtime

- **Status:** Accepted
- **Date:** 2026-07-07 (accepted via PR #57, issue #41)
- **Deciders:** project owner + AI agents
- **Depends on:** [ADR 0003](0003-overall-architecture.md) (§1 dependency rule, §9 DDD),
  [ADR 0004](0004-event-sourcing-cqrs.md) (events, upcasting, determinism, event naming/`describe()`),
  [ADR 0006](0006-plugin-system.md) (§2 rule-system capability, §3 Behaviour API + seeded rng, §4
  provenance, §5 sandbox phasing), [ADR 0009](0009-cross-cutting-concerns.md) (error taxonomy),
  [ADR 0010](0010-security-and-privacy-by-design.md) (§3 plugin sandbox & determinism, §7 fitness
  functions), [ADR 0011](0011-api-design.md) (§1 rules payloads note), [ADR 0020](0020-core-vs-plugin-boundary.md)
  (core/plugin boundary — formula/dice **abstraction** is core, the concrete mechanic is plugin)

## Context

ADR 0006/ADR 0020 already fixed *where* the line runs: the core owns the generic formula/derivation
engine and the dice/resolution **abstraction**; a rule-system plugin owns the *concrete* formulas and
**the dice mechanic itself** (which die, how many, how results combine into success/failure). What
neither ADR fixed is the **execution model** — how a formula is represented and evaluated, and how a
roll is requested, resolved and logged — which is the hardest part of a rule-agnostic engine because
it is tightly coupled to the plugin trust/sandbox model (ADR 0010 §3): a declarative representation is
trivially sandboxable; arbitrary plugin code is not.

This also has to work across **very different mechanics** (ADR 0020's seven-system comparison):
DSA5's 3d20-roll-under-three-attributes, D&D5e's d20+modifier-vs-DC, Shadowrun's d6 dice pool with
counted hits, and narrative symbol-dice systems. A core formula/roll model that secretly assumes one
of these is mis-abstracted (issue #41's framing).

Determinism matters for two independent reasons already decided elsewhere: **replay** (ADR 0004 — an
event stream must fold to the same state on every replay) and **security** (ADR 0010 §3 — plugin
behaviour must be free of timing/entropy side channels and non-deterministic effects).

**Repo state at the time of writing:** only `packages/shared-types` has code; no `core-domain`, no
ports, no plugin SDK. This is a decision record; Phase 2 (and the DSA5 plugin, Phase 3) builds against
it. Per the agent guardrails, no formula interpreter or dice runtime is implemented before this ADR is
`Accepted`, and this ADR **blocks plugin-SDK v0**.

## Decision

### 1. Formula representation — a closed, JSON-serializable expression AST

A formula (derived value, check target, damage, etc.) is represented as a **typed expression tree**
over a small, closed set of node kinds — not a text DSL, not an arbitrary TypeScript function, not
WASM:

- **Leaf nodes:** `const` (a literal number), `traitRef` (reference to an attribute/skill/resource id
  in the generic trait meta-model, ADR 0020), `diceTerm` (see §2 — a roll *is* a leaf in the same
  tree, so "COU + 1d6" is one AST, not two glued-together systems).
- **Operator nodes:** `add`, `sub`, `mul`, `div`, `min`, `max`, `cmp` (`eq`/`lt`/`gt`/`lte`/`gte`),
  `if` (ternary), `tableLookup` (a keyed table the plugin supplies, e.g. DSA5's encumbrance-by-STR
  table). This set is the **v1 closed set, confirmed R1** — extend only by amendment/superseding ADR,
  mirroring the closed error-category precedent (ADR 0009 §1).
- The AST is **pure data**: JSON-serializable, JSON-Schema-validatable at plugin load time like other
  Definition APIs (ADR 0006 §3), embeddable directly in event payloads (§4) and plugin manifests, and
  walkable by a single core **interpreter** with no `eval`/`vm`/dynamic code execution — satisfying
  ADR 0010 §3's "no eval/vm in the host realm" for this concern *by construction*, independent of
  whether a given plugin later runs in-process or in a sandboxed worker.
- **Plugin-facing ergonomics:** plugins are not expected to hand-write raw AST nodes; a **builder API**
  (`formula.add(a, b)`, `formula.trait("COU")`, …) is the intended authoring surface and simply emits
  the tree. The builder is sugar; the AST is the wire/storage format. **Confirmed R2:** the builder
  ships in `@grimora/plugin-sdk` from day one, not after DSA5 hand-constructs raw nodes first — the SDK
  is versioned (semver, ADR 0006 §4) and can be extended later at no greater cost than any other SDK
  surface, so there is no benefit to withholding it.
- This is deliberately **narrower** than the Behaviour API's general "pure function" contract already
  allowed for generation steps (ADR 0006 §3): formulas specifically need to be inspectable (for
  breakdown/audit UI) and mechanically re-evaluable without invoking plugin code, which an opaque
  function cannot provide.

### 2. Dice/roll semantics — a generic roll-request/result shape

The core defines shapes that hold across every compared mechanic (ADR 0020); it does **not** define
how terms combine into an outcome — that combination logic is the plugin's "mechanic" (ADR 0020) and
lives in a plugin-supplied Behaviour API resolution function.

- **`DiceTerm`** — `{ die: number of sides (or a symbol-set id for narrative dice), count, modifier? }`.
  A plugin composes one or more terms per roll: three independent d20 terms for DSA5's roll-under-three
  checks, one d20+modifier term for d20-vs-DC systems, a pool of same-sided dice for Shadowrun-style
  pools, a set of symbol dice for narrative systems.
- **`RollRequest`** — `{ terms: DiceTerm[], context: (character/check reference), visibility:
  "public" | "gmOnly" | "private", groupId? }`. `visibility` covers hidden/GM-only rolls; `groupId`
  links multiple requests for opposed/group checks (each participant's roll is its own request,
  correlated by `groupId`, rather than a special "group roll" core concept).
- **`RollResult`** — `{ requestId, rolls: raw pips per term, rerollOf?: prior RollResult id kept for
  audit, outcome: <plugin-defined value + labelKey>, seed: (§3) }`. **Confirmed R3:** `outcome`'s
  structured value is **opaque to the core** — the plugin's resolution function produces it (e.g. DSA5
  quality levels, a d20 crit/fail, a Shadowrun hit count), and the core stores/replays it without
  interpreting it. Its human-readable part is **not** a hardcoded string but an **i18n message key (+
  params)**, following the exact same pattern already used for `AppError.messageKey` (ADR 0009 §1) and
  event `describe()` (ADR 0004 §10): the plugin stores the locale-independent key/structured value, and
  the actual translated text is resolved at the presentation layer (i18n, ADR 0016) — never server-side
  or baked into the event.
- **Rerolls / advantage / disadvantage** are modeled as a **second `RollRequest` with `rerollOf`
  pointing at the first** (**confirmed R4**) — never a core-level special case, and never multiple
  term-sets bundled into one request upfront. This keeps the core free of any specific mechanic's
  reroll rules while keeping every physical "touch of the dice" its own auditable event.

### 3. Determinism & RNG

- Every roll draws from a **seeded RNG derived from `IdGeneratorPort`** (reaffirming ADR 0006 §3,
  ADR 0010 §3) — never `Math.random` or wall-clock time. The seed is derived from the aggregate stream
  id plus a per-aggregate roll sequence number, so **replaying the event stream reproduces identical
  rolls** (ADR 0004 §9), and `RollResult.seed` records the derivation inputs for audit.
- Formula evaluation (§1) is a **pure function** of `(trait values, constants, dice results already
  rolled)` — no hidden state, no I/O — so it also replays identically given the same inputs.
- **Enforcement** (extends the ADR 0010 §7 fitness-function list): no `Math.random`/`Date.now`/wall-clock
  API reachable from the formula interpreter or the dice-roll runtime used by plugin Behaviour API
  calls; the conformance harness asserts this the same way it asserts the existing plugin-import rules.

### 4. Roll event schema

Rolls are **event-sourced** as a generic core event, e.g. `character.checkRolled` (analogous events for
campaign/NPC-scoped rolls), carrying:

- `formulaSnapshot` — the resolved AST **and** the trait values used at roll time, so the roll remains
  auditable/replayable even if the underlying trait value changes later.
- `rollRequest` and `rollResult` (§2, including the opaque plugin `outcome`).
- `pluginId` + plugin `version` (provenance, ADR 0006 §4) and `schemaVersion` (ADR 0004 §6, upcasting).

`describe()` (ADR 0004 §10) for `character.checkRolled` has a generic core default ("Rolled a check");
a plugin overrides it with mechanic-specific phrasing (e.g. DSA5 quality-level wording) — the same
pattern already used for other core events rendered through a plugin. Reproducible replay of the exact
roll (§3) is also what makes the event auditable for the Repudiation mitigation in ADR 0010 §1
("I never rolled that").

### 5. Plugin boundary — inputs/outputs, not a new sandbox mechanism

This ADR does not re-decide *how* plugin code is isolated (ADR 0010 §3 owns that: in-process
first-party now, worker-sandboxed third-party later). It fixes what must be true of the data crossing
that boundary for rules execution specifically, so the existing sandbox plan applies unchanged:

- The formula interpreter and dice-roll orchestration are **core** code; only the AST (data) and the
  resolution/generation Behaviour API functions (ADR 0006 §3: pure, capability-scoped, no ambient
  authority) are plugin-supplied.
- Behaviour API resolution functions receive `(rollResult raw terms, traits)` and return
  `Result<RollOutcome, AppError>` (ADR 0009) — never reach network/clock/globals.
- Execution-limit / DoS mitigations (ADR 0010 §3 "execution limits") apply identically to formula
  evaluation and resolution calls; no special-casing versus any other Behaviour API call.

## Consequences

**Positive:** one generic, serializable formula representation lets the core render, audit and
localize *any* plugin's math without understanding its meaning; the roll model is provably
mechanic-agnostic against the seven-system spread already surveyed (ADR 0020); determinism is
guaranteed **structurally** (by the AST/seeded-rng shape) rather than by developer discipline, so
replay and audit (ADR 0004/0010) work by construction; the same closed-AST shape is trivially
sandboxable, so this ADR does not reopen or complicate ADR 0010's phased sandbox plan.

**Negative / costs:** a formula interpreter plus a builder-API sugar layer is more upfront engineering
than "let the plugin write a TS function" would be. The closed node-kind set (§1) must be extended
carefully — a new node kind is effectively a core-engine change gated the same as any other core
release — whenever a plugin's real-world math needs something the v1 set can't express; mitigated by
starting from a deliberately generous set informed by the seven-system comparison (ADR 0020) and by
the standard amendment/superseding path if it proves too narrow. Because `RollResult.outcome`'s structured value is opaque
to the core (§2), core-level tooling (a generic character sheet, a generic AI tool describing a roll)
can resolve and render its `labelKey` (i18n) but cannot reason about *what kind* of outcome it is — an
intentional consequence of ADR 0020's boundary, not an oversight, but a real limit on how "smart"
generic core UI can be about roll results.

## Alternatives considered

- **Arbitrary TypeScript functions for formulas** (as already allowed for generation steps, ADR 0006
  §3) — rejected specifically for formulas: opaque to breakdown/audit UI and forecloses the trivial
  sandboxing an AST gets for free, for a concern (arithmetic over traits) that is naturally declarative
  anyway.
- **Textual DSL** (parse a string like `"COU + 1d6"`) — rejected: adds a parser and its own
  grammar-versioning burden without upside over an AST that plugin authors emit via builder-API sugar
  instead of typing syntax.
- **JSONLogic** (existing off-the-shelf declarative format) — considered; rejected because its general
  data-operation vocabulary exceeds what a character formula needs, and we would still need to bolt on
  our own trait-reference/dice-term/description-key vocabulary regardless — at which point a
  purpose-built minimal AST is no larger and fits the domain better.
- **WASM** — rejected as disproportionate toolchain cost for evaluating arithmetic/lookup expressions
  over traits; revisit only if a plugin ever needs genuinely heavy compute (out of scope today).
- **Standardizing the dice mechanic itself** (e.g. "everything is d20 + modifier") in the core —
  directly contradicts ADR 0020's core/plugin boundary. Rejected.
- **A single `RollRequest` allowing multiple term-sets upfront** (instead of linked requests for
  rerolls) — rejected: it makes each physical "touch of the dice" less individually auditable in the
  event log (R4).
- **A core-defined outcome-tier envelope** (e.g. `criticalSuccess`/`success`/`failure`/
  `criticalFailure`) instead of a fully opaque plugin outcome — rejected: it would encode a value
  judgement about what "success" means that ADR 0020 deliberately left to plugins, and would not map
  cleanly onto every mechanic (e.g. Shadowrun's counted-hits results); the i18n-key refinement (R3)
  gives generic UI a renderable label without the core needing to understand the tier.

## Resolved questions (owner decisions, 2026-07-07)

All four review questions were resolved by the owner; the decisions above already reflect them.

- **R1 — Initial AST node-kind set.** *Confirmed:* the proposed v1 closed set (`const`, `traitRef`,
  `diceTerm`, `add`, `sub`, `mul`, `div`, `min`, `max`, `cmp`, `if`, `tableLookup`, §1) is adopted now,
  without first scouting DSA5's concrete formulas. Extend only via amendment/superseding ADR, mirroring
  the closed error-category precedent (ADR 0009 §1).
- **R2 — Where the builder-API sugar lives.** *Confirmed:* it ships in `@grimora/plugin-sdk` from day
  one (§1), rather than DSA5 hand-constructing raw AST nodes first. Rationale: the SDK is versioned and
  extensible at any time (ADR 0006 §4), so there is no cost to building it now, only to withholding it.
- **R3 — `RollResult.outcome` typing.** *Confirmed:* the structured value stays fully **opaque,
  plugin-defined** (§2) — no core-defined outcome-tier envelope. **Refinement:** its human-readable part
  is an **i18n message key (+ params)**, not a hardcoded string, following the same pattern as
  `AppError.messageKey` (ADR 0009 §1) and event `describe()` (ADR 0004 §10) — so generic UI/AI tooling
  can still render a localized label without the core needing to understand the outcome's meaning.
- **R4 — Reroll/advantage modeling.** *Confirmed:* **linked `RollRequest`s** via `rerollOf` (§2) — never
  multiple term-sets bundled into one request upfront. Each physical die-touch stays its own auditable
  event entry, ahead of DSA5 (which has explicit reroll mechanics) being built against this schema.

## References

- [ADR 0003](0003-overall-architecture.md) (§1 dependency rule, §9 DDD), [ADR 0004](0004-event-sourcing-cqrs.md)
  (§1–2 events, §6 upcasting, §9 determinism, §10 event naming/`describe()`), [ADR 0006](0006-plugin-system.md)
  (§2 rule-system capability, §3 Behaviour API/seeded rng, §4 provenance, §5 sandbox phasing),
  [ADR 0009](0009-cross-cutting-concerns.md) (error taxonomy), [ADR 0010](0010-security-and-privacy-by-design.md)
  (§3 plugin sandbox & determinism, §7 fitness functions), [ADR 0011](0011-api-design.md) (§1 rules
  payloads note), [ADR 0020](0020-core-vs-plugin-boundary.md) (core/plugin boundary, seven-system
  comparison), [`docs/research/rule-systems-comparison.md`](../research/rule-systems-comparison.md).
  Issue #41.
