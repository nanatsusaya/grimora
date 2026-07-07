# Agent collaboration log

A running journal of **how** the owner and AI agents work together on Grimora — separate from the ADRs
(`docs/adr/`, which record architecture decisions) and `docs/STATUS.md` (which records project state).
This exists because a primary goal of the Grimora project is the owner's own skill-building in directing
and cross-checking AI coding agents; the RPG platform is the vehicle, not the sole point (see the
project's `MEMORY.md`/`owner_goal_agent_learning` note for agents picking this up cold).

**What goes here:** genuinely methodological moments — cross-checks against another model/agent, owner
corrections with their rationale, workflow experiments and their outcome. **What does not go here:**
routine task execution (that's what commit history and `STATUS.md` are for).

**Entry template:**

```
## YYYY-MM-DD — Short title

**Trigger:** how the topic came up.
**Action / method:** what was actually done.
**Impact:** what changed as a result (or didn't).
**Lessons learned:** what this suggests for next time, if anything.
```

This is a **living doc** — direct commits to `main` are allowed (CLAUDE.md, "Delivery workflow & PRs").

---

## 2026-07-07 — Establishing the meta-log itself

**Trigger:** After finishing ADR 0021 (Rules Execution), the owner named the project's actual primary
goal explicitly: learning to work with AI agents, with Grimora as the case study. They asked for (a) a
running log of methodology decisions and their impact, (b) an assessment of an existing practice
(repeatedly asking ChatGPT for a second opinion on project state and showing the answer to Claude), and
(c) feedback on their own collaboration style.

**Action / method:** Proposed this log's structure and scope; recommended it stay a low-friction living
doc (direct-commit, not PR-gated) logging only methodological moments, not every session — owner
confirmed both via `AskUserQuestion`. Documented the direct-commit exception in `CLAUDE.md` alongside the
existing ADR accept-flip exception, and saved a `user`-type memory (`owner_goal_agent_learning`) so future
sessions pick up this framing without being re-told.

**Impact:** New repo convention (`docs/meta/`) + a durable memory entry; this file now exists.

**Lessons learned:** Meta/process requests from the owner (not just "build X") are a first-class category
of work here, not a distraction — worth recognizing and acting on proactively rather than waiting to be
asked to formalize them.

## 2026-07-07 — Cross-model review pattern: assessment

**Trigger:** Owner asked whether "show Claude a second opinion from ChatGPT" is a good method, and what
alternatives exist.

**Action / method:** Assessed the existing practice against one concrete data point already in
`docs/STATUS.md` — the 2026-07-07 external ADR review that produced ADRs 0021–0024 and a roadmap
reprioritization. Identified the method's real value (a model without this session's accumulated context
catches things the primary agent may have rationalized away) and its blind spot (routing the critique
*through* the critiqued agent for a fairness check risks defensive or over-corrective bias). Proposed
complementary methods: native fresh-context subagents (no tool switch needed), falsifiable/specific
questions instead of open "what do you think", explicit adversarial framing, and rubric-based review
reusing the existing ADR self-review checklist (`.claude/skills/grimora-adr-author/adr-review-checklist.md`)
for comparability over time.

**Impact:** No process change yet — recommendation given, no commitment made by the owner to adopt a
specific alternative. Revisit and log the outcome once one of these is actually tried on a real decision.

**Lessons learned:** n/a yet — pending a real trial.

## 2026-07-07 — Owner correction: `RollResult.outcome` as an i18n key (ADR 0021, O3)

**Trigger:** While resolving ADR 0021's open questions, the owner accepted the recommended "opaque,
plugin-defined outcome" default (O3) but asked whether the human-readable part could be an i18n key
rendered per-need, rather than a literal string.

**Action / method:** Confirmed this is consistent with (and should reuse) two patterns already Accepted
elsewhere in the project — `AppError.messageKey` (ADR 0009 §1) and event `describe()` (ADR 0004 §10) —
and folded it into ADR 0021 §2 as `RollResult.outcome`'s `labelKey`, rather than treating it as a
deviation from the recommendation.

**Impact:** ADR 0021's roll-result shape is more consistent with the rest of the codebase's i18n
convention than the original draft was; a real substantive improvement from the owner, not a rubber stamp
of the AI-drafted default.

**Lessons learned:** The owner catches cross-cutting consistency issues (i18n conventions used
elsewhere) that a single-ADR-scoped drafting pass can miss even after checking the directly-referenced
ADRs — a concrete argument for keeping the owner in the loop on Decision-section wording, not just on the
Open Questions, for anything touching a pattern that recurs across multiple ADRs.
