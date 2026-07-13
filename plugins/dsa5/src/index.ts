/**
 * @grimora/plugin-dsa5 — the DSA5 rule-system plugin (in-process, first-party — ADR 0006 §5).
 *
 * Composition module: assembles the rule system from the per-concern modules (attributes, derived
 * values, skills, checks) and registers it with the host. Splitting by concern (issue #210) lets the
 * Tier-1 buildout (#211) grow each area independently. Currently spans three trait **kinds**
 * (ADR 0022 R2): rated attributes, a formula-derived value and a skill, plus one 3d20 check.
 *
 * Mechanics/structure only; self-implemented, abstract ids, i18n-key labels (see README + the legal
 * boundary).
 */
import { definePlugin, type GrimoraPlugin, type RuleSystemDefinition } from '@grimora/plugin-sdk';
import { ATTRIBUTES } from './attributes';
import { CHECKS } from './checks';
import { DERIVED_VALUES } from './derived';
import { SKILLS } from './skills';

/** The DSA5 rule-system definition contributed to the host registry. */
const RULE_SYSTEM: RuleSystemDefinition = {
  id: 'dsa5',
  labelKey: 'dsa5.name',
  traits: [...ATTRIBUTES, ...SKILLS, ...DERIVED_VALUES],
  checks: [...CHECKS],
};

/** The DSA5 plugin (in-process, first-party — ADR 0006 §5). */
const plugin: GrimoraPlugin = definePlugin(
  {
    id: 'org.grimora.dsa5',
    name: 'Das Schwarze Auge 5 (skeleton slice)',
    version: '0.0.0',
    sdkVersion: 0,
  },
  (registry) => {
    registry.registerRuleSystem(RULE_SYSTEM);
  },
);

export default plugin;
