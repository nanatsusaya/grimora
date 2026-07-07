# @grimora/core-domain — **provisional v0** (walking-skeleton stage)

The rule-agnostic hexagon interior (ADR 0003 §1): the **Domain** (campaign/character aggregates, the
formula-AST interpreter and roll orchestration — the core rules-runtime per ADR 0021 §5), the
**Application** (use cases, ports, the character-sheet projection, the AI tool path), and reusable
**testing** fakes.

> ⚠️ **Provisional validation artifact, not a frozen contract** (ADR 0022 §3 / R1). This is the *seed*
> the real core grows from; shapes here inform — but do not constitute — the frozen plugin-SDK v0
> (ADR 0025) or later core ADRs.

## Layout & boundaries (enforced by `bun run arch`)

- `src/domain/**` — pure; imports `@grimora/shared-types` + `@grimora/plugin-sdk` (contract types +
  the rules-runtime operate on SDK data, ADR 0021 §5). **No** Node builtins, **no** `application/`.
- `src/application/**` — use cases + port interfaces; depends on `domain/` + ports only.
- `src/testing/**` — in-memory fakes + the multi-client sync-simulation harness (ADR 0017 R1),
  published via the `@grimora/core-domain/testing` subpath so tests and the composition root reuse
  them **without** shipping them in the main entry.

Imports no adapter/app/plugin package (`core-no-adapters`). `@grimora/plugin-sdk` is allowed — it is the
published contract the host consumes, not an adapter.
