/**
 * DSA5 skills (`kind: skill`) — the rated talents of the catalog, **derived** as SDK `TraitDefinition`s
 * from the mechanical talent roster (`talents/`). Every DSA5 skill rates 0–25 and starts at 0; the
 * DSA5-specific data (attribute triple, category, improvement cost, encumbrance, applications) stays in
 * the catalog, never leaking into the rule-agnostic SDK trait (ADR 0020).
 */
import type { TraitDefinition } from '@grimora/plugin-sdk';
import { TALENTS } from './talents';

/**
 * The skill traits contributed by the plugin — one per catalog talent, at the DSA5 skill range (min 0,
 * max 25, default 0). Derived from `TALENTS` so the roster stays a single source of truth: a new or
 * corrected talent is a catalog edit, not a change here.
 */
export const SKILLS: readonly TraitDefinition[] = TALENTS.map((talent) => ({
  kind: 'skill',
  id: talent.id,
  labelKey: talent.labelKey,
  min: 0,
  max: 25,
  defaultValue: 0,
}));
