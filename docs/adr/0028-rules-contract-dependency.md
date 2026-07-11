# ADR 0028 — Rules-execution contract dependency & event-payload type stability

- **Status:** Accepted
- **Date:** 2026-07-12 (accepted via PR #162, issue #153)
- **Deciders:** project owner + AI agents
- **Depends on:** [ADR 0003](0003-overall-architecture.md) (§2.1 dependency rule "Domain depends on
  nothing except `shared-types`", §3 module map), [ADR 0021](0021-rules-execution.md) (the rules-execution
  model: §1 formula AST, §2 dice/roll model), [ADR 0025](0025-plugin-sdk-v0-contract.md) (§1 the `0.x`
  "may break" latitude, §2 the frozen surface — which lists `DiceTerm`/`RollRequest`/`RollResult` — §3 the
  hard security boundary), [ADR 0004](0004-event-sourcing-cqrs.md) (§1/§2 event payloads, §6 upcasting),
  [ADR 0023](0023-event-payload-privacy.md) (§2 privacy classification helpers).
- **Amends** (owner-authorized 2026-07-12, ADR 0001 — see R4): **ADR 0003 §2.1 + §3** (Domain may also
  depend on the new `@grimora/rules-contract` leaf; the module map gains it) and **ADR 0025 §2** (the
  roll/formula contract types are *defined* in `@grimora/rules-contract` and *re-exported* by the SDK — the
  plugin surface is unchanged). Recorded in each amended ADR's *Amendments* section as this ADR is accepted
  and its implementation follow-up lands.

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

### 2. The rules-execution contract lives in a new shared leaf package

The formula AST, the dice/roll model, the seeded-RNG interface and the privacy classification helpers are
used by **both** `core-domain` and `plugin-sdk` (ADR 0021, ADR 0023). They move into a **new leaf package
`@grimora/rules-contract`** (R1/R2) that both sides import — so **neither depends "upward" into the
other** — instead of living inside the plugin-facing SDK with core reaching up into it. `@grimora/shared-types`
stays a **pure-types** leaf: the contract carries **runtime** helpers (the `f` builder, `privacy.*`,
`redactView`), which do not belong in a types-only leaf, so they get their own package rather than bloating
`shared-types`.

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

**Negative / costs:** a package/re-export **restructuring** (create `@grimora/rules-contract`, move the
shared contract, re-export from the SDK, repoint `core-domain` imports, add the fitness rule, update the
ADR 0003 §3 module map); the **owner-authorized amendments** to ADR 0003 §2.1/§3 and ADR 0025 §2 (R4);
and **one more workspace package** to maintain. All one-time.

## Alternatives considered

- **Bless `Domain → plugin-sdk` and hard-freeze only the payload subset within `0.x`** (kept as O1's
  option B) — rejected as the *default* because it papers over the contradiction and bolts a fragile
  carve-out onto ADR 0025 §1's "may break" latitude that is easy to violate by accident (nothing stops a
  future `0.x` change from touching `RollResult`).
- **Do nothing / document the import as accepted** — rejected: leaves both a real durability hazard (a
  `0.x` break silently breaks stored-payload typing) *and* an unenforced, contradicted dependency rule.
- **Duplicate the contract types inside `core-domain`** — rejected: two sources of truth for one shared
  contract inevitably drift; the whole point is a single shared definition.

## Resolved questions (owner decisions, 2026-07-12)

- **R1 — Mechanism (was O1).** **(A) re-home the shared contract**, decided as recommended: the
  rules-execution contract + privacy helpers move **out** of `@grimora/plugin-sdk` into a stable package
  both `core-domain` and `plugin-sdk` depend on, the SDK **re-exporting** it (§3). This removes the
  ADR 0003 §2.1 contradiction **and** the `0.x` payload-typing hazard at the **root**, rather than
  blessing the import and bolting a fragile break-carve-out onto ADR 0025 §1 (option B).
- **R2 — Stable home (was O2).** **(b) a new leaf package `@grimora/rules-contract`** (name provisional),
  decided as recommended, so `@grimora/shared-types` stays a **pure-types** leaf while the contract's
  runtime helpers (the `f` builder, `privacy.*`, `redactView`) get a proper home.
- **R3 — The stable set (was O3).** Confirmed as recommended, with the owner's explicit
  **weaker-persistence-coupling** treatment of `FormulaAst`:
  - **`RollRequest`, `RollResult`, `RollOutcome`, `DiceTerm`** — payload-embedded (`character.checkRolled`);
    carry the **hard** stability obligation of §1.
  - **`FormulaAst`** — moves into the package for coherence but with **weaker persistence coupling**: it is
    embedded only in plugin **catalogs** (master data versioned *with* the plugin, ADR 0004), never in user
    event payloads, so its stability requirement is softer (it rides the plugin's own versioning, not the
    event log's durability).
  - **`SeededRng`, `CheckDefinition`** — move for coherence but are **transient** (never persisted); no
    stability obligation.
- **R4 — Amendment authorization (was O4).** **Authorized by the project owner (2026-07-12)** (ADR 0001).
  The consequent amendments — **ADR 0003 §2.1** (Domain may also depend on `@grimora/rules-contract`) and
  **§3** (the module map gains the package), and **ADR 0025 §2** (the frozen roll/formula types are
  *defined* in `@grimora/rules-contract`, *re-exported* by the SDK; the plugin surface is unchanged) — are
  recorded in each amended ADR's *Amendments* section as this ADR is accepted and its implementation
  follow-up lands.

## References

- [ADR 0003](0003-overall-architecture.md) §2.1/§3, [ADR 0021](0021-rules-execution.md),
  [ADR 0025](0025-plugin-sdk-v0-contract.md) §1–§3, [ADR 0004](0004-event-sourcing-cqrs.md) §1/§2/§6,
  [ADR 0023](0023-event-payload-privacy.md) §2. Issue #153. Source: the 2026-07-11 cross-model review
  (Fable #13/#14), verified against source; method in
  [`docs/meta/agent-collaboration-log.md`](../meta/agent-collaboration-log.md).
