# Grimora documentation

## Master plan

- [`vision.md`](vision.md) — product vision & full requirements.
- [`roadmap.md`](roadmap.md) — phased plan (Phase 0–6) with status.
- [`hosting.md`](hosting.md) — hosting breakdown, costs, "completely local" setup.
- [`access-and-accounts.md`](access-and-accounts.md) — required access & accounts.
- [`naming.md`](naming.md) — name suggestions & the "Grimora" decision.
- [`ports-catalog.md`](ports-catalog.md) — every port in the hexagon: purpose, owning ADR, current
  implementation status, and which Phase-2 ticket builds its first real adapter.

## Decisions & constraints

- [`adr/`](adr/) — Architecture Decision Records. One file per significant decision, numbered.
  Every technology choice and non-trivial design decision is recorded here (project requirement).
- [`legal/`](legal/) — legal boundaries and compliance notes (DSGVO/BDSG, DDG/TTDSG, EU AI Act,
  EU Cyber Resilience Act, BFSG), including the DSA5 content boundary.

## Writing an ADR

Copy the format of an existing ADR. Status is one of `Proposed` / `Accepted` / `Superseded`.
Keep decisions immutable: to change one, add a new ADR that supersedes the old one.
