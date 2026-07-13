/**
 * End-to-end proof that a **concrete projection runs over the real adapters** (ADR 0004 §5, issue #104
 * AC): the DSA5 use-cases append events to the real `@grimora/event-store` SQLite adapter, and
 * `runCharacterSheetProjection` folds them into the real `@grimora/cqrs-read` SQLite read model. It
 * asserts the three properties the read side must have: the projection **builds** the sheet and advances
 * its checkpoint, a second run is **idempotent** (checkpoint stable, no change), and a **rebuild** from
 * `position 0` reproduces byte-identical state (rebuildability, ADR 0004 §5 — the same pass criterion the
 * skeleton proves over fakes, ADR 0022 §9, here over real storage).
 *
 * As a cross-adapter composition this lives in a `*.test.ts` (excluded from the dependency-cruiser
 * boundary rules): the *adapters* never import each other (`adapters-no-cross-adapter`), only this test
 * wires them, exactly as a composition root would (ADR 0003 §1).
 */

import { describe, expect, test } from 'bun:test';
import {
  type Actor,
  CHARACTER_SHEET,
  type CharacterSheet,
  type CommandDeps,
  createCampaign,
  createCharacter,
  createPluginHost,
  type ProjectionDeps,
  rebuildCharacterSheetProjection,
  rollCheck,
  runCharacterSheetProjection,
  setAttribute,
} from '@grimora/core-domain';
import {
  createFixedClock,
  createOwnerPolicy,
  createSequentialIdGenerator,
} from '@grimora/core-domain/testing';
import { createSqliteEventStore } from '@grimora/event-store';
import dsa5 from '@grimora/plugin-dsa5';
import type { EntityId } from '@grimora/shared-types';
import { createSqliteReadModelStore } from './index';

const owner: Actor = { userId: 'user-owner' as EntityId };
const campaignId = 'campaign-1' as EntityId;
const characterId = 'character-1' as EntityId;

/**
 * Wire the real SQLite event store + DSA5 plugin, then drive the golden-path use-cases so the event log
 * holds a realistic character stream (create → set attributes → roll). Returns the command + projection
 * dependency bundles sharing that one event store, plus a `close` to release both DB handles.
 */
async function seedRealEventStore(): Promise<{
  readonly command: CommandDeps;
  readonly projection: ProjectionDeps;
  readonly close: () => void;
}> {
  const events = createSqliteEventStore();
  const reads = createSqliteReadModelStore();
  const host = createPluginHost();
  host.load(dsa5);

  const command: CommandDeps = {
    events,
    ids: createSequentialIdGenerator('ev'),
    clock: createFixedClock(),
    policy: createOwnerPolicy(),
    rules: host,
  };

  const seed = async () => {
    const steps = [
      await createCampaign(command, { campaignId, name: 'The Northlands', actor: owner }),
      await createCharacter(command, {
        characterId,
        name: 'Alrik',
        campaignId,
        ruleSystemId: 'dsa5',
        actor: owner,
      }),
      await setAttribute(command, { characterId, attributeId: 'COU', value: 14, actor: owner }),
      await setAttribute(command, { characterId, attributeId: 'SGC', value: 13, actor: owner }),
      await setAttribute(command, { characterId, attributeId: 'AGI', value: 12, actor: owner }),
      await setAttribute(command, { characterId, attributeId: 'INT', value: 13, actor: owner }),
      await setAttribute(command, {
        characterId,
        attributeId: 'PERCEPTION',
        value: 6,
        actor: owner,
      }),
      await rollCheck(command, { characterId, checkId: 'perception', actor: owner }),
    ];
    for (const step of steps) {
      if (!step.ok) throw new Error(`seed step failed: ${step.error.code}`);
    }
  };
  await seed();

  return {
    command,
    projection: { events, reads, rules: host },
    close: () => {
      events.close();
      reads.close();
    },
  };
}

