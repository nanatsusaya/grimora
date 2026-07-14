# ADR 0029 — DSA5 rule-fidelity Single Source of Truth (the DSA5 vault)

- **Status:** Proposed
- **Date:** 2026-07-14
- **Deciders:** project owner + AI agents
- **Depends on:** [ADR 0020](0020-core-vs-plugin-boundary.md) (Plugin = concrete rule system) ·
  [ADR 0021](0021-rules-execution.md) (formula/dice/roll mechanic) ·
  [ADR 0025](0025-plugin-sdk-v0-contract.md) (SDK trait/check surface) ·
  [`docs/legal/dsa5-content-boundary.md`](../legal/dsa5-content-boundary.md) (the binding content boundary)

## Context

The DSA5 plugin (`plugins/dsa5`) re-implements DSA5 mechanics **in our own code** — attributes, the
3d20 skill-check mechanic, pure-attribute derived values, and the 59-talent roster (ADR 0020: *plugin =
the concrete rule system + its math + its dice*). Because the content boundary forbids shipping verbatim
rule text (`docs/legal/dsa5-content-boundary.md`), each mechanic is a **self-implemented** distillation,
not a copy — which means its **fidelity to the actual DSA5 rule cannot be checked by comparing text**.
Until now, provenance was ad-hoc: a free-text comment naming the Regel-Wiki, with no per-rule anchor a
reviewer could open and diff against.

That gap is not hypothetical. A cross-check on 2026-07-14 found the plugin's Life-Points formula shipped
as `LP = 5 + COU + AGI` — **not** a real DSA5 rule (real DSA5: `species LE base + 2×CON`). It had passed
review and tests because there was no authoritative reference to check it against; the wrong formula was
simply asserted. By contrast, `DODGE = round(AGI/2)` and `INI = round((COU+AGI)/2)` were confirmed
**correct** — but only once an authority existed to confirm them against.

Separately, the owner now maintains a **DSA5 knowledge vault** — a structured, versioned, bilingual
(de/en) Obsidian capture of the rules, one note per rule element, each note keyed by its stable official
**Regel-Wiki** id (`regelwiki:` frontmatter). It is the intended feed for the owner's *separate, private*
content plugin (see `docs/vision.md` North Star / public-private split). It is therefore the natural
**authority** to verify the public plugin's mechanics against — and, being versioned and owner-controlled,
a far better authority than an ad-hoc website reference.

Two properties shape the decision. (a) The vault is a **private** repository and contains **verbatim
copyrighted** DSA5 text; it must never be imported, vendored, or reproduced into the OSS repo — only
**referenced**. (b) Every vault note carries the same public `regelwiki:` id, so **one** stable id serves
as both the contributor-resolvable public citation *and* the join key into the private vault note.

## Decision

### 1. The DSA5 vault is the rule-fidelity Single Source of Truth

The DSA5 vault (`github.com/nanatsusaya/dsa5`, private; local working copy
`E:\My Projects\DasSchwarzeAuge\dsa5`) is the **authoritative reference** against which every DSA5
mechanic implemented in `plugins/dsa5` is verified. "Authoritative" is about **fidelity**, not
dependency: the vault is **not** a build-time, runtime, or content dependency of Grimora — there is no
import, no generated artifact, no vendored data. It is a **reference layer** a human (or agent) opens to
confirm a mechanic matches the rule.

### 2. Every implemented rule carries a two-layer source reference

Each implemented DSA5 mechanic records **where in the rules it comes from**, in two layers that share one
key:

- **Public layer — the Regel-Wiki id/URL** (German <https://dsa.ulisses-regelwiki.de/>, English
  <https://tde.ulisses-regelwiki.de/>). Contributor-resolvable; already explicitly permitted by the
  content boundary ("links to the official DSA Regel-Wiki … instead of reproducing it"). This is the
  **normative, public** citation.
- **Private layer — the vault note** (repo `nanatsusaya/dsa5`, note path under `01 Regeln/…`). The
  owner's fidelity cross-check. It is an **additive private annotation**; because the vault is private the
  link is owner-only-resolvable **by design**, which is exactly why the public Regel-Wiki id remains the
  primary citation and the vault path is supplementary.

Both layers are **pointers**. No verbatim text ever flows vault → plugin. The shared `regelwiki:` id is
the stable join key between them (the vault note path is secondary and may drift if the vault reorganizes).

### 3. Where the reference lives in code

- **Talents** (`plugins/dsa5/src/talents/*`): a **structured field** on the `Talent` model
  (`regelwiki` URL, plus an optional `vaultNote` path). Structured because the roster is data — this makes
  the reference machine-readable and a **candidate future arch fitness function** (assert every catalog
  talent carries a source reference), so provenance cannot silently erode as the catalog grows.
- **Attributes, derived values, the check mechanic** (`attributes.ts` / `derived.ts` / `checks.ts`): the
  reference lives in the **module doc header + a per-entry comment**, because these derive SDK
  `TraitDefinition`/`CheckDefinition`s and the frozen SDK types (ADR 0025) cannot carry a DSA-specific
  provenance field.
- **`plugins/dsa5/README.md`** documents the SSOT and the two-layer convention once, authoritatively.

### 4. The content boundary is preserved (referencing ≠ reproducing)

Citing a stable id/path is **not** reproducing protected expression. This decision is a **direct
extension** of the content boundary's existing "link to the Regel-Wiki, don't reproduce it" allowance —
it adds a *second, private* pointer keyed by the same id. The private vault (verbatim copyrighted text) is
**never** imported or vendored into the OSS repo. The boundary's *must-not* list (verbatim text, bulk
data-rich compilations, DSA data under the OSS license) is untouched: references carry **no** rule text.

