# ADR 0020 — Core vs. plugin domain boundary (rule-agnostic meta-model)

- **Status:** Accepted
- **Date:** 2026-07-05 (accepted via PR #27, issue #26)
- **Deciders:** project owner + AI agents
- **Depends on:** [ADR 0003](0003-overall-architecture.md) (DDD §9) · **Precedes/gates:** ADR 0006
- **Informed by:** [`docs/research/rule-systems-comparison.md`](../research/rule-systems-comparison.md)
  (DSA5, D&D 5e, Pathfinder 2e, Shadowrun 6, Star Wars FFG, Vampire/Storyteller, HeXXen 1733)

## Context

Grimora's core must be **rule-system-agnostic**, with rule systems added as plugins (ADR 0003 §9).
To draw the line precisely, we compared seven systems and asked what is **truly invariant** across
pen-&-paper RPGs versus what merely *looks* common but differs in every system.

## Decision

### Guiding principle (owner-approved)

> **Core = the meta-model (the ontology of a character/game) + rule-agnostic orchestration &
> organization. Plugin = the concrete rule system (a model instance) + its math + its dice.**

### The invariant (what is universal)

Every compared system has: **named entities** (player characters **and** NPCs/creatures) described by
a **structured set of named, graded traits**, assembled from **templates**, changed over time by
**progression**, tested by a **resolution mechanic**, and played by a **group under a game master**
across **campaign sessions**. The traits recur in the same **kinds** everywhere (only names/scales
differ): **attributes**, **skills**, **abilities/features**, **advantages/disadvantages**,
**resources/pools**, **derived values**, **items**, **templates**.

What is **not** invariant: *which* attributes (6 vs 8 vs 9), *which* scale (numbers vs symbol dice),
and above all the **dice/resolution mechanic** (3d20-under vs d20+mod-vs-DC vs d6-pool vs narrative
symbols vs d10-pool). Therefore the core models the **meta-structure**, and the concrete rule system
— including the dice — is a plugin.

### Core (rule-agnostic)

- User/accounts/auth.
- **Generic entity model**: `Character`, `NPC`/`Creature` aggregates (event-sourced) — identity
  (name, description, images) + a **schema-driven trait container**.
- **Trait meta-model**: attribute · skill · ability/feature · advantage/trait · resource/pool ·
  derived value · item · template-choice — as **generic, typed, plugin-populated slots**. The core
  knows "a character has attributes in category X", not "Mut"/"STR"/"Brawn".
- **Formula/derivation engine** (generic): evaluates plugin-defined formulas over traits.
- **Dice/resolution abstraction** (generic): RNG infrastructure, rolls logged as events, generic
  roll-request/result shape — the *mechanic* is a plugin.
- **Generation orchestration** (generic step-runner; fixed + random) — plugin supplies steps/tables.
- **Campaign / session / party / GM tooling** (membership, scheduling, notes/journal, handouts,
  shared state, generic initiative/turn tracker).
- **Asset system + library** (images/maps/tokens/handouts, tagging, attaching to entities).
- **Bestiary/entity catalog**, **inventory** (generic containers), search, i18n, theming shell,
  AI chat, sync, events.
- **Character-sheet shell**: renders a plugin-defined layout via UI slots; storage/edit/versioning
  infrastructure is core.

### Plugin (rule-specific)

- The concrete rule system: attribute set/names/scale, skill list, abilities, advantages,
  derived-value **formulas**, **the dice mechanic**, creation & advancement rules, spells/powers,
  combat rules, templates (species/class/clan/role/culture…), rule-specific validation.
- Rule-specific **character-sheet layout** (which traits, grouping) via the sheet-definition capability.
- **Themes**; **content packs** (rule/bestiary data — respecting the legal boundary,
  [`docs/legal/dsa5-content-boundary.md`](../legal/dsa5-content-boundary.md)).

### Boundary cases — Core scaffold + plugin rules (⚠ explicitly revisable)

- **Combat** → encounter/round/turn-order **scaffold = core**; attack/damage/manoeuvre **rules = plugin**.
- **Initiative** → tracker = core; calculation = plugin.
- **Status effects** → generic "status with duration" = core; concrete conditions = plugin.
- **Inventory/economy** → containers/currency concept = core; item stats/currency values = plugin.
- **Bestiary** → catalog/search = core; concrete stat blocks = plugin/content.

### Explicit rulings (answers to the framing questions)

- **Campaign management = CORE** (GM + group + story + sessions is rule-agnostic; rule-specific aids
  like DSA downtime or SR karma are plugin hooks).
- **Assets = CORE** (rule-agnostic media; a bundled asset library is core, further assets plugin/user).
- The invariant is the **meta-model**, *not* "characters with specific attributes".

### Revisitation clause

The **boundary-case assignments** (and, if implementation reveals a poor fit, some core/plugin
placements) **may be revised**. Any such change is recorded either as an owner-authorized **amendment**
(ADR 0001) or a **superseding ADR**. We expect to learn from building the DSA5 plugin (Phase 3).

## Consequences

**Positive:** a stable, minimal rule-agnostic core that genuinely supports *any* system; a clear brief
for every rule-system plugin; the DDD boundaries (ADR 0003 §9) get concrete content; ADR 0006's SDK
contract now has a precise surface to expose.

**Negative / costs:** the generic trait meta-model + formula/dice abstractions are more work than a
DSA-specific model would be, and getting the meta-model "just abstract enough" is the central design
risk — mitigated by the revisitation clause and by validating against DSA5 first.

## Alternatives considered

- **DSA5-specific core, generalize later** — faster now, but contradicts the vision and would force a
  painful re-architecture. Rejected.
- **Everything is a plugin (ultra-thin core)** — maximal flexibility, but campaign/asset/entity
  management is genuinely universal; making it plugin-provided would duplicate it in every rule system.
  Rejected.

## References

- [ADR 0003](0003-overall-architecture.md) (DDD §9, bounded contexts), ADR 0006 (plugin SDK — gated by
  this), ADR 0004 (events), [`docs/research/rule-systems-comparison.md`](../research/rule-systems-comparison.md).
  Issue #26.