describe('character-sheet projection over the real SQLite adapters (#104)', () => {
  test('builds the read model from the event log and advances the checkpoint', async () => {
    const { projection, close } = await seedRealEventStore();
    try {
      await runCharacterSheetProjection(projection);

      const sheet = await projection.reads.get<CharacterSheet>(CHARACTER_SHEET, characterId);
      expect(sheet?.name).toBe('Alrik');
      expect(sheet?.attributes).toEqual({ COU: 14, SGC: 13, AGI: 12, INT: 13, PERCEPTION: 6 });
      // LP is a formula-derived value (never stored) recomputed by the interpreter (ADR 0020/0021);
      // the DSA5 skeleton formula is LP = 5 + COU + AGI (matches the golden-path walk).
      expect(sheet?.derived.LP).toBe(5 + 14 + 12);
      // create + 5 attribute sets + 1 roll = 7 history lines folded in.
      expect(sheet?.history.length).toBe(7);

      // The checkpoint advanced to the last event's position (a non-zero, positive high-water mark).
      const checkpoint = await projection.reads.getCheckpoint(CHARACTER_SHEET);
      const all = await projection.events.readAll();
      expect(checkpoint).toBe(all[all.length - 1]?.position);
    } finally {
      close();
    }
  });

  test('a second projection run is idempotent — checkpoint stable, read model unchanged', async () => {
    const { projection, close } = await seedRealEventStore();
    try {
      await runCharacterSheetProjection(projection);
      const first = await projection.reads.get<CharacterSheet>(CHARACTER_SHEET, characterId);
      const checkpointAfterFirst = await projection.reads.getCheckpoint(CHARACTER_SHEET);

      await runCharacterSheetProjection(projection); // no new events → a no-op
      const second = await projection.reads.get<CharacterSheet>(CHARACTER_SHEET, characterId);
      const checkpointAfterSecond = await projection.reads.getCheckpoint(CHARACTER_SHEET);

      expect(checkpointAfterSecond).toBe(checkpointAfterFirst);
      expect(second).toEqual(first);
    } finally {
      close();
    }
  });

  test('rebuild from position 0 reproduces byte-identical state (rebuildability, ADR 0004 §5)', async () => {
    const { projection, close } = await seedRealEventStore();
    try {
      await runCharacterSheetProjection(projection);
      const before = await projection.reads.get<CharacterSheet>(CHARACTER_SHEET, characterId);
      const checkpointBefore = await projection.reads.getCheckpoint(CHARACTER_SHEET);

      // clear() + replay from position 0 — the migration-as-replay path (ADR 0005 §6).
      await rebuildCharacterSheetProjection(projection);
      const after = await projection.reads.get<CharacterSheet>(CHARACTER_SHEET, characterId);
      const checkpointAfter = await projection.reads.getCheckpoint(CHARACTER_SHEET);

      expect(after).toEqual(before);
      expect(checkpointAfter).toBe(checkpointBefore);
    } finally {
      close();
    }
  });

  test('re-delivery after a checkpoint lag is a no-op — no duplicate history (#150)', async () => {
    const { projection, close } = await seedRealEventStore();
    try {
      await runCharacterSheetProjection(projection);
      const before = await projection.reads.get<CharacterSheet>(CHARACTER_SHEET, characterId);
      const head = await projection.reads.getCheckpoint(CHARACTER_SHEET);

      // Simulate a crash between the read-model write and the checkpoint advance (two non-atomic steps
      // in the projection): the read models are already persisted but the checkpoint lags behind, so a
      // restart re-delivers every event. Rewinding the checkpoint to 0 reproduces exactly that state.
      await projection.reads.setCheckpoint(CHARACTER_SHEET, 0);
      await runCharacterSheetProjection(projection);

      const after = await projection.reads.get<CharacterSheet>(CHARACTER_SHEET, characterId);
      // Without the per-sheet `lastPosition` watermark this re-appended every history line (7 → 14).
      expect(after?.history.length).toBe(7);
      expect(after).toEqual(before);
      expect(await projection.reads.getCheckpoint(CHARACTER_SHEET)).toBe(head);
    } finally {
      close();
    }
  });
});
