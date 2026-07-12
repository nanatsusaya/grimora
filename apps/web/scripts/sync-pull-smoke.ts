/**
 * A **live** client-side smoke of the #107 slice-3b pull path — the round-trip the unit tests (fakes)
 * cannot prove: two independent local stores ("device A" and "device B") of the **same account**, talking
 * to a running `apps/api` → real Postgres (grimora-dev). Device A pushes events; device B **pulls** them
 * and applies them to its own local log via the real `createSyncService.pullPending` + `replicate`. Then it
 * asserts device B now holds device A's events (cross-device view), checks pull idempotency, and cleans up.
 *
 * Run (with apps/api already listening on API_BASE):
 *   PORT=3001 bun --env-file apps/api/.env apps/api/src/server.ts   # in another shell
 *   bun --env-file apps/api/.env apps/web/scripts/sync-pull-smoke.ts
 * Needs the pre-confirmed dev user (SMOKE_EMAIL/SMOKE_PASSWORD) + DATABASE_URL in the git-ignored .env.
 */

import { createInMemoryEventStore } from '@grimora/core-domain/testing';
import { createHttpSyncPort, createSyncService } from '@grimora/offline-sync';
import type { EntityId, IsoTimestamp } from '@grimora/shared-types';
import { SQL } from 'bun';

const apiBase = process.env.API_BASE ?? 'http://localhost:3001';
const email = process.env.SMOKE_EMAIL;
const password = process.env.SMOKE_PASSWORD;
const databaseUrl = process.env.DATABASE_URL;
if (!email || !password || !databaseUrl) {
  console.error(
    'sync-pull-smoke: set SMOKE_EMAIL, SMOKE_PASSWORD and DATABASE_URL in apps/api/.env',
  );
  process.exit(1);
}

// Sign in through the apps/api proxy → the access token both "devices" use (same account).
const signInRes = await fetch(`${apiBase}/api/v1/auth/sign-in`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
if (!signInRes.ok) {
  console.error(
    `sign-in via apps/api failed: ${signInRes.status} (is apps/api running on ${apiBase}?)`,
  );
  process.exit(1);
}
const { accessToken, userId } = (await signInRes.json()) as { accessToken: string; userId: string };
console.log(`✅ signed in via apps/api — account ${userId}`);

const syncPort = createHttpSyncPort({
  getAccessToken: () => accessToken,
  basePath: `${apiBase}/api/v1/sync`,
});
const aggregateId = crypto.randomUUID() as EntityId;
const mkEvent = (version: number) => ({
  id: crypto.randomUUID() as EntityId,
  aggregateId,
  aggregateType: 'smoke',
  type: 'smoke.happened',
  version,
  schemaVersion: 1,
  occurredAt: new Date().toISOString() as IsoTimestamp,
  payload: { n: version },
});
const eventOne = mkEvent(1);
const eventTwo = mkEvent(2);

let failed = false;
const check = (label: string, cond: boolean) => {
  console.log(`${cond ? '✅' : '❌'} ${label}`);
  if (!cond) failed = true;
};

const cleanup = async () => {
  const sql = new SQL(databaseUrl);
  await sql`delete from events where aggregate_id = ${aggregateId}`;
  await sql.end();
};

try {
  // Device A: a local store with the two events, pushed to the cloud.
  const deviceA = createInMemoryEventStore();
  await deviceA.append(aggregateId, 0, [eventOne]);
  await deviceA.append(aggregateId, 1, [eventTwo]);
  const cursorsA = new Map<string, number>();
  const serviceA = createSyncService({
    syncPort,
    events: deviceA,
    checkpoints: {
      async getCheckpoint(c) {
        return cursorsA.get(c) ?? 0;
      },
      async setCheckpoint(c, p) {
        cursorsA.set(c, p);
      },
    },
  });
  const push = await serviceA.pushPending();
  check('device A push succeeds (2 accepted)', push.ok && push.value.accepted === 2);
  // The cloud position just before our first event — so device B's pull returns our two (and nothing older).
  const firstPosition = push.ok && push.value.checkpoint > 0 ? push.value.checkpoint - 1 : 0;

  // Device B: a fresh, empty local store of the SAME account. It pulls + applies.
  const deviceB = createInMemoryEventStore();
  const cursorsB = new Map<string, number>([['sync:pull', firstPosition]]);
  const serviceB = createSyncService({
    syncPort,
    events: deviceB,
    checkpoints: {
      async getCheckpoint(c) {
        return cursorsB.get(c) ?? 0;
      },
      async setCheckpoint(c, p) {
        cursorsB.set(c, p);
      },
    },
  });

  const pull = await serviceB.pullPending();
  check('device B pull succeeds', pull.ok);

  // Device B's local log now contains device A's two events (cross-device view).
  const appliedIds = new Set((await deviceB.snapshotAll()).map((e) => e.id));
  check('device B applied device A event #1', appliedIds.has(eventOne.id));
  check('device B applied device A event #2', appliedIds.has(eventTwo.id));

  // Pull idempotency: re-pull the same page (reset B's cursor) — replicate must not duplicate.
  cursorsB.set('sync:pull', firstPosition);
  await serviceB.pullPending();
  const countOurs = (await deviceB.snapshotAll()).filter(
    (e) => e.aggregateId === aggregateId,
  ).length;
  check('re-pull does not duplicate (still exactly 2 of ours)', countOurs === 2);
} finally {
  await cleanup();
  console.log('🧹 cleaned up test rows');
}

console.log(
  failed
    ? '\n❌ sync-pull-smoke: FAILED'
    : '\n🎉 sync-pull-smoke: cross-device pull works end-to-end.',
);
process.exit(failed ? 2 : 0);
