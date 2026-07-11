# ADR 0028 — Rules-execution contract dependency & event-payload type stability

- **Status:** Proposed
- **Date:** 2026-07-12
- **Deciders:** project owner + AI agents
- **Depends on:** [ADR 0003](0003-overall-architecture.md) (§2.1 dependency rule "Domain depends on
  nothing except `shared-types`", §3 module map), [ADR 0021](0021-rules-execution.md) (the rules-execution
  model: §1 formula AST, §2 dice/roll model), [ADR 0025](0025-plugin-sdk-v0-contract.md) (§1 the `0.x`
  "may break" latitude, §2 the frozen surface — which lists `DiceTerm`/`RollRequest`/`RollResult` — §3 the
  hard security boundary), [ADR 0004](0004-event-sourcing-cqrs.md) (§1/§2 event payloads, §6 upcasting),
  [ADR 0023](0023-event-payload-privacy.md) (§2 privacy classification helpers).
- **Proposes amendments to** ADR 0003 §2.1 and/or ADR 0025 §1–§2 — **owner-authorized** (ADR 0001); the
  exact amendment depends on O1 below and is recorded only after the owner decides.

## Context

The **Domain layer imports `@grimora/plugin-sdk`**, contradicting ADR 0003 §2.1 ("Domain depends on
nothing except `@grimora/shared-types`"):

- `packages/core-domain/src/domain/character.ts` → `CheckDefinition`, `RollOutcome`, `RollRequest`,
  `RollResult`, `SeededRng`
- `packages/core-domain/src/domain/events.ts` → `PrivacyClassification`, `privacy`, `RollRequest`,
  `RollResult`
- `packages/core-domain/src/domain/rng.ts` → `SeededRng`
- `packages/core-domain/src/domain/formula.ts` → `FormulaAst`

The conformance harness does **not** catch this (`core-no-adapters` targets *adapter* packages, and there
is no `domain-imports-only-shared-types` rule), and **no Amendment records the drift** — the repo writes
Amendments for far smaller drifts (e.g. the `dice`-node rename, ADR 0021).

**Why it happened (not merely sloppy):** the rules-execution model (ADR 0021 — the formula AST, the
dice/roll model, the seeded-RNG interface) is the **shared language** between *core* (the formula
interpreter + the roll orchestration in `character.ts`) and *plugins* (which author formulas and checks).
It currently lives inside `@grimora/plugin-sdk`, so the Domain depends **"upward" into the plugin-facing
SDK** to speak that shared language. The `privacy` helpers (ADR 0023) are in the same position — used by
both core event classification and plugins.

**The acute risk (why this is a durability hazard, not a style nit):** `RollRequest` and `RollResult`
(and the `DiceTerm`/`RollOutcome` they contain) are embedded in the **persisted** `character.checkRolled`
event payload (ADR 0004 §1/§2, `events.ts`). ADR 0025 §1 deliberately **reserves the right to make
breaking changes to the SDK surface within `0.x`** — and §2 lists exactly these roll types as part of
that `0.x` surface. So a `0.x` breaking change to `RollRequest`/`RollResult` would break the typing of
**already-stored history**. The event log is the system's source of truth (ADR 0004); its payload types
must not sit on a surface that is contractually allowed to break. (`FormulaAst` is embedded in plugin
**catalogs** — master/reference data versioned *with* the plugin, ADR 0004 — so its persistence coupling
is weaker; `SeededRng`/`CheckDefinition` are transient, never persisted.)

## Decision

### 1. A persisted-payload type must not depend on a break-permitted surface

Any type embedded in a **persisted event payload** (ADR 0004 §1/§2) must carry a stability guarantee **at
least as strong as the event log's durability**. A type that ADR 0025 §1 permits to break within `0.x`
must therefore **not** be the source-of-truth for stored-payload typing. This is the invariant the
current `RollRequest`/`RollResult`-in-`checkRolled` arrangement violates.

### 2. The rules-execution contract is shared and must live in a shared home

The formula AST, the dice/roll model, the seeded-RNG interface and the privacy classification helpers are
used by **both** `core-domain` and `plugin-sdk` (ADR 0021, ADR 0023). A contract both sides depend on
must live where **neither depends "upward" into the other** — a stable home both can import — rather than
inside the plugin-facing SDK with core reaching up into it. (The *mechanism* for this is O1.)

### 3. The plugin-facing surface stays source-compatible

Whichever mechanism O1 selects, `import { RollRequest, RollResult, f, … } from '@grimora/plugin-sdk'`
**keeps working** for plugin authors — the SDK **re-exports** the shared contract from its stable home.
Relocating a type's *definition* is **not** a breaking change to the *plugin surface* ADR 0025 §2 froze;
the frozen public surface is preserved as a re-export.

### 4. Enforce the reconciled rule as a fitness function

Once the types are re-homed, add a conformance check that Domain (`packages/core-domain/src/domain/**`)
imports **only** `@grimora/shared-types` (+ the shared rules-contract home decided in O1). The dependency
rule that is today only prose in ADR 0003 §2.1 becomes **machine-checked** (ADR 0003 §2, ADR 0010 §7), so
it cannot silently erode again.

## Consequences

**Positive:** the ADR 0003 §2.1 dependency rule holds again **and** is enforced; persisted event payloads
are typed from a **stable** home, immune to `0.x` SDK churn (closes the durability hazard at its root);
the plugin author surface is unchanged (re-export); the fix is structural, not a fragile exception.

**Negative / costs:** a package/re-export **restructuring** (move the shared contract, re-export from the
SDK, repoint `core-domain` imports, add the fitness rule, update the ADR 0003 §3 module map); an
**owner-authorized amendment** to ADR 0003 §3 (module map) and ADR 0025 §2 (the type *source-of-truth*
moves, its plugin surface preserved as a re-export); and — if O2 chooses a new package — one more
workspace package to maintain. All one-time.

## Alternatives considered

- **Bless `Domain → plugin-sdk` and hard-freeze only the payload subset within `0.x`** (kept as O1's
  option B) — rejected as the *default* because it papers over the contradiction and bolts a fragile
  carve-out onto ADR 0025 §1's "may break" latitude that is easy to violate by accident (nothing stops a
  future `0.x` change from touching `RollResult`).
