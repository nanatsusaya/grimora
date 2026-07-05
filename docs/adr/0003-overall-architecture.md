# ADR 0003 — Overall architecture: Hexagonal / Ports & Adapters

- **Status:** Proposed (→ Accepted on merge of the PR for issue #2)
- **Date:** 2026-07-05
- **Deciders:** project owner + AI agents
- **Supersedes:** —

## Context

Grimora must survive and stay malleable for years:

- The core is **rule-system-agnostic**; rule systems (first DSA5) are **plugins**.
- **Offline-first + cloud-sync**, Event Sourcing + CQRS.
- Frontend and backend must be **extensible independently**.
- Concrete technologies (DB, storage, auth, sync, AI provider, UI framework) must stay **swappable**.
- Large-scale refactorings years from now must be feasible without rewriting business logic.
- The architecture must be **testable against the code continuously** (see #9).

These forces point to an architecture that isolates business logic from technology and makes
dependencies flow in one direction only.

## Decision

Adopt **Hexagonal Architecture (Ports & Adapters)** with Clean-Architecture layering and an
**enforced dependency rule**. Business logic sits in a pure core; everything technological is an
adapter behind a port.

### 1. Layers

| Layer | Contains | May depend on |
| --- | --- | --- |
| **Domain** | Rule-agnostic model: aggregates, value objects, domain events, invariants, pure logic. No I/O, no framework, no time/randomness access except via injected ports. | `shared-types` only |
| **Application** | Use cases: command handlers, query handlers, projection definitions, orchestration. Declares **ports** (interfaces) it needs. | Domain, `shared-types` |
| **Ports** | Interfaces owned by the application (e.g. `EventStorePort`, `ObjectStoragePort`, `AiProviderPort`, `AuthPort`, `SyncPort`, `ClockPort`, `IdGeneratorPort`, `LoggerPort`). | Domain types, `shared-types` |
| **Adapters** | Concrete implementations of ports (SQLite event store, Supabase, R2/MinIO, Claude/OpenAI/Ollama, pino logger, …). | Ports + Domain types they implement against |
| **Composition root** | Wires adapters into ports and starts the app. Lives in each `apps/*`. | Everything (it is the only place allowed to) |
| **Presentation** | UI (web/mobile/desktop) and any HTTP API surface; calls the application via input ports. | Application (via public API), `ui`, `design-tokens` |

The "hexagon interior" = Domain + Application + Ports. It knows **nothing** about how anything is
stored, transported, rendered, or which AI vendor is used.

### 2. The dependency rule (enforceable)

1. **Domain depends on nothing** except `@grimora/shared-types` (pure types).
2. **Application** depends only on Domain + Ports. It must **not** import any adapter or app.
3. **Adapters** depend on Ports (to implement) + Domain types. They must **not** import each other,
   and nothing in Domain/Application may import an adapter.
4. **Plugins** depend **only** on `@grimora/plugin-sdk` (the published contract) — never on core
   internals, adapters, or apps.
5. **Apps (composition roots)** may depend on anything; they are the only wiring point.
6. **Public entry points only:** packages import another package via its package name
   (`@grimora/x`), never via deep internal paths (`@grimora/x/src/...`).
7. Dependencies form a **DAG** — no cycles between packages.

This rule is normative and is what the conformance harness (#9) encodes as fitness functions.

### 3. Monorepo module map

```
packages/
  shared-types/     Pure shared types (leaf; importable everywhere).            [leaf]
  core-domain/      Domain + Application + Port interfaces (the hexagon).       [domain+app+ports]
  plugin-sdk/       Published plugin contract (depends on shared-types only).   [contract]
  design-tokens/    Theming SSOT (JSON tokens + generators).                    [leaf]
  ui/               Presentation components (web).                              [presentation]
  event-store/      Adapter: local append-only event log (SQLite/IndexedDB).   [adapter]
  cqrs-read/        Adapter: read-model store + projection runner host.         [adapter]
  offline-sync/     Adapter: bidirectional event sync (local <-> cloud).        [adapter]
  ai-agent/         Adapter(s): AiProviderPort (Claude/OpenAI/Ollama).          [adapter]
  (future) adapter-supabase, adapter-storage-r2, adapter-storage-minio, ...     [adapter]
apps/
  web/ mobile/ desktop/ (api?)  Composition roots + presentation.              [composition]
plugins/
  dsa5/             First rule-system plugin (mechanics/structure only).        [plugin]
```

Ports are declared in `core-domain` (`src/application/ports`). Adapter packages implement them.
The **event-store / cqrs-read / offline-sync / ai-agent** packages are adapters, not core — the
corresponding *ports* live in `core-domain`.

### 4. Technology-swappability policy

Every external technology **must** sit behind a port. Minimum set that must be swappable:

- Persistence / **event store**, **read-model store**, **object storage**, **auth**, **sync**,
  **AI provider**, **logging/telemetry**, **clock**, **id generation**.

**"Swappable to a reasonable degree"** is defined operationally: replacing a technology means
(a) adding a new adapter package that implements the existing port, and (b) changing the
composition root wiring — **with zero changes to Domain or Application code**. Examples that must
hold: local SQLite → Postgres; MinIO → R2; Claude → Ollama; Supabase Auth → another IdP.

Not everything is swappable at zero cost (e.g. React Native vs web rendering); the policy applies to
**infrastructure behind ports**, and the presentation layer is kept thin and token-driven (ADR 0007)
so UI frameworks are contained, not entangled with business logic.

### 5. Conventions

- Adapter packages are named by capability + technology: `@grimora/<capability>-adapter-<tech>` (or
  the existing capability-named packages where the technology is implied), and export only a factory
  that returns a port implementation.
- Ports use the `…Port` suffix; adapters never appear in Domain/Application imports.
- Cross-boundary errors use the `Result` type from `shared-types` for expected failures; unexpected
  failures throw and are handled at the composition root (detailed in ADR 0009).
- Each package has a single public entry (`src/index.ts`); internals are not deep-imported.

### 6. Ports catalog (stub — expanded by ADRs 0004–0009)

| Capability | Port (in core-domain) | Planned adapters (local / cloud) | Detailed in |
| --- | --- | --- | --- |
| Event store | `EventStorePort` | SQLite/IndexedDB / Postgres(Supabase) | ADR 0004, 0005 |
| Read models | `ReadModelStorePort` | SQLite/IndexedDB / Postgres | ADR 0004 |
| Sync | `SyncPort` | offline-sync (PowerSync/Electric/RxDB/custom) | ADR 0005 |
| Object storage | `ObjectStoragePort` | MinIO / Cloudflare R2 | ADR 0005 |
| Auth | `AuthPort` | Supabase Auth / other IdP | ADR 0009 |
| AI provider | `AiProviderPort` | Ollama / Claude / OpenAI | ADR 0008 |
| Plugin loader | `PluginHostPort` | in-process plugin loader (plugin-sdk) | ADR 0006 |
| Logging | `LoggerPort` | pino / Sentry | ADR 0009 |
| Clock / Id | `ClockPort`, `IdGeneratorPort` | system / deterministic (tests) | ADR 0004 |

## Consequences

**Positive**

- Business logic is isolated, unit-testable without infrastructure, and portable.
- Technologies are swappable per the policy; large refactors are localized to adapters/wiring.
- The dependency rule is machine-checkable → drift is caught in CI (#9).
- Plugins and FE/BE evolve independently through stable contracts.

**Negative / costs**

- More packages and indirection; a port+adapter pair is more code than a direct call.
- Requires discipline; mitigated by the automated conformance harness (#9) and this ADR as the
  single source of truth for boundaries.

## Enforcement (input to #9)

The conformance harness will encode, at minimum:

- `core-domain` must not import any adapter/app/plugin package.
- Domain code must not import Node/DOM/framework or I/O modules.
- `plugins/*` may import `@grimora/plugin-sdk` and `@grimora/shared-types` only.
- No deep imports across packages; no dependency cycles.
- Every adapter package exports an implementation of a declared port.

## Alternatives considered

- **Layered/N-tier only** — allows accidental downward tech leakage into business logic; weaker
  swappability guarantees. Rejected.
- **Framework-centric (e.g. Next.js-first, Supabase-first)** — fastest to start, but couples the
  domain to a vendor and makes the "swap technology / big refactor" goals hard. Rejected.
- **Feature-sliced only** — good for UI organization; complementary but insufficient as the top-level
  boundary model for a rule-agnostic core with plugins. Adopted *within* presentation where useful.

## References

- Vision & requirements: [`docs/vision.md`](../vision.md)
- Tech stack: [`docs/adr/0002-tech-stack-and-tooling.md`](0002-tech-stack-and-tooling.md)
- Follow-up ADRs: 0004 (ES/CQRS), 0005 (persistence/sync), 0006 (plugins), 0007 (theming),
  0008 (AI), 0009 (cross-cutting). Enforcement: issue #9.
