# Architecture conformance harness

Automated **fitness functions** that test the codebase against the architecture, so the
boundaries in the ADRs keep holding as the project grows (issue #9). This is the machine-checkable
half of ADR 0003 §2 (the dependency rule) and its §6 / "Enforcement" security boundaries, plus the
security fitness functions listed in ADR 0010 §7.

## Run it

```bash
bun run arch
```

This runs every `*.test.ts` in this directory. It is a **required CI step** (`.github/workflows/ci.yml`),
gating the same as lint/typecheck/test/build.

## What it checks

| Check | File | Enforces |
| --- | --- | --- |
| **Import boundaries** | `boundaries.test.ts` + [`.dependency-cruiser.cjs`](../../.dependency-cruiser.cjs) | ADR 0003 §2 dependency rule: Domain ← Application ← Adapters; `plugins → plugin-sdk` only; no core→adapter imports; no cross-adapter imports; no deep imports; no cycles; Domain uses no Node builtins (§6.1); `SecretsPort` only at composition roots (ADR 0010 §4/§7) |
| **Harness self-test** | `boundaries.test.ts` | The ruleset actually *fails* on a deliberate violation — proven against `__fixtures__/violations/` (issue #9 acceptance) |
| **ADR index sync** | `adr-index.test.ts` | Every ADR file is linked from `docs/adr/README.md`, every link resolves, every ADR declares a Status |
| **Workspace manifests** | `workspace-manifests.test.ts` | ADR 0003 §5 conventions: `@grimora`-scoped, private, ESM, single `src/index.ts` entry |
| **Doc conformance** | `doc-conformance.test.ts` (ts-morph) | CLAUDE.md doc rule (**presence** half): every exported symbol carries a doc block; every exported function documents each parameter with `@param`. Presence only — the why-vs-what quality stays a review call |

Most import-boundary rules are **forward-looking**: the target modules (`core-domain`, adapters,
`plugins/*`, `apps/*`) mostly don't exist yet, so they match nothing today and start enforcing the
moment those modules are added.

## Adding / changing rules

- **Import/graph rules** → [`.dependency-cruiser.cjs`](../../.dependency-cruiser.cjs). Every rule cites
  the ADR section it enforces. Path patterns use the loose `(?:^|/)` prefix so the same ruleset governs
  both the real tree and the self-test fixtures under `__fixtures__/`.
- **Structural rules dependency-cruiser can't express** (e.g. "every adapter implements a port") → a new
  `*.test.ts` here, derived from and referencing the relevant ADR.

Rules must trace back to an ADR — the ADRs are the source of truth (CLAUDE.md), this harness is only
their enforcement.
