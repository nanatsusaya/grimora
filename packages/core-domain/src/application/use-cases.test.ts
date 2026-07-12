/**
 * Application-layer use-case tests (ADR 0017 §1): authorization (default-deny + owner-scoped) and the
 * success **and** failure paths for each command (ADR 0017 §4/R4 — guarded transitions get a
 * rejection-path test). Uses in-memory fakes + an inline minimal plugin (no dependency on dsa5).
 */

import { describe, expect, it } from 'bun:test';
import { definePlugin, type GrimoraPlugin } from '@grimora/plugin-sdk';
import { type EntityId, ok } from '@grimora/shared-types';
import {
  createFixedClock,
  createInMemoryEventStore,
  createOwnerPolicy,
  createSequentialIdGenerator,
} from '../testing/fakes';
import { createPluginHost } from './plugin-host';
import type { Actor } from './ports';
import {
  type CommandDeps,
  createCampaign,
  createCharacter,
  createCharacterWithAttributes,
  rollCheck,
  setAttribute,
} from './use-cases';

const testPlugin: GrimoraPlugin = definePlugin(
  { id: 'test.rules', name: 'Test', version: '1.0.0', sdkVersion: 0 },
  (registry) => {
    registry.registerRuleSystem({
      id: 'test',
      labelKey: 'test',
      traits: [{ kind: 'attribute', id: 'STR', labelKey: 'str', min: 1, max: 10, defaultValue: 1 }],
      checks: [
        {
          id: 'lift',
          labelKey: 'lift',
          attributeIds: ['STR'],
          terms: [{ sides: 6, count: 1 }],
          resolve: (input) =>
            ok({ value: { die: input.rolls[0]?.[0] ?? 0 }, labelKey: 'lift.done' }),
        },
      ],
    });
  },
);

function makeDeps(): CommandDeps {
  const host = createPluginHost();
  host.load(testPlugin);
  return {
    events: createInMemoryEventStore(),
    ids: createSequentialIdGenerator('t'),
    clock: createFixedClock(),
    policy: createOwnerPolicy(),
    rules: host,
  };
}

const owner: Actor = { userId: 'owner' as EntityId };
const intruder: Actor = { userId: 'intruder' as EntityId };
const campaignId = 'c1' as EntityId;
const characterId = 'ch1' as EntityId;

async function seedCharacter(deps: CommandDeps): Promise<void> {
  await createCampaign(deps, { campaignId, name: 'C', actor: owner });
  await createCharacter(deps, {
    characterId,
    name: 'Hero',
    campaignId,
    ruleSystemId: 'test',
    actor: owner,
  });
}

describe('createCampaign', () => {
  it('creates for an authenticated actor and rejects an empty actor (default-deny)', async () => {
    const deps = makeDeps();
    expect((await createCampaign(deps, { campaignId, name: 'C', actor: owner })).ok).toBe(true);
    const anon = await createCampaign(deps, {
      campaignId: 'c2' as EntityId,
      name: 'C',
      actor: { userId: '' as EntityId },
    });
    expect(anon.ok).toBe(false);
  });

  it('rejects a blank name (Validation)', async () => {
    const result = await createCampaign(makeDeps(), { campaignId, name: '   ', actor: owner });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.category).toBe('Validation');
  });
});

