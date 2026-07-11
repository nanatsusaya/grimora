/**
 * Human-readable event descriptions (ADR 0004 §10): the audit/history UI shows a rendered sentence,
 * not the raw type/payload. Core provides generic phrasing here; rule-specific wording would come from
 * the plugin (the `character.checkRolled` outcome already carries a plugin `labelKey`). The stored
 * event keeps `type` + structured `payload`; the description is *derived*, so history stays stable
 * while wording/locale can change (i18n, ADR 0016).
 *
 * **Privacy (ADR 0023 §6/§8):** personal fields are read through a {@link Redactable} view built from the
 * event's classification, so the rendering **must branch** on whether the value is available and can never
 * hard-require it — "name changed" when a name is erased/unauthorized, never a crash. That obligation is
 * enforced by the type system (`view.name.present`), not by convention. The `canReveal` predicate is where
 * authorization + key-availability plug in later; in the skeleton nothing is erased, so it defaults to
 * "always reveal", but the absent branch already exists and is exercised by the tests.
 *
 * The skeleton renders a developer-English string (standing in for the localized result); a real build
 * resolves `labelKey`s through i18n at the presentation layer, never here.
 */

import { redactView } from '@grimora/rules-contract';
import {
  CAMPAIGN_CREATED_PRIVACY,
  type CampaignCreated,
  CHARACTER_CREATED_PRIVACY,
  type CharacterAttributeSet,
  type CharacterCheckRolled,
  type CharacterCreated,
  type StoredEvent,
} from './events';

/**
 * Render one stored event as a human-readable line, degrading gracefully when a personal field is
 * unavailable (ADR 0023 §6).
 * @param event      the stored event (type + payload)
 * @param canReveal  predicate deciding whether a personal field's subject may be shown here (authorization
 *                   + key availability); defaults to always-reveal for the skeleton, where nothing is erased
 * @returns          a derived, presentation-ready sentence
 */
export function describeEvent(
  event: StoredEvent,
  canReveal: (subjectRef: string) => boolean = () => true,
): string {
  switch (event.type) {
    case 'campaign.created': {
      const view = redactView(
        event.payload as CampaignCreated['payload'],
        CAMPAIGN_CREATED_PRIVACY,
        canReveal,
      );
      return view.name.present ? `Campaign "${view.name.value}" created` : 'Campaign created';
    }
    case 'character.created': {
      const view = redactView(
        event.payload as CharacterCreated['payload'],
        CHARACTER_CREATED_PRIVACY,
        canReveal,
      );
      return view.name.present ? `Character "${view.name.value}" created` : 'Character created';
    }
    case 'character.attributeSet': {
      // Wholly nonPersonal (trait id + value) — no redaction needed.
      const p = event.payload as CharacterAttributeSet['payload'];
      return `Attribute ${p.attributeId} set to ${p.value}`;
    }
    case 'character.checkRolled': {
      // Wholly nonPersonal (mechanical roll data, incl. the nonPersonal seed) — no redaction needed.
      const p = event.payload as CharacterCheckRolled['payload'];
      const params = p.result.outcome.labelParams ?? {};
      const rendered = Object.entries(params)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');
      return `Check "${p.checkId}" rolled → ${p.result.outcome.labelKey}${
        rendered ? ` (${rendered})` : ''
      }`;
    }
    default:
      return `Event ${event.type}`;
  }
}
