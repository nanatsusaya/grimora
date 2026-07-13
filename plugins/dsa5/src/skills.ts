/**
 * DSA5 skills (`kind: skill`) — rated talents tested via the skill-check mechanic (see `checks.ts`).
 *
 * Own module so the talent set (skeleton: perception only → a broader set, issue #211) grows without
 * touching the attribute, derived-value or check modules.
 */
import type { TraitDefinition } from '@grimora/plugin-sdk';

/**
 * Skills (talents) — rated, tested via the 3d20 skill check in `checks.ts`. Abstract ids +
 * i18n-key labels; mechanics/structure only (see the legal boundary).
 */
export const SKILLS: readonly TraitDefinition[] = [
  {
    kind: 'skill',
    id: 'PER',
    labelKey: 'dsa5.skill.perception',
    min: 0,
    max: 25,
    defaultValue: 0,
  },
  {
    kind: 'skill',
    id: 'BODY_CONTROL',
    labelKey: 'dsa5.skill.bodyControl',
    min: 0,
    max: 25,
    defaultValue: 0,
  },
];
