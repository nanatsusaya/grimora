# ADR 0006 — Plugin system & extensibility contract

- **Status:** Proposed (→ Accepted on merge of the PR for issue #5)
- **Date:** 2026-07-05
- **Deciders:** project owner + AI agents
- **Depends on:** [ADR 0003](0003-overall-architecture.md) (ports, DDD §9), [ADR 0004](0004-event-sourcing-cqrs.md)

## Context

Grimora's core is **rule-system-agnostic**; concrete rule systems (first **DSA5**), themes and other
extensions are **plugins**, and **third parties** must be able to write them. Frontend and backend must
be **extensible independently**. Per ADR 0003 §9, each rule plugin is its **own bounded context**, the
**plugin SDK is the *Published Language*** and an **Anti-Corruption Layer** protects the core. This ADR
fixes the SDK contract, the manifest, the capability/permission (trust) model, FE/BE decoupling, and
versioning — so DSA5 can be built as the reference plugin without the core knowing anything DSA-specific.

## Decision

### 1. A plugin is a bounded context implementing the SDK

A plugin is a package whose **only** core dependency is `@grimora/plugin-sdk` (ADR 0003 §2/§9) — never
core internals, adapters or apps. It brings its own ubiquitous language; the host translates at the
boundary (ACL). The conformance harness (#9) enforces that plugins import nothing but the SDK.

### 2. Capabilities (extension points)

A plugin declares one or more **capabilities** in its manifest and contributes only those:

- **Rule system** — schemas for entities/attributes/skills, check/roll/formula logic, derived values,
  advancement, and **generators** (fixed + random) for characters and monsters/NPCs.
- **Theme** — a design-token set (+ optional assets), per ADR 0007.
- **Content pack** — user-provided data conforming to a rule-system schema (see §8, legal boundary).
- **UI extension** — components mounted into declared **UI slots** (frontend only).
- **AI tools** — tool/capability descriptors the AI agent may call (ADR 0008), mapped to public API ops.
- **Import/export** — converters for external data formats.

### 3. The SDK contract (declarative data + pure behaviour)

`@grimora/plugin-sdk` exposes stable **TypeScript interfaces + JSON Schemas**:

- **Definition APIs** (declarative): attribute/skill/entity schemas, generator specs, token sets, AI
  tool descriptors — **validated by JSON Schema at load** (fail fast on bad plugins).
- **Behaviour APIs** (code): **pure functions** for checks/formulas/generation, receiving a
  **capability-scoped context** (e.g. a seeded/deterministic `rng` derived from `IdGeneratorPort`, a
  scoped `logger`) — **never raw I/O, network, DOM or globals** (no ambient authority, ADR 0003 §6).
- **Registration**: a plugin exports `definePlugin(manifest, register)`; `register(registry)` adds its
  rules/slots/tokens/tools through a typed registry.

### 4. Manifest & versioning

- **Manifest** (`grimora.plugin.json`): `id` (reverse-DNS, e.g. `org.grimora.dsa5`), `name`, `version`
  (semver), the **SDK version range** it targets, declared **capabilities**, requested **permissions**,
  and a **content-boundary** declaration (§8).
- **SDK semver**: additive/back-compatible changes within a major; breaking changes → new SDK major +
  migration notes. The host advertises which SDK major(s) it supports; a plugin is loaded only if its
  range is compatible.
- **Provenance**: events/master data record which plugin + version produced them, so replay and
  upcasting (ADR 0004 §6) stay correct across plugin upgrades.

### 5. Capability & permission model (trust & isolation)

- **Least privilege**: a plugin receives only the capabilities/host-functions its manifest requests and
  the host/user grants.
- **Isolation, phased by trust**:
  - **First-party plugins** (e.g. DSA5) may run **in-process** (trusted).
  - **Third-party/untrusted** plugin *behaviour* runs in a **sandbox** — deterministic, no
    network/filesystem/DOM/global access; only granted host functions (e.g. Worker / isolated JS
    runtime). The concrete sandbox + threat model live in **ADR 0010**.
- All data access goes **through host ports**; the host enforces **authorization** (ADR 0009). Plugins
  never touch the event store, DB or secrets directly.

### 6. Backend vs. frontend decoupling

- A plugin package may contain **backend contributions** (rules/generators/AI tools — pure, run on
  server *or* client) and **frontend contributions** (UI-slot components, token sets), declared
  **per capability** with separate entry points.
- The host loads only what a runtime needs: the API/core loads rule/generator logic; the frontend loads
  UI/theme. A plugin can therefore ship a **backend-only rule change without touching the frontend**,
  and vice versa — satisfying the "extend FE and BE independently" requirement.

### 7. Discovery, loading & lifecycle

Register with the host (bundled first-party like DSA5 now; a **registry** for third-party later). Load =
validate manifest + SDK compatibility → validate definitions against JSON Schema → register capabilities
→ available to the app. Plugins can be enabled/disabled per user/campaign; disabling never deletes
event history (provenance is preserved for replay).

### 8. DSA5 legal boundary

`plugins/dsa5` ships **mechanics/structure only** (schemas + logic) — **no** copyrighted Ulisses texts
or values (see [`docs/legal/dsa5-content-boundary.md`](../legal/dsa5-content-boundary.md)). Proprietary
values/texts are **user-provided content packs**; the content-pack capability + import mechanism exist
precisely so users bring their own licensed data.

## Consequences

**Positive:** any rule system is supported via plugins; third parties can extend safely; FE/BE evolve
independently; DDD boundaries and the legal boundary are enforced; the capability model contains
untrusted code.

**Negative / costs:** a stable, versioned SDK is a long-term maintenance commitment; sandboxing
untrusted plugin code adds real complexity; the contract needs careful up-front design. Mitigations:
semver + **contract/conformance tests** (ADR 0017, #9); ship first-party in-process while the
third-party sandbox matures.

## Alternatives considered

- **No SDK; the core knows rule systems** — contradicts the entire vision. Rejected.
- **Data-only (config) plugins** — insufficient for check/formula/generation *behaviour*; kept as *one*
  capability (content packs), not the whole model.
- **Full process isolation for all plugins from day one** — safest but heavy; **phased** instead
  (first-party in-process, sandbox for third-party).

## References

- [ADR 0003](0003-overall-architecture.md) (ports, DDD §9), [ADR 0004](0004-event-sourcing-cqrs.md)
  (events, provenance, upcasting), ADR 0007 (theme tokens), ADR 0008 (AI tools), ADR 0009
  (authorization), ADR 0010 (plugin sandbox & threat model), ADR 0017 (contract tests),
  [`docs/legal/dsa5-content-boundary.md`](../legal/dsa5-content-boundary.md). Issue #5.
