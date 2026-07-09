---
name: feierabend
description: >-
  Use at the end of a working session to wind down cleanly: tidy the git/branch state, finish or safely
  park in-flight work at an honest stopping point, bring the living docs current (docs/STATUS.md, the
  meta-log, memory), run any due recurring task, then give a hand-off summary and wish the owner a good
  evening. This is a wind-down, NOT a trigger to start new work.
---

# Grimora — Feierabend (session wind-down & close-out)

Closing a session cleanly is a repeatable procedure. The goal is to leave the repo and the hand-off note
at a **clean, honest stopping point**: everything genuinely finished is finished; everything unfinished is
safely parked and clearly handed off. Follow the steps in order and **report faithfully** — a skipped step
or a failing check is stated plainly, never glossed.

**Guardrails (do not violate):**

- **Start no new work.** If a new task surfaces, note it (ticket/backlog/next-step) — do not begin it.
- **Do not merge PRs** — the owner merges every PR. List them and report state.
- **Do not commit to `main`** except the two documented exceptions (the meta-log, and an ADR
  `Proposed → Accepted` flip). Everything else goes on a branch through a PR.
- **Owner conversation is German**; repo artefacts stay English (CLAUDE.md).

## 1. Git & branch hygiene

- `git status` — make sure nothing important is uncommitted or about to be lost. Uncommitted work is
  either **finished** (step 2), or **parked** on a branch with a clear WIP commit, or explicitly surfaced
  in the hand-off. Never leave it dangling and unmentioned.
- If PRs merged this session: `git checkout main && git pull --ff-only`, delete the merged branch(es)
  (`git branch -d …`; the remote is usually auto-deleted on merge), then `git fetch --prune`.
- `gh pr list` — report every still-open PR and its state so the owner knows what awaits a merge.
- End on `main`, working tree clean (unless a branch is deliberately parked and named in the hand-off).

## 2. Finish what is finishable (Definition of Done)

For work done this session, apply CLAUDE.md's Definition of Done before calling it done:

- The full local chain is green — `lint`, `typecheck`, `arch`, `test`, `build`. Report any red honestly.
- Anything with runtime behaviour is **verified end-to-end**, not just via tests.
- Code **and** its docs changed together (ADRs, `STATUS.md`, READMEs, inline headers) — stale docs are a
  defect.
- Only claim a task done at **≥ 95 % confidence**. If you are not there, park it and hand off the
  *specific* uncertainty rather than declaring it finished.

## 3. Bring the living docs current

- **`docs/STATUS.md`** — bump `Last updated`, refresh *Where we stand* / *Next steps* if the session
  changed them, and make the "what's open / what's next" honest (open PRs awaiting merge, parked WIP, the
  single clearest next step). This is a PR change like any other (not direct-to-`main`).
- **`docs/meta/agent-collaboration-log.md`** — log **only** genuinely methodological moments (owner
  corrections + rationale, cross-model cross-checks, workflow experiments), never routine task execution.
  Direct-to-`main` is allowed for this file.
- **Memory** (`../memory/`) — save durable new user/feedback/project/reference facts worth carrying to the
  next session, and add the one-line pointer in `MEMORY.md`. Do not save what the repo already records
  (code structure, git history, CLAUDE.md) or what only mattered to this one conversation.

## 4. Recurring maintenance

- Check `docs/recurring-tasks.md`; run any task whose interval has elapsed since its "last checked" date,
  then update that date (its own small PR if it produces a change).

## 5. Hand-off summary + close

- Give a **concise** recap in German: what was accomplished, what is open (PRs awaiting the owner's merge,
  any parked WIP), and the single clearest next step for the next session.
- Wish the owner a good evening — **"Schönen Feierabend!"**
- Then stop: begin nothing new, and leave the session at a clean stopping point ready to close.
