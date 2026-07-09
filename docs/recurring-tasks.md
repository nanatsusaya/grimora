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

### Pinned bun version — bump deliberately (quarterly, or when a needed fix lands)

- **Interval:** quarterly, tied to shared project work (not an unattended cron).
- **Last checked:** **2026-07-09** · **next check due from: 2026-10-09**.
- **Context:** CI pins `bun-version` to a concrete version in `.github/workflows/ci.yml` (not `latest`)
  for reproducibility (matches the frozen-lockfile discipline; a bun release cannot break CI unbidden).
  The pin therefore ages and must be bumped **deliberately**, never implicitly. Current pin: **1.3.14**
  (local dev version at the time). `setup-bun` is SHA-pinned and maintained by Dependabot; the
  `bun-version` **input** is not — hence this manual check.
- **How to check:** compare the pinned version against the latest stable
  (`gh api repos/oven-sh/bun/releases/latest --jq .tag_name`) and the version used locally; note any
  bun changelog item Grimora actually needs.
- **If a bump is warranted → action:** update `bun-version` in `ci.yml` (and this line), run the **full
  local chain** on the new version first, as a branch + PR. Treat a major bump like any dependency
  upgrade (own PR, rationale, check results — CLAUDE.md).
- **After each check:** update the "last checked" date above (commit), with a short note (even "still on
  1.3.14, no bump needed").

### Test coverage trend — watch for silent erosion (monthly)

- **Interval:** monthly, tied to shared project work (not an unattended cron).
- **Last checked:** **2026-07-07** · **next check due from: 2026-08-07**.
- **Context:** ADR 0017 §4/R2 deliberately keeps coverage **report-only** (`bun test --coverage`), not a
  CI gate, until enough real code exists to calibrate a sensible numeric floor. Report-only means
  coverage can silently erode with nobody blocking on it — this task is the backstop until a real gate
  exists.
- **How to check:** run `bun test --coverage` across workspaces with real code (currently only
  `packages/shared-types`); look for obviously untested Domain/Application logic once `core-domain`
  exists. While only `shared-types` has code, this check is a no-op — note that explicitly rather than
  skipping the task silently.
- **If `core-domain` + the first one or two adapters now have real test suites →** this is also the
  trigger named in ADR 0017 R2 to revisit whether a numeric coverage floor should be added as a CI gate —
  raise it as a topic, don't decide it silently in this recurring check.
- **After each check:** update the "last checked" date above (commit), with a short finding note (even
  if the finding is "still no-op, no real code to measure yet").
