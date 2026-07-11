/**
 * The production authorization policy (ADR 0009 §3, ADR 0010 §2): the real `PolicyPort` implementation
 * a composition root wires, replacing the skeleton's owner-only `createOwnerPolicy` fake (`../testing`,
 * kept for tests, ADR 0022 §7). Closes #106 / the Epic #52 "authz-matrix depth" carry-over.
 */

import type { EntityId } from '@grimora/shared-types';
import type { PolicyPort } from './ports';

/**
 * Build the real Owner/GM/Player/Spectator authorization policy. A **pure** function of
 * (actor, action, resource) — see {@link PolicyPort} for the contract and the resolved
 * existence-before-authz rule its callers must apply.
 *
 * The full `Role` vocabulary (`owner`/`gm`/`player`/`spectator`) is part of the port surface so a
 * resource-scoped role can be threaded through once campaign membership is resolvable, but on the
 * skeleton's current action set the table below collapses to two rules, both **owner decisions made on
 * 2026-07-11 (ticket #106)**:
 *
 *  - **Creation actions** (`campaign.create`, `character.create`) only require an authenticated actor —
 *    there is no resource yet to scope a role against (unchanged from ADR 0022 §7).
 *  - **Resource-scoped write actions** (`character.setAttribute`, `character.rollCheck`) are
 *    **owner-only**: only `resource.ownerId === actor.userId` may write. A GM does **not** get write
 *    access to a player's character through this port — not even for a campaign they run. GM
 *    table-assist tooling, if it is ever built, would be its own named `PolicyAction` with its own
 *    resource-scoped GM check, not a blanket write grant folded into these two actions. Consequently
 *    `resource.actorRole` never changes the outcome of a write action here: only ownership does, and
 *    `gm`/`player`/`spectator` are equally denied.
 *  - **`spectator` is enforced as read-only by omission**: no action in this table ever returns `true`
 *    for `resource.actorRole === 'spectator'`, so a spectator cannot reach any write use case. Read
 *    access (viewing a campaign's projections) is intentionally **not** modeled on this port — ADR 0009
 *    §3 layers resource checks on roles for *commands*; read-scoping is the query/sync layer's concern
 *    (`ReadModelStorePort` today, RLS once `apps/api`/#107 exist), not this command-authorization port.
 *
 * **The ADR 0012 §13 unbound-device identity needs no special case.** Its implicit local identity *is*
 * the `userId` stamped on every event it appends (`apps/web`'s `ensureOfflineIdentity`), so it already
 * satisfies the ordinary owner check for everything it creates locally — the same branch a bound
 * account's owner takes, not a relaxation of it. There is deliberately no "unbound device" branch below.
 * @returns a `PolicyPort` enforcing the matrix above
 */
export function createRoleMatrixPolicy(): PolicyPort {
  return {
    can(actor, action, resource) {
      if (action === 'campaign.create' || action === 'character.create') {
        return actor.userId !== ('' as EntityId);
      }
      // character.setAttribute / character.rollCheck: owner-only write — see the header rationale.
      return resource.ownerId !== undefined && resource.ownerId === actor.userId;
    },
  };
}