### 5. Fidelity obligation

Every **newly implemented or corrected** DSA5 mechanic must (a) carry its two-layer reference and (b) be
**verified against the vault note before merge**. This is a review-checklist obligation now, and a
candidate arch fitness function once the reference set is complete (see O3). This formalizes the exact
cross-check that surfaced the LP defect — turning "the plugin is correct" from an assertion into something
checkable against one authority.

## Consequences

**Positive**

- Every implemented DSA5 rule becomes **gegen-checkable** against a single, versioned, owner-controlled
  authority — regressions and wrong-formula defects (like LP) are catchable at review instead of shipping.
- Formalizes the workflow that already caught the LP bug; makes fidelity a first-class, (eventually)
  machine-checkable property rather than a hope.
- Shares one SSOT across the **public** mechanics plugin and the owner's future **private** content plugin
  — the same vault feeds both, consistent with the vision's public/private split.
- Costs nothing at build/runtime and adds no dependency; it is pure documentation + convention.

**Negative / costs**

- The SSOT is a **private** repo, so external contributors cannot open the vault link. Mitigated: the
  **public Regel-Wiki id is the primary citation**; the vault path is a supplementary private annotation.
- Adds a **per-rule annotation burden** (a reference on ~70 mechanics + each future one). Mitigated by the
  structured field for talents and an eventual arch check.
- Couples references to the vault's note paths / regelwiki ids; a vault reorganization can **drift** the
  path pointers. Mitigated by keying on the stable `regelwiki:` id (path is secondary/best-effort).

## Alternatives considered

- **Regel-Wiki alone as SSOT (no vault).** Rejected: a website is not diffable, versioned, or
  owner-controlled; the vault is the owner's structured, versioned, bilingual capture and the intended
  feed for the private content plugin — a materially stronger authority.
- **Vendor the relevant vault notes into the Grimora repo** so references resolve publicly. Rejected:
  imports verbatim copyrighted text into the OSS repo — the content-boundary gates #2/#4 forbid exactly
  this.
- **No formal SSOT (status quo — ad-hoc comments).** Rejected: this is precisely what let the wrong LP
  formula ship unnoticed.

## Resolved questions (owner decisions, 2026-07-15)

- **R1 (was O1) — cross-reference amendments: yes, all three.** The owner explicitly authorized amending
  the Accepted ADRs. **ADR 0020** and **ADR 0025** receive owner-authorized amendment pointers to this ADR
  (recorded in their *Amendments* sections, ADR 0001), and the **content-boundary** doc's "link to the
  Regel-Wiki" bullet is extended to name the vault as the private SSOT. Applied in this PR.
- **R2 (was O2) — talent reference mechanism: structured field.** The `Talent` model gains a `regelwiki`
  field (+ optional `vaultNote`), so the reference is machine-readable and a future arch fitness function
  can assert its presence. Attributes/derived values/the check mechanic carry the reference in the module
  doc header + per-entry comment (they derive frozen SDK types that cannot hold a DSA-specific field).
- **R3 (was O3) — enforcement: defer.** The references land first (PR 2); the arch fitness function
  (every catalog talent carries a source reference) follows once the set is complete, to avoid a red
  `arch` gate mid-rollout.
- **R4 (was O4) — reference the private repo: keep both layers.** The public Regel-Wiki id is the
  normative, contributor-resolvable citation; the private vault note path is the additive owner anchor;
  the shared `regelwiki:` id joins them. No verbatim text crosses vault → plugin.

## References

- [ADR 0020](0020-core-vs-plugin-boundary.md) (core vs. plugin), [ADR 0021](0021-rules-execution.md)
  (rules execution), [ADR 0025](0025-plugin-sdk-v0-contract.md) (SDK v0 contract).
- [`docs/legal/dsa5-content-boundary.md`](../legal/dsa5-content-boundary.md) — the binding content
  boundary (this ADR extends its Regel-Wiki-link allowance).
- The DSA5 vault: `github.com/nanatsusaya/dsa5` (private) · local `E:\My Projects\DasSchwarzeAuge\dsa5`.
- Motivating defect: the `LP = 5 + COU + AGI` mis-formula, corrected under this SSOT (plugin PR, PR 3 of
  this workstream).
