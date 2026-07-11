/**
 * `createRoleMatrixPolicy` unit tests (ADR 0017 §1, #106 acceptance criteria): the full pure matrix is
 * exercised across all four ADR 0009 §3 roles now, even though only the `owner` branch is reachable from
 * a real composition root today (no membership resolution wired yet, `ports.ts`'s `actorRole` doc) — so
 * the matrix is already correct and tested the moment #107/#120 start populating `actorRole`.
 */

import { describe, expect, it } from 'bun:test';
import type { EntityId } from '@grimora/shared-types';
import { createRoleMatrixPolicy } from './policy';
import type { Actor, PolicyResource, Role } from './ports';

const policy = createRoleMatrixPolicy();
const owner: Actor = { userId: 'owner' as EntityId };
const other: Actor = { userId: 'other' as EntityId };
const anon: Actor = { userId: '' as EntityId };

const ROLES: readonly Role[] = ['owner', 'gm', 'player', 'spectator'];

describe('createRoleMatrixPolicy — creation actions', () => {
  it('allows any authenticated actor to create, regardless of actorRole', () => {
    for (const actorRole of ROLES) {
      expect(policy.can(owner, 'campaign.create', { actorRole })).toBe(true);
      expect(policy.can(owner, 'character.create', { actorRole })).toBe(true);
    }
  });

  it('default-denies an unauthenticated (empty) actor', () => {
    expect(policy.can(anon, 'campaign.create', {})).toBe(false);
    expect(policy.can(anon, 'character.create', {})).toBe(false);
  });
});

describe('createRoleMatrixPolicy — resource-scoped write actions', () => {
  const resourceOwnedByOwner: PolicyResource = { ownerId: owner.userId };

  it('grants the owner write access to their own resource', () => {
    expect(policy.can(owner, 'character.setAttribute', resourceOwnedByOwner)).toBe(true);
    expect(policy.can(owner, 'character.rollCheck', resourceOwnedByOwner)).toBe(true);
  });

  it('denies a non-owner regardless of actorRole (owner decision 2026-07-11, #106: GM does not write)', () => {
    for (const actorRole of ROLES) {
      if (actorRole === 'owner') continue; // covered by the grant test above
      const resource: PolicyResource = { ownerId: owner.userId, actorRole };
      expect(policy.can(other, 'character.setAttribute', resource)).toBe(false);
      expect(policy.can(other, 'character.rollCheck', resource)).toBe(false);
    }
  });

  it('denies when no ownerId is known on the resource (default-deny)', () => {
    expect(policy.can(owner, 'character.setAttribute', {})).toBe(false);
    expect(policy.can(owner, 'character.rollCheck', {})).toBe(false);
  });

  it('never grants a spectator a write, even claiming ownership-adjacent membership', () => {
    const resource: PolicyResource = { ownerId: owner.userId, actorRole: 'spectator' };
    expect(policy.can(other, 'character.setAttribute', resource)).toBe(false);
    expect(policy.can(other, 'character.rollCheck', resource)).toBe(false);
  });
});
