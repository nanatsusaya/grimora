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
| **Import boundaries** | `boundaries.test.ts` + [`.dependency-cruiser.cjs`](../../.dependency-cruiser.cjs) | ADR 0003 §2 dependency rule: Domain ← Application ← Adapters; `plugins → plugin-sdk` only; no core→adapter imports; no cross-adapter imports; no deep imports; no cycles; Domain uses no Node builtins (§6.1); `SecretsPort` only at composition roots (ADR 0010 §4/§7); `plugin-sdk` never imports a concrete plugin/adapter/app (ADR 0003 §9 boundary/language-leak, ADR 0025 §7); UI code (`apps/*/src` outside `composition/`/`store/`, `packages/ui/src`) never imports an adapter package directly (ADR 0012 §11); a production app (not `apps/skeleton-walk`) never imports `@grimora/core-domain/testing` (ADR 0017 R1) |
| **Harness self-test** | `boundaries.test.ts` | The ruleset actually *fails* on a deliberate violation — proven against `__fixtures__/violations/` (issue #9 acceptance) |
| **Determinism** | `determinism.test.ts` (ts-morph) | ADR 0021 §3 / ADR 0010 §7 — no `Math.random`/`Date.now`/`new Date()` reachable from the formula interpreter, the seeded-RNG runtime, or a plugin's Behaviour API code (`core-domain/src/domain`, `plugin-sdk/src`, `plugins/*/src`) |
| **Default-deny** | `default-deny.test.ts` (ts-morph) | ADR 0010 §2/§7 — every exported Application use case (`application/use-cases.ts`) calls `PolicyPort.can` |
| **SDK re-export boundary** | `sdk-reexport.test.ts` (ts-morph) | ADR 0025 §7 — `plugin-sdk`'s public entry re-exports none of `core-domain`'s port/host names (derived live from `ports.ts`, never hardcoded) |
| **Privacy-classification completeness** | `privacy-classification.test.ts` (ts-morph) | ADR 0023 §8 — `CORE_EVENT_PRIVACY` registers exactly the event types `domain/events.ts` declares (no forgotten/stale entries) |
| **DSA5 source references** | `dsa5-source-references.test.ts` (ts-morph) | ADR 0029 §2/§5 (R3) — every talent in the DSA5 roster cites a **distinct, official** Regel-Wiki URL (and a well-formed vault note where present), so each rule stays checkable against the SSOT. The `regelwiki` field is already required by the type; this catches what typing cannot: empty strings, placeholders, unofficial hosts, and copy-pasted references |
| **ADR index sync** | `adr-index.test.ts` | Every ADR file is linked from `docs/adr/README.md`, every link resolves, every ADR declares a Status |
| **Workspace manifests** | `workspace-manifests.test.ts` | ADR 0003 §5 conventions: `@grimora`-scoped, private, ESM, single `src/index.ts` entry |
| **Doc conformance** | `doc-conformance.test.ts` (ts-morph) | CLAUDE.md doc rule (**presence** half): every exported symbol carries a doc block; every exported function documents each parameter with `@param`. Presence only — the why-vs-what quality stays a review call |
| **Pending (documented, not yet assertable)** | `pending-fitness-functions.test.ts` (`test.skip`) | ADR 0015 §10 consent gate (needs `ConsentPort`) and ADR 0024 §9 realtime-never-persisted (needs a realtime adapter) — both `Not yet implemented` in `docs/ports-catalog.md`; skipped, not silently missing (#76) |

Most import-boundary rules are **forward-looking**: the target modules (`core-domain`, adapters,
`plugins/*`, `apps/*`) mostly don't exist yet, so they match nothing today and start enforcing the
moment those modules are added.

Every ts-morph-based check above (except doc-conformance) also carries its own **self-test** asserting
it actually *fires* on a deliberate in-memory violation — the same "a check that can't fail is not a
check" discipline `boundaries.test.ts` applies to the import rules, applied per-file instead of via a
shared fixtures tree (issue #9 acceptance, extended by #76).

## Adding / changing rules

- **Import/graph rules** → [`.dependency-cruiser.cjs`](../../.dependency-cruiser.cjs). Every rule cites
  the ADR section it enforces. Path patterns use the loose `(?:^|/)` prefix so the same ruleset governs
  both the real tree and the self-test fixtures under `__fixtures__/`.
- **Structural rules dependency-cruiser can't express** (e.g. "every adapter implements a port") → a new
  `*.test.ts` here, derived from and referencing the relevant ADR.

Rules must trace back to an ADR — the ADRs are the source of truth (CLAUDE.md), this harness is only
their enforcement.
