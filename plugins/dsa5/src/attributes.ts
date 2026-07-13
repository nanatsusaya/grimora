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
 *
 * Ordered in canonical DSA5 sequence (mental group COU/SGC/INT/CHA, then physical group
 * DEX/AGI/CON/STR) so the character sheet renders attributes the way players expect. Ids are the
 * official English DSA5 abbreviations, kept stable as the machine-readable key; the human-readable
 * name is resolved via `labelKey` through i18n, never hard-coded here. The 8/20 bounds and default of
 * 8 are neutral generic functional limits, not proprietary rulebook values.
 */
export const ATTRIBUTES: readonly TraitDefinition[] = [
  { kind: 'attribute', id: 'COU', labelKey: 'dsa5.attr.courage', min: 8, max: 20, defaultValue: 8 },
  {
    kind: 'attribute',
    id: 'SGC',
    labelKey: 'dsa5.attr.sagacity',
    min: 8,
    max: 20,
    defaultValue: 8,
  },
  {
    kind: 'attribute',
    id: 'INT',
    labelKey: 'dsa5.attr.intuition',
    min: 8,
    max: 20,
    defaultValue: 8,
  },
  {
    kind: 'attribute',
    id: 'CHA',
    labelKey: 'dsa5.attr.charisma',
    min: 8,
    max: 20,
    defaultValue: 8,
  },
  {
    kind: 'attribute',
    id: 'DEX',
    labelKey: 'dsa5.attr.dexterity',
    min: 8,
    max: 20,
    defaultValue: 8,
  },
  { kind: 'attribute', id: 'AGI', labelKey: 'dsa5.attr.agility', min: 8, max: 20, defaultValue: 8 },
  {
    kind: 'attribute',
    id: 'CON',
    labelKey: 'dsa5.attr.constitution',
    min: 8,
    max: 20,
    defaultValue: 8,
  },
  {
    kind: 'attribute',
    id: 'STR',
    labelKey: 'dsa5.attr.strength',
    min: 8,
    max: 20,
    defaultValue: 8,
  },
];
