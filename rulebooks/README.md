# Local reference rulebooks (NOT committed)

This folder holds **local reference material** for building rule-system plugins — rulebook **PDFs**
and **links** to online-hosted rules (e.g. DSA5, Pathfinder, D&D). It is used by developers and AI
agents to look up exact rules/terms while implementing a plugin.

## ⚠️ Never commit rulebook content

Everything in this folder **except this README is git-ignored** (see the root `.gitignore`). Rulebook
PDFs and publisher content are **copyrighted** and **must never** be pushed to the (public)
repository. This mirrors the DSA5 content boundary in
[`docs/legal/dsa5-content-boundary.md`](../docs/legal/dsa5-content-boundary.md): plugins ship
**mechanics/structure only**, never proprietary content.

## Layout

```
rulebooks/
  README.md            (committed — this file)
  <system>/            (git-ignored) e.g. dsa5/, pathfinder2e/, shadowrun6/
    *.pdf              local rulebook PDFs
    sources.md         links to online-hosted rules (URLs), notes
```

## Adding a system

- Drop the PDF(s) into `rulebooks/<system>/`, or
- Create `rulebooks/<system>/sources.md` with links to the official online rules.

Because the contents are git-ignored, they stay on your machine only.
