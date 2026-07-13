<!--
Grimora PR checklist — see CLAUDE.md → "Delivery workflow & PRs".
One concern per PR. The owner merges every PR. Delete any section that is genuinely N/A.
-->

## What

<!-- What this change does, concretely. -->

## Why

<!-- The rationale: the problem or goal it addresses. -->

## Which issue / ADR it follows

<!--
Link the issue/epic and any ADR this follows.
To auto-close an issue, write `Closes #NN` as PLAIN TEXT — never inside backticks / a code span,
or GitHub silently won't auto-close it.
-->

## Architecture impact

<!-- New/changed ports, packages, dependencies, or core-vs-plugin boundary effects — or "none". -->

## Verified

<!--
How it was checked: `bun run check` (lint → typecheck → arch → test → build), plus `bun run e2e`
if it touches apps/web. For anything with runtime behaviour, say how it was exercised end-to-end,
not just that tests pass.
-->

## Merge-order caveats

<!-- Any dependency on another PR/branch that must merge first — or "none". -->

## Follow-ups

<!-- Known deferrals / next steps split out of this PR — or "none". -->
