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
 *
 * **Fidelity SSOT (ADR 0029):** verified against the owner's DSA5 vault — each entry carries its own
 * `regelwiki` id (public, normative) + `vaultNote` path (private anchor), so its mechanics can be
 * re-checked against the authority instead of trusted. Pointers only; no rule text is copied here.
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
    regelwiki: 'https://dsa.ulisses-regelwiki.de/talent.html?talent=Verkleiden',
    vaultNote: '01 Regeln/Talente/Gesellschaftstalente/Verkleiden.md',
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
    regelwiki: 'https://dsa.ulisses-regelwiki.de/talent.html?talent=Menschenkenntnis',
    vaultNote: '01 Regeln/Talente/Gesellschaftstalente/Menschenkenntnis.md',
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
    regelwiki: 'https://dsa.ulisses-regelwiki.de/talent.html?talent=Etikette',
    vaultNote: '01 Regeln/Talente/Gesellschaftstalente/Etikette.md',
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
    regelwiki: 'https://dsa.ulisses-regelwiki.de/talent.html?talent=%C3%9Cberreden',
    vaultNote: '01 Regeln/Talente/Gesellschaftstalente/Überreden.md',
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
    regelwiki: 'https://dsa.ulisses-regelwiki.de/talent.html?talent=Einsch%C3%BCchtern',
    vaultNote: '01 Regeln/Talente/Gesellschaftstalente/Einschüchtern.md',
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
    regelwiki: 'https://dsa.ulisses-regelwiki.de/talent.html?talent=Bekehren+%26+%C3%9Cberzeugen',
    vaultNote: '01 Regeln/Talente/Gesellschaftstalente/Bekehren & Überzeugen.md',
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
    regelwiki: 'https://dsa.ulisses-regelwiki.de/talent.html?talent=Bet%C3%B6ren',
    vaultNote: '01 Regeln/Talente/Gesellschaftstalente/Betören.md',
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
    regelwiki: 'https://dsa.ulisses-regelwiki.de/talent.html?talent=Gassenwissen',
    vaultNote: '01 Regeln/Talente/Gesellschaftstalente/Gassenwissen.md',
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
    regelwiki: 'https://dsa.ulisses-regelwiki.de/talent.html?talent=Willenskraft',
    vaultNote: '01 Regeln/Talente/Gesellschaftstalente/Willenskraft.md',
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
