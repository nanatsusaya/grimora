/**
 * The **physical** DSA5 talent group (*Körpertalente*) as mechanical roster entries — one `Talent` per
 * skill, carrying only the boundary-permitted data (name via i18n key + attribute triple + category +
 * improvement cost + encumbrance + application-name slugs; **no** descriptions/flavour/values). Sourced
 * from the official English *The Dark Eye* Regel-Wiki
 * (<https://tde.ulisses-regelwiki.de/physical-skills.html>).
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
