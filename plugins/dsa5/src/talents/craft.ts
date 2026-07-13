/**
 * The **craft** DSA5 talent group (*Handwerkstalente*) as mechanical roster entries — one `Talent` per
 * skill, carrying only the boundary-permitted data (name via i18n key + attribute triple + category +
 * improvement cost + encumbrance + application-name slugs; **no** descriptions/flavour/values). Sourced
 * from the official English *The Dark Eye* Regel-Wiki
 * (<https://tde.ulisses-regelwiki.de/craft-skills.html>).
 *
 * Kept as plain data (see `types.ts`): the SDK `TraitDefinition`/`CheckDefinition` are *derived* from
 * these entries (`skills.ts` / `checks.ts`), so the DSA5-specific fields live here in the plugin while
 * the core stays rule-agnostic (ADR 0020).
 */

import type { Talent } from './types';

/**
 * The 17 craft-group DSA5 talents. Exists so the DSA5 plugin can build its skill/check catalog from a
 * single mechanical source of truth without embedding any copyrighted rule text (content boundary:
 * `docs/legal/dsa5-content-boundary.md`). Order follows the Regel-Wiki's alphabetical listing.
 */
export const CRAFT_TALENTS: readonly Talent[] = [
  {
    id: 'ALCHEMY',
    checkId: 'alchemy',
    labelKey: 'dsa5.skill.alchemy',
    attributeIds: ['COU', 'SGC', 'DEX'],
    category: 'craft',
    improvementCost: 'C',
    encumbrance: 'yes',
    applications: ['alchemical-poisons', 'elixirs', 'mundane-alchemy'],
  },
  {
    id: 'ARTISTIC_ABILITY',
    checkId: 'artistic-ability',
    labelKey: 'dsa5.skill.artisticAbility',
    attributeIds: ['INT', 'DEX', 'DEX'],
    category: 'craft',
    improvementCost: 'A',
    encumbrance: 'yes',
    applications: ['carving', 'drawing', 'painting'],
  },
  {
    id: 'CLOTHWORKING',
    checkId: 'clothworking',
    labelKey: 'dsa5.skill.clothworking',
    attributeIds: ['SGC', 'DEX', 'DEX'],
    category: 'craft',
    improvementCost: 'A',
    encumbrance: 'yes',
    applications: ['dyeing', 'felting', 'sewing', 'weaving', 'spinning'],
  },
  {
    id: 'COMMERCE',
    checkId: 'commerce',
    labelKey: 'dsa5.skill.commerce',
    attributeIds: ['SGC', 'INT', 'CHA'],
    category: 'craft',
    improvementCost: 'B',
    encumbrance: 'no',
    applications: ['accounting', 'haggling', 'money-exchange'],
  },
  {
    id: 'DRIVING',
    checkId: 'driving',
    labelKey: 'dsa5.skill.driving',
    attributeIds: ['CHA', 'DEX', 'CON'],
    category: 'craft',
    improvementCost: 'A',
    encumbrance: 'yes',
    applications: ['chases', 'combat-maneuvers', 'long-distances', 'races'],
  },
  {
    id: 'EARTHENCRAFT',
    checkId: 'earthencraft',
    labelKey: 'dsa5.skill.earthencraft',
    attributeIds: ['DEX', 'DEX', 'STR'],
    category: 'craft',
    improvementCost: 'A',
    encumbrance: 'yes',
    applications: ['stonecutting', 'masonry', 'stone-carving'],
  },
  {
    id: 'LEATHERWORKING',
    checkId: 'leatherworking',
    labelKey: 'dsa5.skill.leatherworking',
    attributeIds: ['DEX', 'AGI', 'CON'],
    category: 'craft',
    improvementCost: 'B',
    encumbrance: 'yes',
    applications: ['furrier', 'produce-leather-goods', 'tanning'],
  },
  {
    id: 'METALWORKING',
    checkId: 'metalworking',
    labelKey: 'dsa5.skill.metalworking',
    attributeIds: ['DEX', 'CON', 'STR'],
    category: 'craft',
    improvementCost: 'C',
    encumbrance: 'yes',
    applications: ['blacksmith', 'casting', 'goldsmith', 'smelting'],
  },
  {
    id: 'MUSIC',
    checkId: 'music',
    labelKey: 'dsa5.skill.music',
    attributeIds: ['CHA', 'DEX', 'CON'],
    category: 'craft',
    improvementCost: 'A',
    encumbrance: 'yes',
    applications: ['drums', 'string-instruments', 'wind-instruments'],
  },
  {
    id: 'PICK_LOCKS',
    checkId: 'pick-locks',
    labelKey: 'dsa5.skill.pickLocks',
    attributeIds: ['INT', 'DEX', 'DEX'],
    category: 'craft',
    improvementCost: 'C',
    encumbrance: 'yes',
    applications: ['bit-locks', 'combination-locks'],
  },
  {
    id: 'PREPARE_FOOD',
    checkId: 'prepare-food',
    labelKey: 'dsa5.skill.prepareFood',
    attributeIds: ['INT', 'DEX', 'DEX'],
    category: 'craft',
    improvementCost: 'A',
    encumbrance: 'yes',
    applications: ['baking', 'brewing', 'frying-and-boiling', 'gutting', 'preserving'],
  },
  {
    id: 'SAILING',
    checkId: 'sailing',
    labelKey: 'dsa5.skill.sailing',
    attributeIds: ['DEX', 'AGI', 'STR'],
    category: 'craft',
    improvementCost: 'B',
    encumbrance: 'yes',
    applications: ['chases', 'combat-maneuvers', 'long-distances', 'races'],
  },
  {
    id: 'TREAT_DISEASE',
    checkId: 'treat-disease',
    labelKey: 'dsa5.skill.treatDisease',
    attributeIds: ['COU', 'INT', 'CON'],
    category: 'craft',
    improvementCost: 'B',
    encumbrance: 'yes',
    applications: ['individual-diseases'],
  },
  {
    id: 'TREAT_POISON',
    checkId: 'treat-poison',
    labelKey: 'dsa5.skill.treatPoison',
    attributeIds: ['COU', 'SGC', 'INT'],
    category: 'craft',
    improvementCost: 'B',
    encumbrance: 'yes',
    applications: ['alchemical-poisons', 'mineral-based-poisons', 'plant-based-toxins', 'venoms'],
  },
  {
    id: 'TREAT_SOUL',
    checkId: 'treat-soul',
    labelKey: 'dsa5.skill.treatSoul',
    attributeIds: ['INT', 'CHA', 'CON'],
    category: 'craft',
    improvementCost: 'B',
    encumbrance: 'no',
    applications: ['suppress-negative-trait', 'suppress-fear', 'suppress-personality-flaw'],
  },
  {
    id: 'TREAT_WOUNDS',
    checkId: 'treat-wounds',
    labelKey: 'dsa5.skill.treatWounds',
    attributeIds: ['SGC', 'DEX', 'DEX'],
    category: 'craft',
    improvementCost: 'D',
    encumbrance: 'yes',
    applications: ['enhance-healing', 'relieve-pain', 'stabilize'],
  },
  {
    id: 'WOODWORKING',
    checkId: 'woodworking',
    labelKey: 'dsa5.skill.woodworking',
    attributeIds: ['DEX', 'AGI', 'STR'],
    category: 'craft',
    improvementCost: 'B',
    encumbrance: 'yes',
    applications: ['carpenter', 'felling-and-cutting', 'joiner'],
  },
];
