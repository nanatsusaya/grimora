/**
 * Walking-skeleton integration tests (ADR 0017 §1 layer 5-ish): the ADR 0022 §9 **pass criteria**,
 * exercised through the whole core slice with the real DSA5 plugin. Deterministic (fake clock/id +
 * seeded RNG), no infrastructure. Pass criterion 6 ("boundaries hold on real code") is `bun run arch`,
 * asserted by the harness rather than here.
 */

import { describe, expect, it } from 'bun:test';
import {
  type Actor,
  applyCharacter,
  CHARACTER_SHEET,
  type CharacterSheet,
  type CommandDeps,
  createCampaign,
  createCharacter,
  createPluginHost,
  emptyCharacter,
  rollCheck,
  runAiToolTurn,
  runCharacterSheetProjection,
  setAttribute,
} from '@grimora/core-domain';
import {
  createFixedClock,
  createInMemoryEventStore,
  createInMemoryReadModelStore,
  createOwnerPolicy,
  createScriptedAiProvider,
  createSequentialIdGenerator,
  createSyncHarness,
} from '@grimora/core-domain/testing';
import dsa5 from '@grimora/plugin-dsa5';
import type { EntityId, PersistedEvent } from '@grimora/shared-types';

const owner: Actor = { userId: 'owner' as EntityId };
const campaignId = 'campaign-1' as EntityId;
const characterId = 'character-1' as EntityId;

function makeDeps(idPrefix = 'ev') {
  const events = createInMemoryEventStore();
  const reads = createInMemoryReadModelStore();
  const host = createPluginHost();
  host.load(dsa5);
  const deps: CommandDeps = {
    events,
    ids: createSequentialIdGenerator(idPrefix),
    clock: createFixedClock(),
    policy: createOwnerPolicy(),
    rules: host,
  };
  return { deps, events, reads, host };
}

/** Drive the golden path (campaign → character → attributes → roll) for a wired deps bundle. */
async function driveGoldenPath(deps: CommandDeps): Promise<void> {
  await createCampaign(deps, { campaignId, name: 'The Northlands', actor: owner });
  await createCharacter(deps, {
    characterId,
    name: 'Alrik',
    campaignId,
    ruleSystemId: 'dsa5',
    actor: owner,
  });
  for (const [attributeId, value] of [
    ['COU', 14],
    ['SGC', 13],
    ['AGI', 12],
    ['INT', 13],
    ['PERCEPTION', 6],
  ] as const) {
    await setAttribute(deps, { characterId, attributeId, value, actor: owner });
  }
  await rollCheck(deps, { characterId, checkId: 'perception', actor: owner });
}

describe('golden path (steps 1–8)', () => {
  it('produces a sheet with generic attributes, a formula-derived value and event history', async () => {
    const { deps, events, reads, host } = makeDeps();
    await driveGoldenPath(deps);
    await runCharacterSheetProjection({ events, reads, rules: host });

    const sheet = await reads.get<CharacterSheet>(CHARACTER_SHEET, characterId);
    expect(sheet).toBeDefined();
    expect(sheet?.attributes).toEqual({ COU: 14, SGC: 13, AGI: 12, INT: 13, PERCEPTION: 6 });
    // Derived value LP = 5 + COU + AGI, computed by the core formula interpreter over the plugin's AST.
    expect(sheet?.derived.LP).toBe(5 + 14 + 12);
    // History includes the roll (rendered via the plugin's outcome labelKey).
    expect(sheet?.history.some((line) => line.includes('perception'))).toBe(true);
  });
});

describe('replay determinism (pass criterion 2)', () => {
  it('folds a stream to identical state twice', async () => {
    const { deps, events } = makeDeps();
    await driveGoldenPath(deps);
    const stream = await events.readStream(characterId);
    const fold = () =>
      stream.reduce((s, e: PersistedEvent) => applyCharacter(s, e), emptyCharacter(characterId));
    expect(fold()).toEqual(fold());
  });

  it('rebuilds the projection from position 0 to an identical read model', async () => {
    const { deps, events, host } = makeDeps();
    await driveGoldenPath(deps);

    const readsA = createInMemoryReadModelStore();
    await runCharacterSheetProjection({ events, reads: readsA, rules: host });
    const sheetA = await readsA.get<CharacterSheet>(CHARACTER_SHEET, characterId);

    const readsB = createInMemoryReadModelStore();
    await runCharacterSheetProjection({ events, reads: readsB, rules: host });
    const sheetB = await readsB.get<CharacterSheet>(CHARACTER_SHEET, characterId);

    expect(sheetA).toEqual(sheetB);
  });

  it('rolls the same result for the same stream state (seeded determinism)', async () => {
    // Two independent stores, same character id + same attributes ⇒ same seed ⇒ same pips.
    const roll = async (idPrefix: string) => {
      const { deps, events } = makeDeps(idPrefix);
      await driveGoldenPath(deps);
      const stream = await events.readStream(characterId);
      const rolled = stream.find((e) => e.type === 'character.checkRolled');
      return (rolled?.payload as { result: { rolls: number[][] } }).result.rolls;
    };
    expect(await roll('A')).toEqual(await roll('B'));
  });
});

