/**
 * The DSA5 **social** talent group (Regel-Wiki category *Social Skills*) as mechanical roster entries.
 * Each entry is a {@link Talent}: the i18n name key + governing attribute triple + category + improvement
 * cost + encumbrance + application-name slugs — **no** descriptions/flavour/values (content boundary,
 * `docs/legal/dsa5-content-boundary.md`).
 *
 * Sourced from the official English *The Dark Eye* Regel-Wiki
 * (<https://tde.ulisses-regelwiki.de/social-skills.html>); attribute order matches the wiki's printed
 * triple. Kept as plain data so the SDK trait/check definitions can be *derived* from it (see `types.ts`),
 * keeping the core rule-agnostic (ADR 0020).
 */

import type { Talent } from './types';

/**
 * The nine DSA5 social talents, one {@link Talent} entry per skill. Serves as the SSOT for this talent
 * group's mechanical roster; ids/checkIds/application slugs are machine-stable and must not change once
 * shipped (they surface in event-sourced data). Source: the English Regel-Wiki *Social Skills* page
 * (<https://tde.ulisses-regelwiki.de/social-skills.html>).
 */
export const SOCIAL_TALENTS: readonly Talent[] = [
  {
    id: 'DISGUISE',
    checkId: 'disguise',
    labelKey: 'dsa5.skill.disguise',
    attributeIds: ['INT', 'CHA', 'AGI'],
    category: 'social',
    improvementCost: 'B',
    encumbrance: 'yes',
    applications: ['costuming', 'imitate-person', 'stage-acting'],
  },
  {
    id: 'EMPATHY',
    checkId: 'empathy',
    labelKey: 'dsa5.skill.empathy',
    attributeIds: ['SGC', 'INT', 'CHA'],
    category: 'social',
    improvementCost: 'C',
    encumbrance: 'no',
    applications: ['discern-motivation', 'sense-deception'],
  },
  {
    id: 'ETIQUETTE',
    checkId: 'etiquette',
    labelKey: 'dsa5.skill.etiquette',
    attributeIds: ['SGC', 'INT', 'CHA'],
    category: 'social',
    improvementCost: 'B',
    encumbrance: 'no',
    applications: ['fashion', 'manners', 'rumors', 'small-talk'],
  },
  {
    id: 'FAST_TALK',
    checkId: 'fast-talk',
    labelKey: 'dsa5.skill.fastTalk',
    attributeIds: ['COU', 'INT', 'CHA'],
    category: 'social',
    improvementCost: 'C',
    encumbrance: 'no',
    applications: [
      'hard-sell',
      'begging',
      'manipulation',
      'provocation',
      'subterfuge',
      'sweet-talk',
    ],
  },
  {
    id: 'INTIMIDATION',
    checkId: 'intimidation',
    labelKey: 'dsa5.skill.intimidation',
    attributeIds: ['COU', 'INT', 'CHA'],
    category: 'social',
    improvementCost: 'B',
    encumbrance: 'no',
    applications: ['interrogation', 'threats', 'torture'],
  },
  {
    id: 'PERSUASION',
    checkId: 'persuasion',
    labelKey: 'dsa5.skill.persuasion',
    attributeIds: ['COU', 'SGC', 'CHA'],
    category: 'social',
    improvementCost: 'B',
    encumbrance: 'no',
    applications: ['conversation', 'debate', 'oration', 'provocation'],
  },
  {
    id: 'SEDUCTION',
    checkId: 'seduction',
    labelKey: 'dsa5.skill.seduction',
    attributeIds: ['COU', 'CHA', 'CHA'],
    category: 'social',
    improvementCost: 'B',
    encumbrance: 'maybe',
    applications: ['flirting', 'romantic-arts', 'beautify'],
  },
  {
    id: 'STREETWISE',
    checkId: 'streetwise',
    labelKey: 'dsa5.skill.streetwise',
    attributeIds: ['SGC', 'INT', 'CHA'],
    category: 'social',
    improvementCost: 'C',
    encumbrance: 'maybe',
    applications: ['asking-around', 'judging-locations', 'shadowing'],
  },
  {
    id: 'WILLPOWER',
    checkId: 'willpower',
    labelKey: 'dsa5.skill.willpower',
    attributeIds: ['COU', 'INT', 'CHA'],
    category: 'social',
    improvementCost: 'D',
    encumbrance: 'no',
    applications: [
      'face-threats',
      'resist-fast-talk',
      'resist-intimidation',
      'resist-persuasion',
      'resist-seduction',
    ],
  },
];
