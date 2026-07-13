/**
 * The runnable "walk" (ADR 0022 §10): a thin composition root that wires the in-memory fakes + core +
 * the DSA5 plugin and *walks the golden path once* for observation (`bun run walk`) — true to a
 * **walking** skeleton and to CLAUDE.md's "verify by exercising it end-to-end". As a composition root
 * (apps/*) it is the one place allowed to import adapters (the fakes), the core, and a plugin together.
 *
 * The rigorous pass-criteria assertions live in the test suites (ADR 0017); this script is the
 * human-observable demonstration. It exits non-zero if any step misbehaves, so it is a real check.
 */

import {
  type Actor,
  CHARACTER_SHEET,
  type CharacterSheet,
  type CommandDeps,
  createCampaign,
  createCharacter,
  createPluginHost,
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
import type { EntityId, Result } from '@grimora/shared-types';

/** Assert a condition, logging a tick or throwing (which fails the walk). */
function check(condition: boolean, label: string): void {
  if (!condition) throw new Error(label);
  console.log(`  ✓ ${label}`);
}

/** Assert a use-case `Result` is ok (else fail the walk with the error code). */
function ensureOk(result: Result<unknown, { code: string }>, label: string): void {
  if (!result.ok) throw new Error(`${label} — failed with ${result.error.code}`);
  console.log(`  ✓ ${label}`);
}

async function main(): Promise<void> {
  const owner: Actor = { userId: 'user-owner' as EntityId };

  // Wire the hexagon: in-memory adapters (fakes) → ports; load the DSA5 plugin in-process.
  const events = createInMemoryEventStore();
  const reads = createInMemoryReadModelStore();
  const host = createPluginHost();
  const deps: CommandDeps = {
    events,
    ids: createSequentialIdGenerator('ev'),
    clock: createFixedClock(),
    policy: createOwnerPolicy(),
    rules: host,
  };

  console.log('\n— Golden path —');
  const campaignId = 'campaign-1' as EntityId;
  const characterId = 'character-1' as EntityId;

  // 1 + 2: create a campaign; enable the DSA5 plugin (loading it into the host).
  ensureOk(
    await createCampaign(deps, { campaignId, name: 'The Northlands', actor: owner }),
    '1. campaign created',
  );
  host.load(dsa5);
  check(host.getRuleSystem('dsa5') !== undefined, '2. DSA5 plugin enabled (rule system available)');

  // 3 + 4 + 5: create the character (bound to dsa5, with provenance); set generic attributes.
  ensureOk(
    await createCharacter(deps, {
      characterId,
      name: 'Alrik',
      campaignId,
      ruleSystemId: 'dsa5',
      actor: owner,
    }),
    "3+4. character created, bound to dsa5's schema",
  );
  for (const [attributeId, value] of [
    ['COU', 14],
    ['SGC', 13],
    ['AGI', 12],
    ['INT', 13],
    ['PER', 6],
  ] as const) {
    ensureOk(
      await setAttribute(deps, { characterId, attributeId, value, actor: owner }),
      `5. attribute ${attributeId} set to ${value}`,
    );
  }

  // 6 + 7: roll a check; it is stored as a character.checkRolled event.
  ensureOk(
    await rollCheck(deps, { characterId, checkId: 'perception', actor: owner }),
    '6+7. perception check rolled and stored as an event',
  );

  // 8: project the event stream into the read-model sheet; read it back.
  await runCharacterSheetProjection({ events, reads, rules: host });
  const sheet = await reads.get<CharacterSheet>(CHARACTER_SHEET, characterId);
  check(sheet !== undefined, '8. character-sheet read model built');
  if (sheet) {
    check(
      sheet.derived.LP === 5 + 14 + 12,
      `8. derived value LP computed via formula = ${sheet.derived.LP}`,
    );
    console.log(`     attributes: ${JSON.stringify(sheet.attributes)}`);
    console.log(`     derived:    ${JSON.stringify(sheet.derived)}`);
    console.log('     history:');
    for (const line of sheet.history) console.log(`       • ${line}`);
  }

  // 10: the AI tool path runs the SAME use case through the SAME PolicyPort as the UI.
  console.log('\n— AI tool path (authorization parity) —');
  const ai = createScriptedAiProvider({
    tool: 'core.character.rollCheck',
    args: { characterId, checkId: 'perception' },
  });
  ensureOk(
    await runAiToolTurn(deps, ai, owner, 'roll my perception check'),
    '10. AI tool ran the use case (authorized owner)',
  );
  const intruder: Actor = { userId: 'user-intruder' as EntityId };
  const aiDenied = await runAiToolTurn(deps, ai, intruder, 'roll it');
  check(!aiDenied.ok, '10. AI tool DENIED for a non-owner');
  const uiDenied = await rollCheck(deps, { characterId, checkId: 'perception', actor: intruder });
  check(!uiDenied.ok, '10. UI path DENIED for the same non-owner (parity: same PolicyPort)');

  // 9: offline edits sync (rebase auto-merge) + a roll carries its result across a sync.
  console.log('\n— Offline sync (rebase convergence + roll carry) —');
  await walkSync();

  console.log('\n✅ Walk complete — all golden-path steps exercised.');
}

/** Step 9: a compact two-client sync demonstration (rigorous asserts live in the tests). */
async function walkSync(): Promise<void> {
  const userA: Actor = { userId: 'user-a' as EntityId };
  const harness = createSyncHarness(dsa5);
  const a = harness.createClient('A');
  const b = harness.createClient('B');
  const charId = 'character-2' as EntityId;

  // Create + fully stat the character on A, then share it to both clients.
  ensureOk(
    await createCharacter(a.deps, {
      characterId: charId,
      name: 'Layariel',
      campaignId: 'campaign-2' as EntityId,
      ruleSystemId: 'dsa5',
      actor: userA,
    }),
    '9. character created on client A',
  );
  for (const [attributeId, value] of [
    ['COU', 13],
    ['SGC', 13],
    ['AGI', 12],
    ['INT', 14],
    ['PER', 5],
  ] as const) {
    ensureOk(
      await setAttribute(a.deps, { characterId: charId, attributeId, value, actor: userA }),
      `9. A sets ${attributeId}`,
    );
  }
  await harness.push(a);
  await harness.pull(a);
  await harness.pull(b);

  // Concurrent offline edits to DIFFERENT attributes → auto-merge on rebase (ADR 0005 §4).
  ensureOk(
    await setAttribute(a.deps, {
      characterId: charId,
      attributeId: 'COU',
      value: 15,
      actor: userA,
    }),
    '9. A (device 1) raises COU to 15 offline',
  );
  ensureOk(
    await setAttribute(b.deps, {
      characterId: charId,
      attributeId: 'AGI',
      value: 11,
      actor: userA,
    }),
    '9. B (device 2) lowers AGI to 11 offline',
  );
  await harness.push(a);
  await harness.push(b);
  await harness.pull(a);
  await harness.pull(b);

  const sheetA = await projectSheet(a, charId);
  const sheetB = await projectSheet(b, charId);
  check(
    sheetA.attributes.COU === 15 && sheetA.attributes.AGI === 11,
    '9. both concurrent edits merged on the cloud',
  );
  check(
    JSON.stringify(sheetA.attributes) === JSON.stringify(sheetB.attributes),
    '9. clients converged to identical state',
  );

  // Roll on A, sync, and confirm B sees the SAME roll (carried, not re-rolled).
  ensureOk(
    await rollCheck(a.deps, { characterId: charId, checkId: 'perception', actor: userA }),
    '9. A rolls a perception check',
  );
  await harness.push(a);
  await harness.pull(b);
  const rolled = b.store.snapshotAll().find((e) => e.type === 'character.checkRolled');
  check(rolled !== undefined, '9. the roll replicated to client B');
  if (rolled) {
    const requestId = (rolled.payload as { result: { requestId: string } }).result.requestId;
    check(
      requestId.startsWith('A-'),
      `9. roll carried A's original result (requestId ${requestId}, not re-rolled)`,
    );
  }
}

/** Rebuild a client's character-sheet read model from its store and return the sheet. */
async function projectSheet(
  client: {
    readonly store: ReturnType<typeof createInMemoryEventStore>;
    readonly deps: CommandDeps;
  },
  characterId: EntityId,
): Promise<CharacterSheet> {
  const reads = createInMemoryReadModelStore();
  await runCharacterSheetProjection({ events: client.store, reads, rules: client.deps.rules });
  const sheet = await reads.get<CharacterSheet>(CHARACTER_SHEET, characterId);
  if (!sheet) throw new Error('projectSheet: sheet not found');
  return sheet;
}

main().catch((error: unknown) => {
  console.error(`\n❌ Walk failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
