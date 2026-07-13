/**
 * The **nature** DSA5 talent group (*Naturtalente*) as mechanical roster entries — one `Talent` per
 * skill, carrying only the boundary-permitted data (name via i18n key + attribute triple + category +
 * improvement cost + encumbrance + application-name slugs; **no** descriptions/flavour/values). Sourced
 * from the official English *The Dark Eye* Regel-Wiki
 * (<https://tde.ulisses-regelwiki.de/nature-skills.html>).
 *
 * Kept as plain data (see `types.ts`): the SDK `TraitDefinition`/`CheckDefinition` are *derived* from
 * these entries (`skills.ts` / `checks.ts`), so the DSA5-specific fields live here in the plugin while
 * the core stays rule-agnostic (ADR 0020).
 */

import type { Talent } from './types';

/**
 * The 7 nature-group DSA5 talents. Exists so the DSA5 plugin can build its skill/check catalog from a
 * single mechanical source of truth without embedding any copyrighted rule text (content boundary:
 * `docs/legal/dsa5-content-boundary.md`). Order follows the Regel-Wiki's alphabetical listing.
 */
export const NATURE_TALENTS: readonly Talent[] = [
  {
    id: 'ANIMAL_LORE',
    checkId: 'animal-lore',
    labelKey: 'dsa5.skill.animalLore',
    attributeIds: ['COU', 'COU', 'CHA'],
    category: 'nature',
    improvementCost: 'C',
    encumbrance: 'yes',
    applications: ['domesticated-animals', 'monsters', 'wild-animals'],
  },
  {
    id: 'FISHING',
    checkId: 'fishing',
    labelKey: 'dsa5.skill.fishing',
    attributeIds: ['DEX', 'AGI', 'CON'],
    category: 'nature',
    improvementCost: 'A',
    encumbrance: 'maybe',
    applications: ['saltwater-animals', 'freshwater-animals', 'water-monsters'],
  },
  {
    id: 'ORIENTING',
    checkId: 'orienting',
    labelKey: 'dsa5.skill.orienting',
    attributeIds: ['SGC', 'INT', 'INT'],
    category: 'nature',
    improvementCost: 'B',
    encumbrance: 'no',
    applications: ['below-ground', 'position-of-the-sun', 'night-sky'],
  },
  {
    id: 'PLANT_LORE',
    checkId: 'plant-lore',
    labelKey: 'dsa5.skill.plantLore',
    attributeIds: ['SGC', 'DEX', 'CON'],
    category: 'nature',
    improvementCost: 'C',
    encumbrance: 'maybe',
    applications: ['crops', 'healing-plants', 'poisonous-plants', 'plant-based-dyes'],
  },
  {
    id: 'ROPES',
    checkId: 'ropes',
    labelKey: 'dsa5.skill.ropes',
    attributeIds: ['SGC', 'DEX', 'STR'],
    category: 'nature',
    improvementCost: 'A',
    encumbrance: 'no',
    applications: ['bindings', 'knots', 'tie-nets', 'splice-ropes'],
  },
  {
    id: 'SURVIVAL',
    checkId: 'survival',
    labelKey: 'dsa5.skill.survival',
    attributeIds: ['COU', 'AGI', 'CON'],
    category: 'nature',
    improvementCost: 'C',
    encumbrance: 'yes',
    applications: ['build-campsite', 'find-campsite', 'make-fire', 'predict-weather'],
  },
  {
    id: 'TRACKING',
    checkId: 'tracking',
    labelKey: 'dsa5.skill.tracking',
    attributeIds: ['COU', 'INT', 'AGI'],
    category: 'nature',
    improvementCost: 'C',
    encumbrance: 'yes',
    applications: ['animal-tracks', 'conceal-tracks', 'humanoid-tracks'],
  },
];
