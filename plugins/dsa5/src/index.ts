/**
 * @grimora/plugin-dsa5 — the minimal DSA5 rule-system slice for the walking skeleton (issue #61).
 *
 * Spans three trait **kinds** (ADR 0022 R2): rated **attributes** (COU/AGI/INT), a **derivedValue**
 * (life points, computed by a formula AST) and a **skill** (PER), plus one **check** implementing the
 * DSA5 mechanic — three d20 rolled under three attributes, with skill points offsetting shortfalls.
 *
 * Mechanics/structure only; ids are abstract and labels are i18n keys (see README + the legal boundary).
 */

import {
  type CheckDefinition,
  definePlugin,
  f,
  type GrimoraPlugin,
  type PluginError,
  type ResolveCheckInput,
  type RollOutcome,
  type RuleSystemDefinition,
  type TraitDefinition,
} from "@grimora/plugin-sdk";
import { err, ok, type Result } from "@grimora/shared-types";

/** Rated attributes (kind: attribute) — abstract ids, i18n-key labels, generic DSA5 bounds. */
const ATTRIBUTES: readonly TraitDefinition[] = [
  { kind: "attribute", id: "COU", labelKey: "dsa5.attr.courage", min: 8, max: 20, defaultValue: 8 },
  { kind: "attribute", id: "AGI", labelKey: "dsa5.attr.agility", min: 8, max: 20, defaultValue: 8 },
  {
    kind: "attribute",
    id: "INT",
    labelKey: "dsa5.attr.intuition",
    min: 8,
    max: 20,
    defaultValue: 8,
  },
];

/** A skill (kind: skill) — a rated talent tested via the check below. */
const SKILL: TraitDefinition = {
  kind: "skill",
  id: "PER",
  labelKey: "dsa5.skill.perception",
  min: 0,
  max: 25,
  defaultValue: 0,
};

/**
 * A derived value (kind: derivedValue): life points, computed by a formula AST over attributes
 * (5 + COU + AGI). Deterministic; re-evaluated by the core interpreter (ADR 0020/0021).
 */
const LIFE_POINTS: TraitDefinition = {
  kind: "derivedValue",
  id: "LP",
  labelKey: "dsa5.derived.lifePoints",
  formula: f.add(f.add(f.const(5), f.trait("COU")), f.trait("AGI")),
};

/** The DSA5 quality-level / success outcome (the opaque plugin `value`, ADR 0020 / 0021 R3). */
interface Dsa5CheckOutcome {
  readonly success: boolean;
  readonly quality: number;
  readonly critical: boolean;
  readonly botch: boolean;
}

/** Read a die value defensively from the rolled pips. */
function die(pips: readonly number[], index: number): number {
  return pips[index] ?? 0;
}

/**
 * The DSA5 skill-check mechanic (this is the *plugin's* mechanic, ADR 0020): roll three d20 under
 * COU/AGI/INT; each die exceeding its attribute is a shortfall; skill points (PER) offset the total.
 * Success iff points cover the shortfalls; quality level scales with the remainder. Two 1s = critical,
 * two 20s = botch. Pure and deterministic given the rolled pips.
 */
function resolvePerceptionCheck(input: ResolveCheckInput): Result<RollOutcome, PluginError> {
  const pips = input.rolls[0];
  if (pips?.length !== 3) {
    return err({
      code: "dsa5.invalid_check_dice",
      messageKey: "dsa5.invalid_check_dice",
      category: "Validation",
    });
  }
  const attributes = [input.targets.COU ?? 0, input.targets.AGI ?? 0, input.targets.INT ?? 0];
  const skill = input.targets.PER ?? 0;

  let shortfall = 0;
  let ones = 0;
  let twenties = 0;
  for (let i = 0; i < 3; i++) {
    const value = die(pips, i);
    if (value === 1) ones++;
    if (value === 20) twenties++;
    const attribute = attributes[i] ?? 0;
    if (value > attribute) shortfall += value - attribute;
  }
  const remaining = skill - shortfall;

  let outcome: Dsa5CheckOutcome;
  if (twenties >= 2) {
    outcome = { success: false, quality: 0, critical: false, botch: true };
  } else if (ones >= 2) {
    outcome = {
      success: true,
      quality: Math.max(1, Math.ceil(remaining / 3)),
      critical: true,
      botch: false,
    };
  } else {
    const success = remaining >= 0;
    outcome = {
      success,
      quality: success ? Math.max(1, Math.ceil(remaining / 3)) : 0,
      critical: false,
      botch: false,
    };
  }

  return ok({
    value: outcome,
    labelKey: outcome.success ? "dsa5.check.success" : "dsa5.check.failure",
    labelParams: { quality: outcome.quality },
  });
}

/** The one check: a Perception skill check (3d20 under COU/AGI/INT, PER as skill points). */
const PERCEPTION_CHECK: CheckDefinition = {
  id: "perception",
  labelKey: "dsa5.check.perception",
  attributeIds: ["COU", "AGI", "INT"],
  skillId: "PER",
  terms: [{ sides: 20, count: 3 }],
  resolve: (input) => resolvePerceptionCheck(input),
};

/** The DSA5 rule-system definition contributed to the host registry. */
const RULE_SYSTEM: RuleSystemDefinition = {
  id: "dsa5",
  labelKey: "dsa5.name",
  traits: [...ATTRIBUTES, SKILL, LIFE_POINTS],
  checks: [PERCEPTION_CHECK],
};

/** The DSA5 plugin (in-process, first-party — ADR 0006 §5). */
const plugin: GrimoraPlugin = definePlugin(
  {
    id: "org.grimora.dsa5",
    name: "Das Schwarze Auge 5 (skeleton slice)",
    version: "0.0.0",
    sdkVersion: 0,
  },
  (registry) => {
    registry.registerRuleSystem(RULE_SYSTEM);
  },
);

export default plugin;
