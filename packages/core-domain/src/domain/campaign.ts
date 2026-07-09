/**
 * The Campaign aggregate (ADR 0004 §1, ADR 0020 core "campaign tooling"). Pure: decide-functions
 * validate intent and return events; `apply` folds a stored event into state. No I/O — ids/time come
 * from ports at the application layer.
 */

import type { EntityId } from '@grimora/shared-types';
import { err, ok, type Result } from '@grimora/shared-types';
import { type AppError, appError } from './errors';
import type { CampaignCreated, CampaignEvent, StoredEvent } from './events';

/** Folded campaign state. `version` tracks the last applied event's per-aggregate version. */
export interface CampaignState {
  readonly id: EntityId;
  /** Whether a `campaign.created` event has been folded — distinguishes an **empty stream** (never
   * created, or unknown id) from a real campaign, so decide-functions can enforce create-once. */
  readonly exists: boolean;
  /** The last applied event's per-aggregate version — the optimistic-concurrency baseline on append. */
  readonly version: number;
  readonly name: string;
  /** The owner (creator) — the provisional minimal authz subject (ADR 0022 §7). */
  readonly ownerId: EntityId;
}

/**
 * The zero state for a campaign stream before any event is applied (the fold's identity element).
 * @param id  the campaign stream id this empty state stands for
 * @returns   a non-existent (`exists: false`, `version: 0`) campaign state
 */
export function emptyCampaign(id: EntityId): CampaignState {
  // Empty-string sentinels for the branded id/name: this state is never read for those fields while
  // `exists` is false (the guard above), so a throwaway value is safe and avoids an Option everywhere.
  return { id, exists: false, version: 0, name: '', ownerId: '' as EntityId };
}

/**
 * Fold one stored event into campaign state (ADR 0004 §1). Total over the campaign event set.
 * @param state  the state so far
 * @param event  the stored event to apply (its `version` becomes the new state version)
 */
export function applyCampaign(state: CampaignState, event: StoredEvent): CampaignState {
  const next = { ...state, version: event.version };
  switch (event.type) {
    case 'campaign.created': {
      const payload = event.payload as CampaignCreated['payload'];
      return { ...next, exists: true, name: payload.name, ownerId: payload.ownerId };
    }
    default:
      return next;
  }
}

/**
 * Decide the events for creating a campaign. Validates that the campaign does not already exist and
 * has a non-empty name; the creator becomes the owner (ADR 0022 §7 provisional authz).
 *
 * @param state    the current (expected empty) campaign state
 * @param name     the campaign's display name
 * @param ownerId  the creating user
 * @returns        the `campaign.created` event, or a `Validation`/`Conflict` error
 */
export function createCampaign(
  state: CampaignState,
  name: string,
  ownerId: EntityId,
): Result<readonly CampaignEvent[], AppError> {
  if (state.exists) {
    return err(appError('campaign.already_exists', 'Conflict'));
  }
  if (name.trim() === '') {
    return err(appError('campaign.name_required', 'Validation'));
  }
  return ok([{ type: 'campaign.created', payload: { name, ownerId } }]);
}
