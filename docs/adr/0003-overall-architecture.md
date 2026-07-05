# ADR 0003 — Overall architecture: Hexagonal / Ports & Adapters

- **Status:** Accepted
- **Date:** 2026-07-05 (accepted via PR #11, issue #2)
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
  api/              Backend (modular monolith): inbound HTTP adapter + wiring;  [composition]
                    the public API for web, plugins, and multi-device sync.
  web/ mobile/ desktop/  Frontends: composition roots + presentation.           [composition]
plugins/
  dsa5/             First rule-system plugin (mechanics/structure only).        [plugin]
```

Ports are declared in `core-domain` (`src/application/ports`). Adapter packages implement them.
The **event-store / cqrs-read / offline-sync / ai-agent** packages are adapters, not core — the
corresponding *ports* live in `core-domain`.

### 4. Technology-swappability policy

Every external technology **must** sit behind a port. Minimum set that must be swappable:

- Persistence / **event store**, **read-model store**, **object storage**, **auth**,
  **authorization/policy**, **secrets**, **cryptography**, **sync**, **AI provider**,
  **logging/telemetry**, **clock**, **id generation**.

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

### 6. Security & privacy by design (foundational)

Security and data protection are **architectural drivers, applied by design and by default** — not a
later add-on. This is both a product value and a legal obligation (DSGVO Art. 25 & 32, EU Cyber
Resilience Act, EU AI Act). The **threat model and concrete mechanisms live in ADR 0010**; the
following principles are binding at the architectural level and are directly supported by the hexagon:

1. **No ambient authority in the core.** Domain/Application obtain all I/O, time, randomness, secrets
   and network access *only* through injected ports — never directly. Security-relevant access is
   therefore explicit and reviewable, and the attack surface is minimized.
2. **Adapters are the trust boundaries.** Input validation, authentication, rate limiting and output
   encoding happen at adapters; the core receives already-validated, typed data.
3. **Authorization as an explicit policy.** Access decisions go through an `AuthorizationPort` /
   `PolicyPort` enforced in the Application layer — not scattered across the codebase.
4. **Secrets only at the composition root.** Secrets are injected into adapters there and must never
   appear in Domain, Application, plugins, or logs.
5. **Least privilege for plugins.** Plugins receive only the capabilities the plugin SDK grants; they
   cannot reach core internals, secrets, other plugins, or raw I/O. The plugin permission /
   sandboxing model is a key supply-chain trust boundary (ADR 0006 + ADR 0010).
6. **Privacy by default.** Data minimization, PII-aware logging (no PII in logs), and encryption in
   transit and at rest for stored/synced data (details in ADR 0005 / 0009 / 0010).
7. **Secure SDLC.** Dependency and secret scanning run in CI; the conformance harness (#9) also
   asserts security-relevant boundaries (see Enforcement).

### 7. Ports catalog (stub — expanded by ADRs 0004–0010)

| Capability | Port (in core-domain) | Planned adapters (local / cloud) | Detailed in |
| --- | --- | --- | --- |
| Event store | `EventStorePort` | SQLite/IndexedDB / Postgres(Supabase) | ADR 0004, 0005 |
| Read models | `ReadModelStorePort` | SQLite/IndexedDB / Postgres | ADR 0004 |
| Sync | `SyncPort` | offline-sync (PowerSync/Electric/RxDB/custom) | ADR 0005 |
| Object storage | `ObjectStoragePort` | MinIO / Cloudflare R2 | ADR 0005 |
| Auth | `AuthPort` | Supabase Auth / other IdP | ADR 0009 |
| Authorization | `AuthorizationPort` / `PolicyPort` | in-core policy engine | ADR 0010 |
| Secrets | `SecretsPort` | env / vault (composition root only) | ADR 0010 |
| Cryptography | `CryptoPort` | WebCrypto / libsodium | ADR 0005, 0010 |
| AI provider | `AiProviderPort` | Ollama / Claude / OpenAI | ADR 0008 |
| Plugin loader | `PluginHostPort` | in-process plugin loader (plugin-sdk) | ADR 0006 |
| Logging | `LoggerPort` | pino / Sentry | ADR 0009 |
| Clock / Id | `ClockPort`, `IdGeneratorPort` | system / deterministic (tests) | ADR 0004 |

### 8. Architecture style, scope & decision map

**Architecture style: modular monolith.** The backend is a single deployable **modular monolith**
(`apps/api`) whose internal boundaries are the hexagon from §1–2 — not a network of microservices.
Rationale: for a solo-owner + AI-agent team (Conway's Law), one deployable is simplest to build,
test and operate; offline-first already pushes core logic to the client; module boundaries are
enforced in-process by the conformance harness (#9). Services can be **extracted later** behind the
existing ports if a real need arises (independent scaling/deployment). Serverless/edge functions may
host individual adapters (e.g. an AI proxy) without changing the style.

**The public API** (`apps/api`) is the primary integration boundary: an inbound (driving) adapter
exposing the application's use cases, consumed by the web/mobile/desktop frontends, by external
**plugin** integrations, and for multi-device **sync**. Offline clients run the same application
core locally; the API serves the cloud/shared path. API specifics (protocol, versioning, contract
format, error shape) are decided in ADR 0011 — **contract-first** is the principle.

**Cross-cutting principles owned here (not separate ADRs):** testability is a first-class design
criterion (the hexagon makes the core testable without infrastructure; strategy in ADR 0017);
**build-vs-buy** is applied per decision (e.g. Supabase = buy auth), biased toward not reinventing
commodities while avoiding lock-in (§4); **Conway's Law** favours the single modular deployable for
this team shape; **sustainability / green coding** is a tracked consideration (efficient queries,
bundle budgets — see ADR 0013).

**Scope of this ADR.** 0003 owns the high-level structure (layers, dependency rule, module map,
swappability, security principle, architecture style). Every other concern has a dedicated ADR so
each decision stays reviewable in isolation (ADR 0001). Decision map:

| Concern | Decided in |
| --- | --- |
| Event Sourcing & CQRS, data model, migrations | ADR 0004 |
| Persistence, offline sync, object storage, at-rest crypto | ADR 0005 |
| Plugin system, extensibility, plugin trust/permissions | ADR 0006 (+ 0010) |
| Theming, design tokens, responsive/adaptive, code-sharing | ADR 0007 (+ 0002) |
| AI integration (prompt-injection, cost, third-party data flow) | ADR 0008 (+ 0010) |
| Error handling, logging & observability (OTel), auth mechanics (OAuth2/OIDC, RBAC/ABAC) | ADR 0009 |
| Security & privacy by design, OWASP, secrets, threat model, supply chain | ADR 0010 |
| API design & contracts (REST/GraphQL/gRPC, versioning, OpenAPI, error format) | ADR 0011 |
| Web rendering & frontend state (SSR/SSG/CSR/hybrid) | ADR 0012 |
| Scalability, performance, caching, async/queues, perf budgets (Core Web Vitals) | ADR 0013 |
| DevOps: CI/CD, IaC, environments, deploy strategy, feature flags, backup/DR (RTO/RPO) | ADR 0014 |
| Compliance & data protection (DSGVO ops, consent, EU residency, DPAs, erasure/DSAR) | ADR 0015 |
| Accessibility (WCAG 2.2 AA / BFSG) & i18n | ADR 0016 |
| Testing strategy (test pyramid, testability) | ADR 0017 |
| Hosting & cost model (FinOps, anti-lock-in) | `docs/hosting.md` (+ ADR 0002) |

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
- Security fitness functions: no `SecretsPort`/secrets import outside composition roots; plugins
  cannot import adapters or secrets; dependency + secret scanning run in CI (ADR 0010).

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
  0008 (AI), 0009 (cross-cutting), 0010 (security & privacy by design). Enforcement: issue #9.