describe('authorization parity (pass criterion 5)', () => {
  it('denies a non-owner identically on the UI path and the AI tool path', async () => {
    const { deps } = makeDeps();
    await driveGoldenPath(deps);
    const intruder: Actor = { userId: 'intruder' as EntityId };
    const ai = createScriptedAiProvider({
      tool: 'core.character.rollCheck',
      args: { characterId, checkId: 'perception' },
    });

    const uiResult = await rollCheck(deps, { characterId, checkId: 'perception', actor: intruder });
    const aiResult = await runAiToolTurn(deps, ai, intruder, 'roll it');

    expect(uiResult.ok).toBe(false);
    expect(aiResult.ok).toBe(false);
    // Both rejected by the same PolicyPort → same category (no privileged AI path, ADR 0008 §2).
    // NotFound, not Forbidden: existence-before-authz is NotFound-uniform (ADR 0010 §1, #106) so an
    // intruder's error can't be used to distinguish "not authorized" from "doesn't exist".
    if (!uiResult.ok && !aiResult.ok) {
      expect(uiResult.error.category).toBe('NotFound');
      expect(aiResult.error.category).toBe('NotFound');
    }

    // The owner is allowed on both paths.
    const aiOwner = await runAiToolTurn(deps, ai, owner, 'roll it');
    expect(aiOwner.ok).toBe(true);
  });
});

describe('offline sync (pass criteria 3 & 4)', () => {
  const userA: Actor = { userId: 'user-a' as EntityId };
  const charId = 'character-2' as EntityId;

  async function setup() {
    const harness = createSyncHarness(dsa5);
    const a = harness.createClient('A');
    const b = harness.createClient('B');
    await createCharacter(a.deps, {
      characterId: charId,
      name: 'Layariel',
      campaignId: 'campaign-2' as EntityId,
      ruleSystemId: 'dsa5',
      actor: userA,
    });
    for (const [attributeId, value] of [
      ['COU', 13],
      ['SGC', 13],
      ['AGI', 12],
      ['INT', 14],
      ['PERCEPTION', 5],
    ] as const) {
      await setAttribute(a.deps, { characterId: charId, attributeId, value, actor: userA });
    }
    await harness.push(a);
    await harness.pull(a);
    await harness.pull(b);
    return { harness, a, b };
  }

  async function project(store: ReturnType<typeof createInMemoryEventStore>) {
    const reads = createInMemoryReadModelStore();
    const host = createPluginHost();
    host.load(dsa5);
    await runCharacterSheetProjection({ events: store, reads, rules: host });
    return reads.get<CharacterSheet>(CHARACTER_SHEET, charId);
  }

  it('auto-merges concurrent edits to different attributes and converges', async () => {
    const { harness, a, b } = await setup();
    await setAttribute(a.deps, {
      characterId: charId,
      attributeId: 'COU',
      value: 15,
      actor: userA,
    });
    await setAttribute(b.deps, {
      characterId: charId,
      attributeId: 'AGI',
      value: 11,
      actor: userA,
    });
    await harness.push(a);
    await harness.push(b);
    await harness.pull(a);
    await harness.pull(b);

    const sheetA = await project(a.store);
    const sheetB = await project(b.store);
    expect(sheetA?.attributes).toMatchObject({ COU: 15, AGI: 11 });
    expect(sheetA?.attributes).toEqual(sheetB?.attributes);
  });

  it("carries a synced roll's original result (does not re-roll)", async () => {
    const { harness, a, b } = await setup();
    await rollCheck(a.deps, { characterId: charId, checkId: 'perception', actor: userA });
    const aRoll = a.store.snapshotAll().find((e) => e.type === 'character.checkRolled');
    await harness.push(a);
    await harness.pull(b);
    const bRoll = b.store.snapshotAll().find((e) => e.type === 'character.checkRolled');

    expect(bRoll).toBeDefined();
    // Same event id + same result ⇒ carried as a fact, not re-executed (a re-roll would use B's ids).
    expect(bRoll?.id).toBe(aRoll?.id as EntityId);
    expect((bRoll?.payload as { result: unknown }).result).toEqual(
      (aRoll?.payload as { result: unknown }).result,
    );
  });
});
