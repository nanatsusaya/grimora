/**
 * DSA5 checks (`CheckDefinition`s) + the skill-check *mechanic* itself — the plugin's own dice rule
 * (ADR 0020): three d20 rolled under three attributes, skill points offsetting shortfalls, success
 * scaling to a quality level; two 1s = critical, two 20s = botch. Pure and deterministic given the
 * rolled pips.
 *
 * Own module so the resolver can be generalised (skeleton: a hardcoded perception check → a
 * parameterised check reused across talents, issue #211) without touching the trait modules.
 */
import type {
  CheckDefinition,
  PluginError,
  ResolveCheckInput,
  RollOutcome,
} from '@grimora/plugin-sdk';
import { err, ok, type Result } from '@grimora/shared-types';

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
 * @param input  the rolled pips (`rolls[0]` = three d20) and the target attribute/skill ratings
 * @returns      a `RollOutcome` carrying the opaque DSA5 outcome, or a `Validation` `PluginError`
 */
function resolvePerceptionCheck(input: ResolveCheckInput): Result<RollOutcome, PluginError> {
  const pips = input.rolls[0];
  if (pips?.length !== 3) {
    return err({
      code: 'dsa5.invalid_check_dice',
      messageKey: 'dsa5.invalid_check_dice',
      category: 'Validation',
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
    labelKey: outcome.success ? 'dsa5.check.success' : 'dsa5.check.failure',
    labelParams: { quality: outcome.quality },
  });
}

/**
 * The checks contributed by the plugin. One check today: a Perception skill check (3d20 under
 * COU/AGI/INT, PER as skill points).
 */
export const CHECKS: readonly CheckDefinition[] = [
  {
    id: 'perception',
    labelKey: 'dsa5.check.perception',
    attributeIds: ['COU', 'AGI', 'INT'],
    skillId: 'PER',
    terms: [{ sides: 20, count: 3 }],
    resolve: (input) => resolvePerceptionCheck(input),
  },
];
