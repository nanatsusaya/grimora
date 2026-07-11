---
name: weiterimtext
description: >-
  Use mid-session to move cleanly from a just-merged PR to the next task — the seam between two units of
  work, the counterpart to /moin (session bring-up) and /feierabend (session wind-down). After the owner
  merges a PR: confirm it actually landed, tidy the git/branch state, bring the living docs current, then
  re-validate the next task against current reality and start it ONLY if it is genuinely agent-ready and
  decision-free — otherwise surface the decision and stop. Keeps the session's context; re-verifies the
  external world before writing. Triggered by the owner ("PR gemergt, weiter im Text").
---

# Grimora — Weiter im Text (mid-session task transition)

Between finishing one unit of work (a merged PR) and starting the next, there is a **seam** — and that
seam is where things quietly go wrong: a branch is left dangling, `STATUS.md` drifts, or the "next task"
you had in mind was already done (or invalidated) by a PR that merged while you were busy. This skill
makes that transition a **repeatable, deliberate procedure**: close out the finished unit cleanly, then
orient into the next one **against the current state of the world**, and only start it if it is genuinely
ready to be started.

It is the warm-transition counterpart to the cold-start `/moin` and the cold-close `/feierabend`.
Because it runs **mid-session**, it is deliberately **light**: you are already oriented on the project —
do **not** re-brief project identity, history, or standing rules. Focus on the seam.

## Core principle — keep the context, re-verify the world

The session's accumulated context (the decisions, the *why*, the reasoning so far) is an **asset — keep
it**. This skill does **not** ask you to distrust it, clear it, or start from a blank slate.

What *does* change outside your control is the **external, shared state**: `main`, open PRs, issue
status, and the actual file contents on `origin` — the owner and parallel sessions move these while you
work. So the discipline here is narrow and specific: **before writing to a living/shared artefact or
committing to the next task, re-fetch and re-check that external state.** (This exists because a real
incident — a parallel session merged the same `STATUS.md` change under us — was an *external-state* miss,
not a context problem. Re-verifying the world would have caught it; distrusting our own context would
not.)

**Guardrails (do not violate):**

- **Gated autonomy — the crux of this skill.** The cleanup and doc-sync (steps 1–3) run autonomously.
  Starting the *next task* (step 5) does **not**: begin implementation **only** when the task is
  genuinely **agent-ready and decision-free**. If it needs an owner-domain decision (roadmap/sequencing,
  legal, licensing, a public API/SDK or core-vs-plugin change, external calls/secrets/AI, a major
  upgrade), is an **epic that must be decomposed with the owner first** (e.g. a `apps/web`-shell-sized
  ticket), or is ambiguous — **stop and ask**, do not run ahead of the decision (CLAUDE.md).
- **The owner merges every PR.** This skill never merges. It acts *after* a merge the owner already did —
  step 1 verifies that; if the PR is not actually merged, it stops.
- **Never commit to `main`.** Every change (including the doc-sync in step 3) goes on a branch through a
  PR — the two documented exceptions only are the meta-log and an ADR `Proposed → Accepted` flip.
- **Owner conversation is German**; repo artefacts stay English (CLAUDE.md).

## 1. Verify the precondition — did the unit actually close?

Do not tidy up work that is not finished. Read the **current** state fresh, do not assume:

- `git status` and `gh pr list` — confirm the just-finished PR is **actually merged** (not merely opened
  or approved). `git fetch` first so this reflects `origin`, not a stale local view.
- If the PR is **not** merged yet (the owner has not merged, CI is red, or changes were requested), or if
  there is **uncommitted/dangling WIP** that is not part of the merged unit — **stop here**, report the
  real state plainly, and let the owner resolve it. Do not proceed to cleanup on a false premise.

## 2. Git & branch hygiene

- `git checkout main && git pull --ff-only origin main` — sync to the merged state.
- Delete the merged branch: `git branch -d <branch>` locally; the remote branch is usually
  auto-deleted on merge (a failing `git push origin --delete` then just means it was already gone).
- `git fetch --prune`. End on `main`, working tree clean.

## 3. Bring the living docs current — after re-checking external state

The finished PR may have changed *what is true*; a **parallel** PR may have **already** updated the same
docs. So re-verify before writing (core principle above):

- Re-read the **current** `docs/STATUS.md` on the freshly-synced `main` — plus recent merges
  (`git log --grep="Merge pull request" -5`) and open PRs — to see whether the state is **already**
  reflected. If another session already synced it, do **not** duplicate the change; note it and move on.
- Only if genuinely stale, update `docs/STATUS.md` (and any other affected living doc — `ports-catalog.md`,
  READMEs, ADR index) to reflect what just landed and what is next. This is a normal **branch + PR**
  change, not direct-to-`main`; keep it one focused concern (a doc-sync PR is its own PR).
- `docs/meta/agent-collaboration-log.md` — only if a genuinely methodological moment occurred (owner
  correction + rationale, cross-model cross-check, workflow experiment). Direct-to-`main` allowed here.

## 4. Re-validate the next task against current reality

Take the **single clearest next task** from `docs/STATUS.md` → *Next steps* (and its GitHub issue/epic) —
but treat the plan you formed earlier as a *hypothesis*, not a given, because the world may have moved:

- **Still the right next step?** Or has a merged PR reordered priorities, or is there now a *bug* that
  jumps the queue (bugs before features)?
- **Already done / obsolete?** Re-read the issue's current state and acceptance criteria — a parallel
  merge may have closed it or changed its scope.
- **Preconditions met?** The dependencies it names (other tickets, an adapter, an ADR being Accepted) —
  are they actually in place now?
- **Owner decision open?** If an Accepted-ADR amendment, a public contract, a core/plugin-boundary move,
  external calls/secrets/AI, or a major upgrade is implied — that is the gate (below).

## 5. Start clean — or checkpoint

- **If the task is agent-ready and decision-free:** cut a fresh branch from the up-to-date `main`
  (`feat/…`, `fix/…`, `docs/…`, `chore/…` per its type) and begin — carrying the full session context
  forward, working end-to-end to CLAUDE.md's Definition of Done. This is the "weiter im Text".
- **If the gate in step 4 tripped** (owner-domain decision, an epic needing joint decomposition, or
  ambiguity): do **not** start. Present the specific decision or planning need **concisely in German**,
  recommend a default, and ask — then wait. Starting the next task is not worth undermining the owner's
  review control.
- Either way, report the transition briefly: what closed, what the docs now say, and either "started X on
  branch Y" or the open question that needs the owner.
