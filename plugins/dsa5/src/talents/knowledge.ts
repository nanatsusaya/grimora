/**
 * The **knowledge** DSA5 talent group (*Wissenstalente*) as mechanical roster entries — one `Talent` per
 * skill, carrying only the boundary-permitted data (name via i18n key + attribute triple + category +
 * improvement cost + encumbrance + application-name slugs; **no** descriptions/flavour/values). Sourced
 * from the official English *The Dark Eye* Regel-Wiki
 * (<https://tde.ulisses-regelwiki.de/knowledge-skills.html>).
 *
 * Kept as plain data (see `types.ts`): the SDK `TraitDefinition`/`CheckDefinition` are *derived* from
 * these entries (`skills.ts` / `checks.ts`), so the DSA5-specific fields live here in the plugin while
 * the core stays rule-agnostic (ADR 0020).
 */

import type { Talent } from './types';

/*
 * Shared application list for the four "regional" knowledge skills (Geography, History, Law, Myths &
 * Legends), whose application areas are the same roster of Aventurian regions on the Regel-Wiki. Kept as
 * one local constant (not exported) so the identical 21-entry list is transcribed once, not four times —
 * these are application *names* only (the boundary-permitted mechanical roster), never setting prose.
 * "Provinces of the Middenrealm" is a single application on the page (its nine provinces are shown only
 * as a parenthetical breakdown), so it stays one slug here rather than being expanded.
 */
const AVENTURIAN_REGIONS: readonly string[] = [
  'provinces-of-the-middenrealm',
  'alanfan-empire',
  'andergast',
  'arania',
  'bornland',
  'caliphate',
  'cyclops-islands',
  'deep-south',
  'gjalskerland',
  'high-north',
  'horasian-empire',
  'lands-of-the-tulamydes',
  'maraskan',
  'mountain-kingdoms-of-the-dwarves',
  'nostria',
  'orclands',
  'salamander-stones-and-elf-realms',
  'shadowlands',
  'south-sea-and-forest-islands',
  'svellt-valley',
  'thorwal',
];

/**
 * The 12 knowledge-group DSA5 talents. Exists so the DSA5 plugin can build its skill/check catalog from a
 * single mechanical source of truth without embedding any copyrighted rule text (content boundary:
 * `docs/legal/dsa5-content-boundary.md`). Order follows the Regel-Wiki's alphabetical listing.
 */
export const KNOWLEDGE_TALENTS: readonly Talent[] = [
  {
    id: 'ASTRONOMY',
    checkId: 'astronomy',
    labelKey: 'dsa5.skill.astronomy',
    attributeIds: ['SGC', 'SGC', 'INT'],
    category: 'knowledge',
    improvementCost: 'A',
    encumbrance: 'no',
    applications: ['astrology', 'calendars', 'stellar-cartography'],
  },
  {
    id: 'GAMBLING',
    checkId: 'gambling',
    labelKey: 'dsa5.skill.gambling',
    attributeIds: ['SGC', 'SGC', 'INT'],
    category: 'knowledge',
    improvementCost: 'A',
    encumbrance: 'no',
    applications: ['betting-games', 'board-games', 'card-games', 'dice-games'],
  },
  {
    id: 'GEOGRAPHY',
    checkId: 'geography',
    labelKey: 'dsa5.skill.geography',
    attributeIds: ['SGC', 'SGC', 'INT'],
    category: 'knowledge',
    improvementCost: 'B',
    encumbrance: 'no',
    applications: AVENTURIAN_REGIONS,
  },
  {
    id: 'HISTORY',
    checkId: 'history',
    labelKey: 'dsa5.skill.history',
    attributeIds: ['SGC', 'SGC', 'INT'],
    category: 'knowledge',
    improvementCost: 'B',
    encumbrance: 'no',
    applications: AVENTURIAN_REGIONS,
  },
  {
    id: 'LAW',
    checkId: 'law',
    labelKey: 'dsa5.skill.law',
    attributeIds: ['SGC', 'SGC', 'INT'],
    category: 'knowledge',
    improvementCost: 'A',
    encumbrance: 'no',
    // "Guild Law" is a distinct application beyond the regional legal systems (a "New Application" on the page).
    applications: ['guild-law', ...AVENTURIAN_REGIONS],
  },
  {
    id: 'MAGICAL_LORE',
    checkId: 'magical-lore',
    labelKey: 'dsa5.skill.magicalLore',
    attributeIds: ['SGC', 'SGC', 'INT'],
    category: 'knowledge',
    improvementCost: 'C',
    encumbrance: 'no',
    applications: ['artifacts', 'magical-beings', 'rituals', 'spells'],
  },
  {
    id: 'MATH',
    checkId: 'math',
    labelKey: 'dsa5.skill.math',
    attributeIds: ['SGC', 'SGC', 'INT'],
    category: 'knowledge',
    improvementCost: 'A',
    encumbrance: 'no',
    applications: [
      'addition-and-subtraction',
      'fractions',
      'multiplication-and-division',
      'geometry',
      'trigonometry',
    ],
  },
  {
    id: 'MECHANICS',
    checkId: 'mechanics',
    labelKey: 'dsa5.skill.mechanics',
    attributeIds: ['SGC', 'SGC', 'DEX'],
    category: 'knowledge',
    improvementCost: 'B',
    encumbrance: 'no',
    applications: ['complicated-systems', 'hydraulics', 'levers'],
  },
  {
    id: 'MYTHS_AND_LEGENDS',
    checkId: 'myths-and-legends',
    labelKey: 'dsa5.skill.mythsAndLegends',
    attributeIds: ['SGC', 'SGC', 'INT'],
    category: 'knowledge',
    improvementCost: 'B',
    encumbrance: 'no',
    applications: AVENTURIAN_REGIONS,
  },
  {
    id: 'RELIGIONS',
    checkId: 'religions',
    labelKey: 'dsa5.skill.religions',
    attributeIds: ['SGC', 'SGC', 'INT'],
    category: 'knowledge',
    improvementCost: 'B',
    encumbrance: 'no',
    // The page gives no closed list — applications depend on the god/philosophy; these are the named examples it prints.
    applications: ['praios', 'rondra', 'swafnir', 'nameless-one', 'rastullah'],
  },
  {
    id: 'SPHERE_LORE',
    checkId: 'sphere-lore',
    labelKey: 'dsa5.skill.sphereLore',
    attributeIds: ['SGC', 'SGC', 'INT'],
    category: 'knowledge',
    improvementCost: 'B',
    encumbrance: 'no',
    applications: ['beings-from-the-spheres', 'limbo', 'specific-sphere'],
  },
  {
    id: 'WARFARE',
    checkId: 'warfare',
    labelKey: 'dsa5.skill.warfare',
    attributeIds: ['COU', 'SGC', 'INT'],
    category: 'knowledge',
    improvementCost: 'B',
    encumbrance: 'no',
    applications: [
      'open-battle',
      'partisan-tactics',
      'sea-battle',
      'siege-tactics',
      'tunnel-fighting',
    ],
  },
];