- **Do nothing / document the import as accepted** — rejected: leaves both a real durability hazard (a
  `0.x` break silently breaks stored-payload typing) *and* an unenforced, contradicted dependency rule.
- **Duplicate the contract types inside `core-domain`** — rejected: two sources of truth for one shared
  contract inevitably drift; the whole point is a single shared definition.

## Open questions (for owner review)

- **O1 — Mechanism (the crux).**
  - **(A, recommended)** Re-home the shared rules-execution contract (+ privacy helpers) into a **stable
    home** that both `core-domain` and `plugin-sdk` depend on; the SDK re-exports it (§3). ADR 0003 §2.1
    then holds as written (or with a one-line clarification naming the contract home); ADR 0025 §2 gets a
    "defined-in-X, re-exported here" note. Fixes the hazard at the root.
  - **(B)** Keep the types in the SDK; amend ADR 0003 §2.1 to *allow* `Domain → plugin-sdk`, and amend
    ADR 0025 §1 to **hard-freeze** the payload-embedded subset within `0.x` (a carve-out like the §3
    security boundary). Less churn now, but a weaker, exception-based guarantee.
  - *Recommendation: A* — it removes the contradiction and the durability risk structurally rather than by
    exception.
- **O2 — If A: where is the stable home?**
  - **(a)** Extend `@grimora/shared-types` — but it is documented as a **pure-types** leaf, and the
    contract includes **runtime** helpers (the `f` formula builder, the `privacy.*` functions,
    `redactView`), which strains "pure types".
  - **(b, recommended)** A new leaf package `@grimora/rules-contract` (name TBD) holding the
    rules-execution model + privacy helpers, importable by `shared-types`-level consumers, depended on by
    both `core-domain` and `plugin-sdk`.
  - *Recommendation: (b)* to keep `shared-types` a pure-types leaf.
- **O3 — The exact "must-be-stable, payload-embedded" set.** Proposed: `RollRequest`, `RollResult`,
  `RollOutcome`, `DiceTerm` (all persisted in `character.checkRolled`). Include `FormulaAst` in the shared
  home for coherence, noting its persistence coupling is only via plugin catalogs (master data). Exclude
  `SeededRng`/`CheckDefinition` from the *stability* obligation (transient) though they move with the
  contract for consistency. Confirm the set.
- **O4 — Amendment authorization.** Whichever of A/B is chosen, it **amends at least one Accepted ADR**
  (0003 and/or 0025). Per ADR 0001 that needs your explicit authorization, recorded in the amended ADR's
  *Amendments* section. Confirm you authorize the amendment consequent to your O1 choice.

## References

- [ADR 0003](0003-overall-architecture.md) §2.1/§3, [ADR 0021](0021-rules-execution.md),
  [ADR 0025](0025-plugin-sdk-v0-contract.md) §1–§3, [ADR 0004](0004-event-sourcing-cqrs.md) §1/§2/§6,
  [ADR 0023](0023-event-payload-privacy.md) §2. Issue #153. Source: the 2026-07-11 cross-model review
  (Fable #13/#14), verified against source; method in
  [`docs/meta/agent-collaboration-log.md`](../meta/agent-collaboration-log.md).
