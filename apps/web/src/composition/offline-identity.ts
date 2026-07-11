/**
 * The **implicit local identity** for the offline-first shell (ADR 0012 §13).
 *
 * On a cold start with no prior login the device *is* the user: the app must not block on authentication,
 * so we mint (or reuse) a single device-scoped identity and append every event under it. It is **not** an
 * `AuthPort` session and carries **no token** (§13, so §5 token storage is unaffected); binding to a real
 * account happens later, on first successful online login (#105-E).
 *
 * **Where it is persisted — and why `localStorage`:** §13 says "reuse if already present in the local
 * store", but leaves the mechanism open. This device id is *installation config*, not domain data, so it
 * lives in `localStorage` rather than in either SQLite store, on purpose:
 *   - **not** the read-model store — that is a rebuildable projection whose `clear()` wipes everything on
 *     a projection rebuild (ADR 0004 §5); the identity must survive that.
 *   - **not** a domain event in the event store — an implicit device pointer that §13 explicitly frames as
 *     *not* a user aggregate should not be modelled as an intention-revealing domain event, and doing so
 *     would prematurely settle an event-payload schema/classification question that ADR 0004/0023 own.
 *   - **not** a token — so ADR 0012 §5's secure-token-storage rule does not apply (there is no secret).
 * This is a deliberate, reversible skeleton choice (documented so the owner can veto); when #105-E binds a
 * real account, the bound id supersedes this pointer.
 */

import type { Actor, IdGeneratorPort } from '@grimora/core-domain';
import type { EntityId } from '@grimora/shared-types';

/** The `localStorage` key holding this installation's implicit identity. Namespaced to avoid collisions. */
const DEVICE_IDENTITY_KEY = 'grimora.device-identity';

/**
 * Return the device's implicit local identity, creating and persisting one on first launch.
 *
 * Synchronous by design: identity must be available before the first local read/write, with no network or
 * async store round-trip on the critical path (ADR 0012 §2/§13). If `localStorage` is unavailable the call
 * throws rather than silently minting an ephemeral id — an ephemeral id would orphan the events written
 * under it, so failing loudly is the safer skeleton behaviour.
 * @param ids  the id generator used to mint a new identity on first launch (UUIDv7 in production)
 * @returns    the acting `Actor` for all offline use cases on this device
 */
export function ensureOfflineIdentity(ids: IdGeneratorPort): Actor {
  const existing = localStorage.getItem(DEVICE_IDENTITY_KEY);
  if (existing) {
    return { userId: existing as EntityId };
  }
  const userId = ids.newId();
  localStorage.setItem(DEVICE_IDENTITY_KEY, userId);
  return { userId };
}
