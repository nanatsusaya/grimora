# @grimora/plugin-sdk — **provisional v0** (walking-skeleton stage)

The published contract a rule-system plugin implements: the trait meta-model vocabulary (ADR 0020),
the formula AST + builder and the dice/roll model (ADR 0021), the Behaviour-API context, and
`definePlugin`/`register` (ADR 0006 §3).

> ⚠️ **These shapes are provisional validation artifacts, not the frozen public contract.**
> ADR 0022 §3 / R1–R3: the walking skeleton concretizes just enough SDK surface to run and validate
> the architecture. The **frozen** plugin-SDK v0 contract — the stable surface third-party plugins may
> depend on — is decided separately in **ADR 0025** (issue #62), *informed by* this skeleton. Do not
> treat anything here as stable until then.

## Dependency position

Imports **`@grimora/shared-types` only** (the leaf). Both `core-domain` (the host side) and
`plugins/*` (the plugin side) import this package — it is the shared "published language" between them
(ADR 0003 §9), which is why the AST/trait/roll contract types live here rather than in `shared-types`
(kept minimal) or `core-domain` (which plugins may not import).
