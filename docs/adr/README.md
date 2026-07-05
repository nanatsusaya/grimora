# Architecture Decision Records

One file per significant decision, numbered `NNNN-title.md`. ADRs are immutable once `Accepted`; to
change one, add a new ADR that supersedes it (see [ADR 0001](0001-record-architecture-decisions.md)).

This index is checked by the architecture conformance harness (issue #9): every ADR file must be
listed here with a status.

| ADR | Title | Status |
| --- | --- | --- |
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions | Accepted |
| [0002](0002-tech-stack-and-tooling.md) | Tech stack and tooling | Accepted |
| [0003](0003-overall-architecture.md) | Overall architecture: Hexagonal / Ports & Adapters | Proposed |
| 0004 | Event Sourcing & CQRS model | Planned (issue #3) |
| 0005 | Persistence & offline-first sync adapters | Planned (issue #4) |
| 0006 | Plugin system & extensibility contract | Planned (issue #5) |
| 0007 | Theming architecture (design tokens SSOT) | Planned (issue #6) |
| 0008 | AI provider abstraction | Planned (issue #7) |
| 0009 | Cross-cutting: error handling, logging, security & auth | Planned (issue #8) |
| 0010 | Security & Privacy by Design | Planned (issue #12) |

Status values: `Proposed` · `Accepted` · `Superseded` · `Planned` (ticketed, not yet written).
