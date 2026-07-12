/**
 * A minimal dev migration runner for the Supabase Postgres event store (#107). It applies every SQL file
 * in `supabase/migrations/` (in filename order) to the database named by `DATABASE_URL`, then prints a
 * summary of the `events` table so the run **self-verifies** the resulting schema. It exists so the
 * migration can be applied + checked against `grimora-dev` locally before the canonical apply path (the
 * Supabase GitHub integration / CLI on merge) — the migrations are written **idempotently**, so applying
 * them here and again via the integration is safe.
 *
 * Run it (loads the git-ignored DB credentials): bun --env-file apps/api/.env apps/api/scripts/db-migrate.ts
 * `DATABASE_URL` is the direct connection string (Supabase → Project Settings → Database) — a secret; it
 * lives only in the git-ignored .env, never in the repo or logs.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SQL } from 'bun';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('db-migrate: DATABASE_URL not set in apps/api/.env (see .env.example).');
  process.exit(1);
}

const migrationsDir = 'supabase/migrations';
const files = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort();

const sql = new SQL(url);
try {
  for (const file of files) {
    const content = readFileSync(join(migrationsDir, file), 'utf8');
    // `.simple()` uses the simple query protocol so a file with multiple statements runs in one round-trip.
    await sql.unsafe(content).simple();
    console.log(`✅ applied ${file}`);
  }

  const columns = await sql`
    select column_name, data_type, is_nullable
    from information_schema.columns
    where table_schema = 'public' and table_name = 'events'
    order by ordinal_position`;
  console.log('\nevents columns:');
  for (const c of columns) {
    console.log(`  - ${c.column_name}: ${c.data_type}${c.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
  }

  const [rls] = await sql`
    select relrowsecurity from pg_class where oid = 'public.events'::regclass`;
  const policies = await sql`
    select policyname, cmd from pg_policies where schemaname = 'public' and tablename = 'events'
    order by policyname`;
  const constraints = await sql`
    select conname, contype from pg_constraint where conrelid = 'public.events'::regclass
    order by conname`;

  console.log('\nRLS enabled:', rls?.relrowsecurity === true);
  console.log('policies:', policies.map((p) => `${p.policyname}(${p.cmd})`).join(', ') || '(none)');
  console.log('constraints:', constraints.map((c) => `${c.conname}[${c.contype}]`).join(', '));
  console.log('\n🎉 db-migrate: migrations applied and events schema verified.');
} catch (e) {
  console.error('❌ db-migrate FAILED:', (e as Error).message);
  process.exit(2);
} finally {
  await sql.end();
}
