# Recurring maintenance tasks

Standing operational checks — **tracked in the repo (device-independent)** so they survive regardless
of which machine is used. Claude checks this list **at the start of a session**; if a task is due (its
interval has elapsed since "last checked") and we are working on the project, Claude runs it
proactively and **then updates the date here via a commit**.

> Reference: `CLAUDE.md` (Working conventions) points to this file so the check is reliably loaded into
> context.

## Active tasks

### Dependabot `bun.lock` — watch the workspace bug (weekly)

- **Interval:** weekly, tied to shared project work (not an unattended cron).
- **Last checked:** **2026-07-07** · **next check due from: 2026-07-14**.
- **Context:** Dependabot does not update `bun.lock` in bun **workspace** monorepos
  ([dependabot/dependabot-core#14223](https://github.com/dependabot/dependabot-core/issues/14223); cf.
  also #11602), so JS/TS version-update PRs fail `bun install --frozen-lockfile`. Because of this,
  `.github/dependabot.yml` is scoped to **github-actions only** (PR #47); JS security fixes are covered
  by **Dependabot alerts**, and routine JS updates run manually via `bun update`.
- **How to check:** the state of dependabot-core#14223 (closed/fixed?) —
  e.g. `gh issue view 14223 --repo dependabot/dependabot-core --json state,title` or WebFetch. If
  unclear, test empirically: temporarily add a `bun` ecosystem block and see whether a Dependabot PR
  updates `bun.lock`.
- **If fixed → action:** re-add a `package-ecosystem: "bun"` block to `.github/dependabot.yml` (weekly,
  grouped minor/patch), update the workaround notes in `dependabot.yml` + `STATUS.md`, and mark this
  task done / remove it here. As a branch + PR.
- **After each check:** update the "last checked" date above (commit), with a short finding note if
  relevant.
