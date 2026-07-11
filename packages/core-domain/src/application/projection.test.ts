/**
 * Idempotency of the character-sheet projection under **event re-delivery** (ADR 0004 §5, issue #150).
 *
 * `runCharacterSheetProjection` writes the read model (`put`) and advances the checkpoint
 * (`setCheckpoint`) as two separate awaits, not one transaction. A crash between them leaves the read
 * model ahead of the checkpoint, so on restart every event since the checkpoint is **re-delivered**.
 * Before the per-sheet `lastPosition` watermark, the fold re-appended each `describe()` line and
 * duplicated the sheet's `history`; this test reproduces that exact scenario (rewind the checkpoint, then
 * re-run) and asserts the fold is a no-op. Pure Application test over in-memory fakes (ADR 0017 — prefer
 * pure Domain/Application tests over adapter/E2E).
 */

import { describe, expect, test } from 'bun:test';
import type { EntityId, EventEnvelope, IsoTimestamp } from '@grimora/shared-types';
import { createInMemoryEventStore, createInMemoryReadModelStore } from '../testing';
import type { RuleSystemRegistryPort } from './ports';
import { CHARACTER_SHEET, type CharacterSheet, runCharacterSheetProjection } from './projection';

const charId = 'character-1' as EntityId;
const ownerId = 'user-1' as EntityId;
const campaignId = 'campaign-1' as EntityId;
const at = '2026-07-07T00:00:00.000Z' as IsoTimestamp;

/**
 * A rule registry that contributes nothing: the idempotency behaviour under test is independent of
 * derived values, so `computeDerived` returning an empty set (no loaded rule system) is fine here.
 */
const noRules: RuleSystemRegistryPort = {
  getRuleSystem: () => undefined,
  getCheck: () => undefined,
  getRatedTrait: () => undefined,
  getProvenance: () => undefined,
};

/**
 * One character stream (created + two attribute sets) as fully-formed envelopes — enough distinct
 * `history` lines that a duplicate would be obvious (3 vs. 6).
 * @returns the ordered envelopes to append to a fresh stream
 */
function characterStream(): EventEnvelope[] {
  const base = {
    aggregateId: charId,
    aggregateType: 'character',
    schemaVersion: 1,
    occurredAt: at,
  } as const;
  return [
    {
      ...base,
      id: 'ev-1' as EntityId,
      type: 'character.created',
      version: 1,
      payload: {
        name: 'Alrik',
        campaignId,
        ownerId,
        ruleSystemId: 'dsa5',
        pluginId: 'org.example.test',
        pluginVersion: '0.0.0',
      },
    },
    {
      ...base,
      id: 'ev-2' as EntityId,
      type: 'character.attributeSet',
      version: 2,
      payload: { attributeId: 'COU', value: 14 },
    },
    {
      ...base,
      id: 'ev-3' as EntityId,
      type: 'character.attributeSet',
      version: 3,
      payload: { attributeId: 'AGI', value: 12 },
    },
  ];
}

describe('character-sheet projection idempotency (#150)', () => {
  test('re-delivering events after a checkpoint lag is a no-op (no duplicate history)', async () => {
    const events = createInMemoryEventStore();
    const reads = createInMemoryReadModelStore();
    const deps = { events, reads, rules: noRules };

    const seeded = await events.append(charId, 0, characterStream());
    expect(seeded.ok).toBe(true);

    await runCharacterSheetProjection(deps);
    const first = await reads.get<CharacterSheet>(CHARACTER_SHEET, charId);
    expect(first?.history.length).toBe(3);
    expect(first?.lastPosition).toBe(3);

    // Simulate a crash between the read-model write and the checkpoint advance: the read models are
    // persisted but the checkpoint lags, so a restart re-delivers every event from position 0.
    await reads.setCheckpoint(CHARACTER_SHEET, 0);
    await runCharacterSheetProjection(deps);

    const second = await reads.get<CharacterSheet>(CHARACTER_SHEET, charId);
    // The bug this guards: without the watermark, re-delivery re-appends and history becomes length 6.
    expect(second?.history.length).toBe(3);
    expect(second).toEqual(first);
    // The checkpoint advances back to the head after the replay.
    expect(await reads.getCheckpoint(CHARACTER_SHEET)).toBe(3);
  });
});
