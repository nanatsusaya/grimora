---
name: grimora-adr-author
description: >-
  Use when writing a new Architecture Decision Record or fleshing out a Planned ADR for Grimora
  (files in docs/adr/). Covers classifying the change (new vs. amendment vs. superseding), the required
  ADR structure and house style, the branch → Proposed → PR-with-owner-questions → merge → Accepted
  workflow, and the index/STATUS updates. Not for code changes.
---

# Grimora — ADR author

Authoring or reworking an ADR is a repeatable procedure. Follow it exactly: ADRs are **normative**
(CLAUDE.md) and drive all later code. Keep the ADR a *decision record*, never a shadow implementation.

## 0. Read the ground truth first

- `docs/STATUS.md` — current phase, the revised roadmap order, the intended next ADR.
- `docs/adr/README.md` — the index (statuses + the next free number; note `0018` is retired).
- The **owning issue** (`gh issue view <n>`) — its Context / decisions-to-make / acceptance criteria.
- Every **Accepted ADR this one depends on or touches** — actually read them; do not paraphrase from
  memory.
- `CLAUDE.md` guardrails (esp. "do not implement ahead of a decision" and the stop-and-ask list).
- If the topic touches a legal deadline/obligation: `docs/legal/eu-de-compliance-matrix.md` first.

## 1. Classify the change (decision tree)

- **New decision** → new ADR at the next free `NNNN`.
- **Change to an `Accepted` ADR** → **STOP and ask the owner.** Accepted ADRs are immutable except with
  explicit owner authorization, recorded in that ADR's *Amendments* section (ADR 0001). Without that,
  a changed decision needs a **superseding** ADR, not an edit.
- **Supersede** an old decision → new ADR with `Supersedes: NNNN`; set the old ADR's status to
  `Superseded` (file + index).

## 2. Branch + files

- Branch `adr/NNNN-slug` from current `main`.
- Create `docs/adr/NNNN-slug.md` with `Status: Proposed`.
- Set the index row in `docs/adr/README.md` to **Proposed** and **link the file**. The `arch` harness
  checks every ADR is linked with a status — run `bun run arch`.

## 3. Structure & house style (match ADR 0009 / 0010 / 0011)

**Header:**
`Status` · `Date` (YYYY-MM-DD) · `Deciders: project owner + AI agents` · `Depends on:` linked ADRs
**with the specific sections** relied on (e.g. `ADR 0009 §1`) · plus `Supersedes` / `Amended` if any.

**Body:**
1. **Context** — the forces; the repo state; what an owning/earlier ADR already fixed vs. what is open.
2. **Decision** — numbered `### 1. …` subsections. Make *decisions*, not a literature review. **Reuse**
   existing ADRs (don't re-decide their turf); cite `ADR 000X §Y`. Prefer **enforceable** choices —
   anything the conformance harness could assert becomes a fitness function (ADR 0003 §2 / 0010 §7).
3. **Consequences** — **Positive** and **Negative / costs**, honestly (name the real downsides).
4. **Alternatives considered** — each with a one-line "rejected because …".
5. **Open questions (for owner review)** — `O1..On`, the genuinely owner-domain choices; recommend a
   default for each. Do **not** self-answer these.
6. **References** — the ADRs/docs/issue.

## 4. Open the PR

- `Closes #<issue>` if it fully resolves the ticket. Body states **what · why · which ADR/issue ·
  architecture impact · how verified (`bun run arch`) · open questions**, ending with the Claude Code
  line (CLAUDE.md). Surface `O1..On` prominently.

## 5. After the owner answers the open questions

- Fold the answers into the Decision sections, and convert **"Open questions" → "Resolved questions
  (owner decisions, YYYY-MM-DD)"** recording `R1..Rn` (what was decided and why). Push to the same PR;
  leave a short resolution comment.

## 6. After the owner merges

- Sync `main`; flip **`Proposed → Accepted`** in both the ADR header
  (`Date: … (accepted via PR #NN, issue #N)`) and the index — a direct follow-up commit on `main` (the
  one workflow-sanctioned non-PR commit). Delete the branch.
- Update `docs/STATUS.md` (Accepted table + next step) if this changes the roadmap.

## Quality bar

Run [adr-review-checklist.md](adr-review-checklist.md) before opening the PR. Language: **English**.
