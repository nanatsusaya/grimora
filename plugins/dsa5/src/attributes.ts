/**
 * DSA5 attributes (`kind: attribute`) — the rated core traits a character sheet is built on.
 *
 * Kept in its own module so the attribute set can grow (walking-skeleton COU/AGI/INT → the full DSA5
 * set, issue #211) without touching the derived-value, skill or check modules — which is what lets the
 * Tier-1 workstreams proceed as conflict-free parallel edits.
 */
import type { TraitDefinition } from '@grimora/plugin-sdk';

/**
 * Rated attributes — abstract ids, i18n-key labels, generic DSA5 bounds. Mechanics/structure only:
 * no rulebook text or values (see the legal boundary).
 */
export const ATTRIBUTES: readonly TraitDefinition[] = [
  { kind: 'attribute', id: 'COU', labelKey: 'dsa5.attr.courage', min: 8, max: 20, defaultValue: 8 },
  { kind: 'attribute', id: 'AGI', labelKey: 'dsa5.attr.agility', min: 8, max: 20, defaultValue: 8 },
  {
    kind: 'attribute',
    id: 'INT',
    labelKey: 'dsa5.attr.intuition',
    min: 8,
    max: 20,
    defaultValue: 8,
  },
];
