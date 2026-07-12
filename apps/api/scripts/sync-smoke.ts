/**
 * A **live** end-to-end smoke of the sync path (#107) — the verification the unit tests (fakes) cannot do:
 * a real Supabase login JWT → **real JWKS verification** → **real Postgres** push/pull/dedup/conflict.
 * It exercises the token verifier + the pg sync store directly (the HTTP routes are unit-tested), then
 * **cleans up** its own test rows. Prints only non-sensitive status; a dev tool, not in CI.
 *
 * Run: bun --env-file apps/api/.env apps/api/scripts/sync-smoke.ts
 * Needs the pre-confirmed dev user (SMOKE_EMAIL/SMOKE_PASSWORD) + DATABASE_URL in the git-ignored .env.
 */

import { SQL } from 'bun';
import { createJwksTokenVerifier } from '../src/auth/jwt';
import { loadApiConfig } from '../src/config';
import { createPgSyncStore } from '../src/sync/pg-sync-store';

const config = loadApiConfig(process.env);
const email = process.env.SMOKE_EMAIL;
const password = process.env.SMOKE_PASSWORD;
if (!email || !password) {
  console.error('sync-smoke: set SMOKE_EMAIL and SMOKE_PASSWORD in apps/api/.env');
  process.exit(1);
}

// 1) Real login → access token.
const tokenRes = await fetch(`${config.supabase.url}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: config.supabase.publishableKey, 'content-type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
if (!tokenRes.ok) {
  console.error('sign-in failed:', tokenRes.status);
  process.exit(1);
}
const { access_token } = (await tokenRes.json()) as { access_token: string };

// 2) Real JWKS verification → owner id (proves the ES256/JWKS path).
const verified = await createJwksTokenVerifier(config.supabase).verify(access_token);
if (!verified.ok) {
  console.error('❌ JWKS verify FAILED:', verified.error);
  process.exit(1);
}
const ownerId = verified.value.accountId;
console.log(`✅ JWKS verify OK — owner ${ownerId}`);

// 3) Real Postgres push/pull. Fresh uuids so the run never collides with a previous one.
const store = createPgSyncStore(config.databaseUrl);
const aggregateId = crypto.randomUUID();
const event = {
  id: crypto.randomUUID(),
  aggregateId,
  aggregateType: 'smoke',
  type: 'smoke.happened',
  version: 1,
  schemaVersion: 1,
  occurredAt: new Date().toISOString(),
  payload: { n: 1 },
} as const;

const cleanup = async () => {
  const sql = new SQL(config.databaseUrl);
  await sql`delete from events where aggregate_id = ${aggregateId}`;
  await sql.end();
  await store.close();
};

try {
  const accepted = await store.push(ownerId, [event]);
  const duplicate = await store.push(ownerId, [event]);
  const conflict = await store.push(ownerId, [{ ...event, id: crypto.randomUUID() }]);
  const page = await store.pull(ownerId, 0);

  const check = (label: string, cond: boolean) => {
    console.log(`${cond ? '✅' : '❌'} ${label}`);
    if (!cond) process.exitCode = 2;
  };
  check(`push accepted (position ${accepted[0]?.status === 'accepted' ? accepted[0].position : '?'})`,
    accepted[0]?.status === 'accepted');
  check('re-push same id → duplicate (idempotent)', duplicate[0]?.status === 'duplicate');
  check(
    'push same (aggregate, version), new id → conflict currentVersion=1',
    conflict[0]?.status === 'conflict' && conflict[0].currentVersion === 1,
  );
  check('pull returns the pushed event for this owner', page.events.some((e) => e.id === event.id));
} finally {
  await cleanup();
  console.log('🧹 cleaned up test rows');
}

console.log(process.exitCode ? '\n❌ sync-smoke: FAILED' : '\n🎉 sync-smoke: sync path works end-to-end.');
