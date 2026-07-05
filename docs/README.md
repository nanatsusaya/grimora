# Grimora documentation

- [`adr/`](adr/) — Architecture Decision Records. One file per significant decision, numbered.
  Every technology choice and non-trivial design decision is recorded here (project requirement).
- [`legal/`](legal/) — legal boundaries and compliance notes (DSGVO/BDSG, DDG/TTDSG, EU AI Act,
  EU Cyber Resilience Act, BFSG), including the DSA5 content boundary.

## Writing an ADR

Copy the format of an existing ADR. Status is one of `Proposed` / `Accepted` / `Superseded`.
Keep decisions immutable: to change one, add a new ADR that supersedes the old one.
