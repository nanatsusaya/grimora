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
| [0004](0004-event-sourcing-cqrs.md) | Event Sourcing & CQRS model | Accepted |
| [0005](0005-persistence-and-sync.md) | Persistence & offline-first sync adapters | Accepted |
| [0006](0006-plugin-system.md) | Plugin system & extensibility contract | Accepted |
| [0007](0007-theming.md) | Theming architecture (design tokens SSOT) | Accepted |
| [0008](0008-ai-provider-abstraction.md) | AI provider abstraction | Accepted |
| [0009](0009-cross-cutting-concerns.md) | Cross-cutting: error handling, logging, security & auth | Accepted |
| [0010](0010-security-and-privacy-by-design.md) | Security & Privacy by Design | Accepted |
| [0011](0011-api-design.md) | API design & contracts | Accepted |
| 0012 | Web rendering & frontend state | Planned (issue #14) |
| 0013 | Scalability, performance & caching | Planned (issue #15) |
| 0014 | DevOps: CI/CD, IaC, environments, backup/DR | Planned (issue #16) |
| 0015 | Compliance & data protection (DSGVO) | Planned (issue #17) |
| 0016 | Accessibility (WCAG 2.2 AA / BFSG) & i18n | Planned (issue #18) |
| 0017 | Testing strategy | Planned (issue #19) |
| 0018 | Domain-Driven Design | Retired — folded into ADR 0003 §9 |
| 0019 | Analytics & Telemetry | Planned (issue #23) |
| [0020](0020-core-vs-plugin-boundary.md) | Core vs. plugin domain boundary | Accepted |
| 0021 | Rules Execution: Formula, Dice & Deterministic Runtime | Planned (issue #41) |
| 0022 | Walking Skeleton / Golden Use Cases (validation gate) | Planned (issue #42) |
| 0023 | Event Payload Privacy Classification & per-subject encryption | Planned (issue #43) |
| 0024 | Realtime Session & Presence | Planned (issue #44) |

Status values: `Proposed` · `Accepted` · `Superseded` · `Planned` (ticketed, not yet written).

ADRs 0021–0024 were added on 2026-07-07 from an external ADR review (see `docs/STATUS.md`): the
existing ADRs cover the static architecture boundaries well, but the rules-execution model,
a validation walking skeleton, the crypto-shredding data-classification detail, and the realtime
collaboration tier were genuine gaps.
