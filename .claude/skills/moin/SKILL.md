---
name: moin
description: >-
  Use at the start of a working session to bring up cleanly and orient: read who this project is and its
  goal, the standing operating rules and available skills, when it started, the last few work units, and —
  above all — the current state and the single clearest next step from the living docs. Flag (do not yet
  run) any due recurring maintenance, then ask the owner whether coffee is ready and whether we continue as
  planned. This is orientation, NOT a trigger to start work — it ends with a question, not an action. The
  counterpart to /feierabend.
---

# Grimora — Moin (session bring-up & orientation)

Starting a session cleanly is a repeatable procedure — the counterpart to `/feierabend`. Where feierabend
winds the session *down* (tidies git, parks WIP, brings the living docs current), `/moin` brings it *up*:
it produces a **consistent, complete orientation briefing** from the living docs rather than an ad-hoc
recap, so nothing important is missed on the way in. Follow the steps in order, read the sources **fresh**
(do not trust possibly-stale context), and **report faithfully** — an open PR, a failing state, or a due
task is stated plainly.

**Guardrails (do not violate):**

- **Orient, do not start work.** `/moin` ends with a **question**, not an action. Brief the owner, then
  wait for the go-ahead before beginning anything. If the briefing surfaces a new task, note it — do not
  begin it.
- **Read-only.** `/moin` reads and reports; it does not commit, branch, or change docs. The *only* possible
  write is a due recurring maintenance task — and only after the owner confirms in step 7 (see step 5).
- **The living docs are the source of truth for state**, not this file and not prior-context memory:
  `docs/STATUS.md` (state + next steps), `docs/recurring-tasks.md` (maintenance), the git log (work units).
- **Owner conversation is German**; repo artefacts stay English (CLAUDE.md). The briefing and the closing
  question are delivered in German.

## 1. Project identity — what & why

- **What this is** and its **goal**: the top of `CLAUDE.md` ("What this is") + `docs/vision.md` for the
  full product vision. One or two sentences, not a wall of text.
- **Since when**: the first commit date — `git log --reverse --format="%ad" --date=short | head -1`.
- Name the repo/working directory so it is unambiguous which project this session is in.

## 2. Standing rules & skills

- **Standing instructions**: the load-bearing rules from `CLAUDE.md` that shape *how* we work here —
  e.g. bugs-before-features, every change on a branch through an owner-merged PR, ADRs are normative,
  DSA5 content boundary, secrets only at the composition root, German-with-owner / English-in-repo. A
  compact reminder, not a re-read of the whole file.
- **Available skills**: what is in `.claude/skills/` and when to reach for each (currently
  `grimora-adr-author`, `feierabend`, and this `moin`).

## 3. Recent activity — the last work units

- The **last ~6 work units** as merged PRs (the meaningful unit, not raw commits):
  `git log --grep="Merge pull request" --format="%ad %s" --date=short -6`. Fall back to the plain commit
  log (`git log --oneline -6`) if there are few or no merge commits yet.
- Mention any genuinely methodological recent moment only if it bears on today's work (the meta-log is
  the home for those, not this briefing).

## 4. Current state — where we stand

- **Git state**: `git status` (branch, clean/dirty) and `gh pr list` — report every open PR awaiting the
  owner's merge, and any parked WIP branch.
- **Project state**: `docs/STATUS.md` → *Where we stand* — the honest current-phase snapshot (phase,
  what just landed, what is in flight). Summarize; do not paste the whole file.

## 5. Recurring maintenance — flag, do not run

- Check `docs/recurring-tasks.md`. For each task, compare its "next check due from" date to today and
  **report** which (if any) are **due**.
- **Do not run a due task here.** List it in the briefing and *offer* to run it as part of the go-ahead in
  step 7. Running maintenance is work; it happens only after the owner confirms (chosen behaviour:
  "melden, dann fragen"). If nothing is due, say so explicitly with the next due date — never skip silently.

## 6. The next step

- From `docs/STATUS.md` → *Next steps*, name the **single clearest next step** for this session (not the
  whole roadmap), plus any owner-domain decision that must be settled *before* it (per CLAUDE.md: do not
  implement ahead of a decision).

## 7. Coffee & go-ahead — the close

- Deliver the briefing **concisely in German** (identity, rules/skills, recent work, current state, due
  maintenance, the one next step).
- Then end with the ritual question in German — coffee first, then the direction check, e.g.:
  **"Hast du eine Tasse Kaffee bereit? ☕ Machen wir wie geplant weiter, oder lenken wir um?"**
- If step 5 flagged a due task, fold it into that go-ahead ("… und soll ich zuerst die fällige
  Wartungsaufgabe X erledigen?").
- Then **stop and wait**: begin no work until the owner answers. The answer sets the session's direction.
