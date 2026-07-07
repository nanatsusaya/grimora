/**
 * Human-readable event descriptions (ADR 0004 §10): the audit/history UI shows a rendered sentence,
 * not the raw type/payload. Core provides generic phrasing here; rule-specific wording would come from
 * the plugin (the `character.checkRolled` outcome already carries a plugin `labelKey`). The stored
 * event keeps `type` + structured `payload`; the description is *derived*, so history stays stable
 * while wording/locale can change (i18n, ADR 0016).
 *
 * The skeleton renders a developer-English string (standing in for the localized result); a real build
 * resolves `labelKey`s through i18n at the presentation layer, never here.
 */

import type {
  CampaignCreated,
  CharacterAttributeSet,
  CharacterCheckRolled,
  CharacterCreated,
  StoredEvent,
} from "./events";

/**
 * Render one stored event as a human-readable line.
 * @param event  the stored event (type + payload)
 * @returns      a derived, presentation-ready sentence
 */
export function describeEvent(event: StoredEvent): string {
  switch (event.type) {
    case "campaign.created":
      return `Campaign "${(event.payload as CampaignCreated["payload"]).name}" created`;
    case "character.created":
      return `Character "${(event.payload as CharacterCreated["payload"]).name}" created`;
    case "character.attributeSet": {
      const p = event.payload as CharacterAttributeSet["payload"];
      return `Attribute ${p.attributeId} set to ${p.value}`;
    }
    case "character.checkRolled": {
      const p = event.payload as CharacterCheckRolled["payload"];
      const params = p.result.outcome.labelParams ?? {};
      const rendered = Object.entries(params)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ");
      return `Check "${p.checkId}" rolled → ${p.result.outcome.labelKey}${
        rendered ? ` (${rendered})` : ""
      }`;
    }
    default:
      return `Event ${event.type}`;
  }
}