describe('createCharacter', () => {
  it('requires the rule system to be loaded', async () => {
    const result = await createCharacter(makeDeps(), {
      characterId,
      name: 'Hero',
      campaignId,
      ruleSystemId: 'unloaded',
      actor: owner,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('character.rule_system_not_loaded');
  });
});

describe('setAttribute', () => {
  it('lets the owner set a valid value', async () => {
    const deps = makeDeps();
    await seedCharacter(deps);
    expect(
      (await setAttribute(deps, { characterId, attributeId: 'STR', value: 5, actor: owner })).ok,
    ).toBe(true);
  });

  it('denies a non-owner with NotFound-uniform (ADR 0010 §1, #106 — same PolicyPort the AI path reuses; not a distinguishable Forbidden, so the error cannot be used to enumerate real ids)', async () => {
    const deps = makeDeps();
    await seedCharacter(deps);
    const result = await setAttribute(deps, {
      characterId,
      attributeId: 'STR',
      value: 5,
      actor: intruder,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.category).toBe('NotFound');
      expect(result.error.code).toBe('character.not_found');
    }
  });

  it('rejects an out-of-range value and an unknown attribute (Validation)', async () => {
    const deps = makeDeps();
    await seedCharacter(deps);
    const outOfRange = await setAttribute(deps, {
      characterId,
      attributeId: 'STR',
      value: 99,
      actor: owner,
    });
    expect(outOfRange.ok).toBe(false);
    const unknown = await setAttribute(deps, {
      characterId,
      attributeId: 'XXX',
      value: 3,
      actor: owner,
    });
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.error.code).toBe('character.unknown_attribute');
  });

  it('returns the identical error for an absent character and a non-owner on an existing one (NotFound-uniform, #106)', async () => {
    const deps = makeDeps();
    await seedCharacter(deps);
    const absent = await setAttribute(deps, {
      characterId: 'ch-does-not-exist' as EntityId,
      attributeId: 'STR',
      value: 5,
      actor: owner,
    });
    const unauthorized = await setAttribute(deps, {
      characterId,
      attributeId: 'STR',
      value: 5,
      actor: intruder,
    });
    expect(absent.ok).toBe(false);
    expect(unauthorized.ok).toBe(false);
    if (!absent.ok && !unauthorized.ok) {
      expect(unauthorized.error).toEqual(absent.error);
    }
  });
});

describe('rollCheck', () => {
  it('lets the owner roll and denies a non-owner with NotFound-uniform (#106)', async () => {
    const deps = makeDeps();
    await seedCharacter(deps);
    await setAttribute(deps, { characterId, attributeId: 'STR', value: 5, actor: owner });
    expect((await rollCheck(deps, { characterId, checkId: 'lift', actor: owner })).ok).toBe(true);
    const denied = await rollCheck(deps, { characterId, checkId: 'lift', actor: intruder });
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.error.category).toBe('NotFound');
      expect(denied.error.code).toBe('character.not_found');
    }
  });

  it('rejects an unknown check (NotFound)', async () => {
    const deps = makeDeps();
    await seedCharacter(deps);
    await setAttribute(deps, { characterId, attributeId: 'STR', value: 5, actor: owner });
    const result = await rollCheck(deps, { characterId, checkId: 'nope', actor: owner });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('character.unknown_check');
  });
});

describe('createCharacterWithAttributes (atomic creation, #191)', () => {
  it('creates the character and all starting attributes in a single contiguous batch', async () => {
    const deps = makeDeps();
    await createCampaign(deps, { campaignId, name: 'C', actor: owner });
    const result = await createCharacterWithAttributes(deps, {
      characterId,
      name: 'Hero',
      campaignId,
      ruleSystemId: 'test',
      actor: owner,
      attributes: [['STR', 5]],
    });
    expect(result.ok).toBe(true);
    const events = await deps.events.readStream(characterId);
    expect(events.map((e) => e.type)).toEqual(['character.created', 'character.attributeSet']);
    // Contiguous per-aggregate versions from one append (satisfies the store's batch invariants, #186).
    expect(events.map((e) => e.version)).toEqual([1, 2]);
  });

  it('persists NOTHING when a starting attribute is out of range — no half-created character', async () => {
    const deps = makeDeps();
    await createCampaign(deps, { campaignId, name: 'C', actor: owner });
    const result = await createCharacterWithAttributes(deps, {
      characterId,
      name: 'Hero',
      campaignId,
      ruleSystemId: 'test',
      actor: owner,
      attributes: [
        ['STR', 5],
        ['STR', 99], // > max 10 → the whole creation must be rejected, not persisted partially
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.category).toBe('Validation');
    // The atomicity guarantee: the earlier valid events were never appended either.
    expect((await deps.events.readStream(characterId)).length).toBe(0);
  });

  it('rejects an unknown starting attribute without persisting anything', async () => {
    const deps = makeDeps();
    await createCampaign(deps, { campaignId, name: 'C', actor: owner });
    const result = await createCharacterWithAttributes(deps, {
      characterId,
      name: 'Hero',
      campaignId,
      ruleSystemId: 'test',
      actor: owner,
      attributes: [['NOPE', 1]],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('character.unknown_attribute');
    expect((await deps.events.readStream(characterId)).length).toBe(0);
  });

  it('requires the rule system to be loaded (nothing persisted)', async () => {
    const deps = makeDeps();
    await createCampaign(deps, { campaignId, name: 'C', actor: owner });
    const result = await createCharacterWithAttributes(deps, {
      characterId,
      name: 'Hero',
      campaignId,
      ruleSystemId: 'missing',
      actor: owner,
      attributes: [['STR', 5]],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.category).toBe('NotFound');
    expect((await deps.events.readStream(characterId)).length).toBe(0);
  });
});
