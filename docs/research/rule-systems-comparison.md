# Rule-systems comparison (input to ADR 0020)

Comparison of the core building blocks of seven pen-&-paper RPGs, used to decide the core/plugin
boundary in [ADR 0020](../adr/0020-core-vs-plugin-boundary.md).

> **Sourcing.** HeXXen 1733 grounded via the Ulisses Regel-Wiki and a system overview
> (see Sources). The other six are from established system knowledge; exact German terms/values can be
> verified per system from the local reference rulebooks in `rulebooks/` on request.

## Building blocks per system

| System | "Attributes" | Skills | Special abilities | Advantages / disadvantages | Resources / pools | Dice / resolution | Templates | Advancement |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **DSA5** | 8 Eigenschaften (MU/KL/IN/CH/FF/GE/KO/KK) | Talente (groups) + Kampftechniken | Sonderfertigkeiten (combat/magic/karma) | Vor-/Nachteile | LeP, AsP, KaP | 3d20 under attribute, spend FW → QS | Spezies/Kultur/Profession | Abenteuerpunkte (cost columns) |
| **D&D 5e** | 6 abilities (STR…CHA) + mods | 18 skills, proficiency | Class features, feats | (via feats/features) | HP, spell slots, hit dice | d20 + mod vs DC, (dis)advantage | Race/Class/Background | XP → levels 1–20 |
| **Pathfinder 2e** | 6 attributes (boosts) | Skills, ranks Untrained→Legendary | Feats (ancestry/class/skill/general) | (via feats) | HP, Focus, slots | d20 + level + prof vs DC, degrees (±10) | Ancestry/Heritage/Background/Class | XP (1000/level) |
| **Shadowrun 6** | 8 attributes + specials (Edge, Magic/Resonance) | Skills (consolidated) | Spells/complex forms, cyberware | Qualities (+/−) | Condition monitors, **Edge** | d6 pool, hits (5–6) vs threshold | Metatype | Karma (+ Nuyen) |
| **Star Wars FFG** (Macht & Schicksal) | 6 characteristics (Brawn…Presence) | Skills (career/non-career) | Talents (talent trees) | Morality/Obligation/Duty | Wound/Strain thresholds, **Destiny** | Narrative symbol dice (success/advantage/triumph…) | Species/Career/Specialization | XP purchases |
| **Vampire** (Storyteller) | 9 attributes (Phys/Soc/Ment ×3) | Talents/Skills/Knowledges | Disciplines | Merits/Flaws, Virtues | Health, Willpower, **Blood/Hunger**, Humanity | d10 pool vs difficulty (V5: Hunger dice) | Clan/Generation | XP |
| **HeXXen 1733** | 6 attributes (3 physical / 3 mental) | ~12 skills + combat skills | Jägerkräfte (role powers) | (via roles) | Coup/Idea points, wounds | d6 pool (attr+skill), Janus dice | Roles (hunter types) | XP-like |

## What is invariant (the shared meta-model)

Named entities (PC + NPC/creature) → a structured set of named, graded **traits** → assembled from
**templates** → changed by **progression** → tested by a **resolution mechanic** → played by a
**group under a GM** across **campaign sessions**.

Recurring **trait kinds** (same everywhere, different names/scales):

1. **Attributes** — few, broad, innate.
2. **Skills** — learned, rated.
3. **Abilities/features** — discrete capabilities granting exceptions (Sonderfertigkeiten / feats /
   Disciplines / Talents / Jägerkräfte).
4. **Advantages/disadvantages** — Vor-/Nachteile / Qualities / Merits & Flaws.
5. **Resources/pools** — current+max, spent/regained (LeP/HP/AsP/Edge/Strain/Blood/Focus/Destiny/Coup).
6. **Derived values** — computed by formulas (defense/AC/AW, initiative, thresholds, DCs).
7. **Items/equipment**.
8. **Templates** — species/race/metatype/clan · class/profession/career/role · culture/background/
   heritage/generation.

## What is NOT invariant

- The **specific** attributes (6 vs 8 vs 9) and their names.
- The **scale** (numeric vs symbol dice).
- The **dice/resolution mechanic** — maximally divergent → must be pluggable.
- Creation/advancement economies, combat rules, spell/power lists.

## Sources

- HeXXen 1733 2E Regel-Wiki: https://hexxen2e.ulisses-regelwiki.de/
- HeXXen 1733 system overview: https://wiki.nerdsgocasual.de/index.php?title=Guides-PnP-Systemvorstellung-HeXXen_1733
- Other systems: established system knowledge; verify exact terms from local `rulebooks/` PDFs.
