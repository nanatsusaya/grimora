/**
 * The **physical** DSA5 talent group (*Körpertalente*) as mechanical roster entries — one `Talent` per
 * skill, carrying only the boundary-permitted data (name via i18n key + attribute triple + category +
 * improvement cost + encumbrance + application-name slugs; **no** descriptions/flavour/values). Sourced
 * from the official English *The Dark Eye* Regel-Wiki (<https://tde.ulisses-regelwiki.de/physical-skills.html>).
 *
 * **Fidelity SSOT (ADR 0029):** verified against the owner's DSA5 vault — each entry carries its own
 * `regelwiki` id (public, normative) + `vaultNote` path (private anchor), so its mechanics can be
 * re-checked against the authority instead of trusted. Pointers only; no rule text is copied here.
 *
 * Kept as plain data (see `types.ts`): the SDK `TraitDefinition`/`CheckDefinition` are *derived* from
 * these entries (`skills.ts` / `checks.ts`), so the DSA5-specific fields live here in the plugin while
 * the core stays rule-agnostic (ADR 0020).
 */

import type { Talent } from './types';

/**
 * The 14 physical-group DSA5 talents. Exists so the DSA5 plugin can build its skill/check catalog from a
 * single mechanical source of truth without embedding any copyrighted rule text (content boundary:
 * `docs/legal/dsa5-content-boundary.md`). Order follows the Regel-Wiki's alphabetical listing.
 */
