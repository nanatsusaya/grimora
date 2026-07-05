# Architecture Decision Records

One file per significant decision, numbered `NNNN-title.md`. ADRs are immutable once `Accepted`
**unless the project owner authorizes an amendment** (recorded in the ADR's *Amendments* section);
otherwise, to change a decision, add a superseding ADR (see
[ADR 0001](0001-record-architecture-decisions.md)).

This index is checked by the architecture conformance harness (issue #9): every ADR file must be
listed here with a status.

| ADR | Title | Status |
| --- | --- | --- |
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions | Accepted |
| [0002](0002-tech-stack-and-tooling.md) | Tech stack and tooling | Accepted |
| [0003](0003-overall-architecture.md) | Overall architecture: Hexagonal / Ports & Adapters | Accepted |
| [0004](0004-event-sourcing-cqrs.md) | Event Sourcing & CQRS model | Proposed (issue #3) |
| 0005 | Persistence & offline-first sync adapters | Planned (issue #4) |
| 0006 | Plugin system & extensibility contract | Planned (issue #5) |
| 0007 | Theming architecture (design tokens SSOT) | Planned (issue #6) |
| 0008 | AI provider abstraction | Planned (issue #7) |
| 0009 | Cross-cutting: error handling, logging, security & auth | Planned (issue #8) |
| 0010 | Security & Privacy by Design | Planned (issue #12) |
| 0011 | API design & contracts | Planned (issue #13) |
| 0012 | Web rendering & frontend state | Planned (issue #14) |
| 0013 | Scalability, performance & caching | Planned (issue #15) |
| 0014 | DevOps: CI/CD, IaC, environments, backup/DR | Planned (issue #16) |
| 0015 | Compliance & data protection (DSGVO) | Planned (issue #17) |
| 0016 | Accessibility (WCAG 2.2 AA / BFSG) & i18n | Planned (issue #18) |
| 0017 | Testing strategy | Planned (issue #19) |

Status values: `Proposed` · `Accepted` · `Superseded` · `Planned` (ticketed, not yet written).
