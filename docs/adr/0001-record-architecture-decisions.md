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
Each records context, the decision, and consequences. ADRs are immutable once `Accepted`; a later
ADR can supersede an earlier one. Technology-choice reviews are captured as ADRs too.

## Consequences

- A durable, greppable decision log independent of any chat/session history.
- Small overhead per decision; large payoff in continuity for AI-agent-driven development.