export const PHYSICAL_TALENTS: readonly Talent[] = [
  {
    id: 'BODY_CONTROL',
    checkId: 'body-control',
    labelKey: 'dsa5.skill.bodyControl',
    regelwiki: 'https://dsa.ulisses-regelwiki.de/talent.html?talent=K%C3%B6rperbeherrschung',
    vaultNote: '01 Regeln/Talente/Körpertalente/Körperbeherrschung.md',
    attributeIds: ['AGI', 'AGI', 'CON'],
    category: 'physical',
    improvementCost: 'D',
    encumbrance: 'yes',
    applications: ['acrobatics', 'balance', 'combat-maneuver', 'jumping', 'running', 'squirm'],
  },
  {
    id: 'CAROUSING',
    checkId: 'carousing',
    labelKey: 'dsa5.skill.carousing',
    regelwiki: 'https://dsa.ulisses-regelwiki.de/talent.html?talent=Zechen',
    vaultNote: '01 Regeln/Talente/Körpertalente/Zechen.md',
    attributeIds: ['SGC', 'CON', 'STR'],
    category: 'physical',
    improvementCost: 'A',
    encumbrance: 'no',
    applications: ['resist-drug-confusion', 'resist-drug-intoxication', 'resist-drug-pain'],
  },
  {
    id: 'CLIMBING',
    checkId: 'climbing',
    labelKey: 'dsa5.skill.climbing',
    regelwiki: 'https://dsa.ulisses-regelwiki.de/talent.html?talent=Klettern',
    vaultNote: '01 Regeln/Talente/Körpertalente/Klettern.md',
    attributeIds: ['COU', 'AGI', 'STR'],
    category: 'physical',
    improvementCost: 'B',
    encumbrance: 'yes',
    applications: ['ice', 'mountains', 'trees', 'walls'],
  },
  {
    id: 'DANCING',
    checkId: 'dancing',
    labelKey: 'dsa5.skill.dancing',
    regelwiki: 'https://dsa.ulisses-regelwiki.de/talent.html?talent=Tanzen',
    vaultNote: '01 Regeln/Talente/Körpertalente/Tanzen.md',
    attributeIds: ['SGC', 'CHA', 'AGI'],
    category: 'physical',
    improvementCost: 'A',
    encumbrance: 'yes',
    applications: ['court', 'religious', 'exotic', 'folk'],
  },
  {
    id: 'FEAT_OF_STRENGTH',
    checkId: 'feat-of-strength',
    labelKey: 'dsa5.skill.featOfStrength',
    regelwiki: 'https://dsa.ulisses-regelwiki.de/talent.html?talent=Kraftakt',
    vaultNote: '01 Regeln/Talente/Körpertalente/Kraftakt.md',
    attributeIds: ['CON', 'STR', 'STR'],
    category: 'physical',
    improvementCost: 'B',
    encumbrance: 'yes',
    applications: [
      'breaking-and-smashing',
      'dragging-and-pulling',
      'lifting',
      'pushing-and-bending',
    ],
  },
  {
    id: 'FLYING',
    checkId: 'flying',
    labelKey: 'dsa5.skill.flying',
    regelwiki: 'https://dsa.ulisses-regelwiki.de/talent.html?talent=Fliegen',
    vaultNote: '01 Regeln/Talente/Körpertalente/Fliegen.md',
    attributeIds: ['COU', 'INT', 'AGI'],
    category: 'physical',
    improvementCost: 'B',
    encumbrance: 'yes',
    applications: ['chases', 'combat-maneuvers', 'long-distance-flight'],
  },
  {
    id: 'GAUKELEI',
    checkId: 'gaukelei',
    labelKey: 'dsa5.skill.gaukelei',
    regelwiki: 'https://dsa.ulisses-regelwiki.de/talent.html?talent=Gaukeleien',
    vaultNote: '01 Regeln/Talente/Körpertalente/Gaukeleien.md',
    attributeIds: ['COU', 'CHA', 'DEX'],
    category: 'physical',
    improvementCost: 'A',
    encumbrance: 'yes',
    applications: ['clowning', 'hiding-tricks', 'juggling'],
  },
  {
    id: 'PERCEPTION',
    checkId: 'perception',
    labelKey: 'dsa5.skill.perception',
    regelwiki: 'https://dsa.ulisses-regelwiki.de/talent.html?talent=Sinnessch%C3%A4rfe',
    vaultNote: '01 Regeln/Talente/Körpertalente/Sinnesschärfe.md',
    attributeIds: ['SGC', 'INT', 'INT'],
    category: 'physical',
    improvementCost: 'D',
    encumbrance: 'no',
    applications: ['detect-ambush', 'search', 'spot', 'fox-sense', 'lip-reading'],
  },
  {
    id: 'PICKPOCKET',
    checkId: 'pickpocket',
    labelKey: 'dsa5.skill.pickpocket',
    regelwiki: 'https://dsa.ulisses-regelwiki.de/talent.html?talent=Taschendiebstahl',
    vaultNote: '01 Regeln/Talente/Körpertalente/Taschendiebstahl.md',
    attributeIds: ['COU', 'DEX', 'AGI'],
    category: 'physical',
    improvementCost: 'B',
    encumbrance: 'yes',
    applications: ['create-distractions', 'steal-from-person', 'steal-item', 'slip-item'],
  },
  {
    id: 'RIDING',
    checkId: 'riding',
    labelKey: 'dsa5.skill.riding',
    regelwiki: 'https://dsa.ulisses-regelwiki.de/talent.html?talent=Reiten',
    vaultNote: '01 Regeln/Talente/Körpertalente/Reiten.md',
    attributeIds: ['CHA', 'AGI', 'STR'],
    category: 'physical',
    improvementCost: 'B',
    encumbrance: 'yes',
    applications: ['chases', 'combat-maneuvers', 'long-distance-ride', 'show-jumping'],
  },
  {
    id: 'SELF_CONTROL',
    checkId: 'self-control',
    labelKey: 'dsa5.skill.selfControl',
    regelwiki: 'https://dsa.ulisses-regelwiki.de/talent.html?talent=Selbstbeherrschung',
    vaultNote: '01 Regeln/Talente/Körpertalente/Selbstbeherrschung.md',
    attributeIds: ['COU', 'COU', 'CON'],
    category: 'physical',
    improvementCost: 'D',
    encumbrance: 'no',
    applications: ['ignore-distractions', 'resist-torture', 'stay-conscious'],
  },
  {
    id: 'SINGING',
    checkId: 'singing',
    labelKey: 'dsa5.skill.singing',
    regelwiki: 'https://dsa.ulisses-regelwiki.de/talent.html?talent=Singen',
    vaultNote: '01 Regeln/Talente/Körpertalente/Singen.md',
    attributeIds: ['SGC', 'CHA', 'CON'],
    category: 'physical',
    improvementCost: 'A',
    encumbrance: 'no',
    applications: ['bards-ballad', 'chorale', 'choral-singing', 'recital', 'two-voiced-singing'],
  },
  {
    id: 'STEALTH',
    checkId: 'stealth',
    labelKey: 'dsa5.skill.stealth',
    regelwiki: 'https://dsa.ulisses-regelwiki.de/talent.html?talent=Verbergen',
    vaultNote: '01 Regeln/Talente/Körpertalente/Verbergen.md',
    attributeIds: ['COU', 'INT', 'AGI'],
    category: 'physical',
    improvementCost: 'C',
    encumbrance: 'yes',
    applications: ['hide', 'sneak'],
  },
  {
    id: 'SWIMMING',
    checkId: 'swimming',
    labelKey: 'dsa5.skill.swimming',
    regelwiki: 'https://dsa.ulisses-regelwiki.de/talent.html?talent=Schwimmen',
    vaultNote: '01 Regeln/Talente/Körpertalente/Schwimmen.md',
    attributeIds: ['AGI', 'CON', 'STR'],
    category: 'physical',
    improvementCost: 'B',
    encumbrance: 'yes',
    applications: [
      'chases',
      'diving',
      'combat-maneuver',
      'long-distance-swimming',
      'treading-water',
    ],
  },
];
