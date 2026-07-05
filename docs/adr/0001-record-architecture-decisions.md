# ADR 0001 — Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-07-05

## Context

Grimora is a large, long-lived project developed and maintained largely by AI agents. A hard
project requirement is that every significant decision and the use of every technology is
documented as a markdown file. Undocumented decisions get re-litigated and context is lost between
agent sessions.

## Decision

We keep **Architecture Decision Records (ADRs)** as numbered markdown files under `docs/adr/`.
Each records context, the decision, and consequences. ADRs are immutable once `Accepted`, **except
when the project owner explicitly authorizes an amendment**; such amendments must be recorded in the
ADR's *Amendments* section (date + a note that the owner authorized it). Absent owner authorization,
a later ADR supersedes an earlier one rather than editing it. Technology-choice reviews are captured
as ADRs too.

## Consequences

- A durable, greppable decision log independent of any chat/session history.
- Small overhead per decision; large payoff in continuity for AI-agent-driven development.
- Amendments to Accepted ADRs are possible but gated on explicit owner authorization and are logged,
  preserving the audit trail.

## Amendments

- **2026-07-05** — Introduced the owner-authorized amendment exception (previously ADRs were strictly
  immutable once `Accepted`). Authorized by the project owner.
