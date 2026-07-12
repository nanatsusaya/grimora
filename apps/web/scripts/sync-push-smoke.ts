/**
 * A **live** client-side smoke of the #107 slice-3a push path — the verification the unit tests (fakes)
 * cannot do: it drives the **real** `createHttpSyncPort` + `createSyncService` over real HTTP against a
 * running `apps/api`, which writes to **real** Postgres (grimora-dev). It signs in through the `apps/api`
 * auth proxy to get an access token, pushes a couple of fake events via the client sync service, asserts
 * they landed in the cloud attributed to the account, checks idempotency on a re-push, then **cleans up**
 * its own rows. Prints only non-sensitive status; a dev tool, not in CI.
 *
 * Run (with apps/api already listening on API_BASE):
 *   PORT=3001 bun --env-file apps/api/.env apps/api/src/server.ts   # in another shell
 *   bun --env-file apps/api/.env apps/web/scripts/sync-push-smoke.ts
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
    'sync-push-smoke: set SMOKE_EMAIL, SMOKE_PASSWORD and DATABASE_URL in apps/api/.env',
  );
  process.exit(1);
}

// 1) Sign in through the apps/api auth proxy → the same access token the browser adapter would hold.
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

// 2) A local event store with two fake events on one fresh stream (obvious fakes — agent guardrails).
const aggregateId = crypto.randomUUID() as EntityId;
const store = createInMemoryEventStore();
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
await store.append(aggregateId, 0, [mkEvent(1)]);
await store.append(aggregateId, 1, [mkEvent(2)]);

// 3) The REAL client stack: HTTP sync port (token from the sign-in) + push orchestration + a checkpoint.
const cursors = new Map<string, number>();
const service = createSyncService({
  syncPort: createHttpSyncPort({
    getAccessToken: () => accessToken,
    basePath: `${apiBase}/api/v1/sync`,
  }),
  events: store,
  checkpoints: {
    async getCheckpoint(c) {
      return cursors.get(c) ?? 0;
    },
    async setCheckpoint(c, p) {
      cursors.set(c, p);
    },
  },
});

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
  // First run: both events new → accepted, checkpoint advances to local position 2.
  const first = await service.pushPending();
  check('push run 1 succeeds', first.ok);
  if (first.ok) {
    check('run 1: 2 accepted', first.value.accepted === 2);
    check('run 1: checkpoint advanced to 2', first.value.checkpoint === 2);
  }

  // The rows really landed in the cloud, attributed to the signed-in account (actor-binding, ADR 0024 §2).
  const sql = new SQL(databaseUrl);
  const rows = (await sql`
    select count(*)::int as n from events
    where aggregate_id = ${aggregateId} and owner_id = ${userId}`) as { n: number }[];
  await sql.end();
  check('both events persisted in cloud under the account owner_id', rows[0]?.n === 2);

  // Second run with the checkpoint reset → the same ids re-sent → all duplicate (idempotent, ADR 0005 §4).
  cursors.set('sync:push', 0);
  const second = await service.pushPending();
  check('push run 2 succeeds', second.ok);
  if (second.ok) {
    check('run 2: 2 duplicates (idempotent re-push)', second.value.duplicates === 2);
    check('run 2: 0 accepted', second.value.accepted === 0);
  }
} finally {
  await cleanup();
  console.log('🧹 cleaned up test rows');
}

console.log(
  failed
    ? '\n❌ sync-push-smoke: FAILED'
    : '\n🎉 sync-push-smoke: client push path works end-to-end.',
);
process.exit(failed ? 2 : 0);
