/**
 * The complete DSA5 talent (skill) catalog — the five talent groups concatenated into one mechanical
 * source of truth. `skills.ts` and `checks.ts` derive the SDK `TraitDefinition`s / `CheckDefinition`s
 * from this list, so adding or correcting a talent is a one-line data change with no wiring to touch.
 * Sourced from the official English *The Dark Eye* Regel-Wiki (<https://tde.ulisses-regelwiki.de/>);
 * mechanical roster only, per `docs/legal/dsa5-content-boundary.md`.
 */
import { CRAFT_TALENTS } from './craft';
import { KNOWLEDGE_TALENTS } from './knowledge';
import { NATURE_TALENTS } from './nature';
import { PHYSICAL_TALENTS } from './physical';
import { SOCIAL_TALENTS } from './social';
import type { Talent } from './types';

/**
 * All DSA5 base talents (the 59-entry Grundregelwerk roster), grouped-then-flattened in category order.
 * The single source of truth the skill traits and checks are generated from.
 */
export const TALENTS: readonly Talent[] = [
  ...PHYSICAL_TALENTS,
  ...SOCIAL_TALENTS,
  ...NATURE_TALENTS,
  ...KNOWLEDGE_TALENTS,
  ...CRAFT_TALENTS,
];

export type { Talent } from './types';
