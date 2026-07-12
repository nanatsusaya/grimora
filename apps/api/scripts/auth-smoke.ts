/**
 * A **live** smoke test of the Supabase auth integration (#120 E2) — the end-to-end verification the
 * unit tests (fake client) deliberately cannot do. It runs the real GoTrue calls (sign-in → refresh →
 * sign-out) against the configured Supabase project and prints only **non-sensitive** status (the user
 * id + outcomes) — never tokens or the password. It is a dev tool, not part of CI (which has no secrets).
 *
 * Run it (loads the git-ignored env, incl. the SMOKE_* dev creds):
 *   bun --env-file apps/api/.env apps/api/scripts/auth-smoke.ts
 *
 * Prerequisite: a pre-confirmed dev test user exists in Supabase, and SMOKE_EMAIL/SMOKE_PASSWORD are set
 * in apps/api/.env (see .env.example). Uses throwaway dev creds only — never real/production data.
 */

import { createSupabaseAuthClient } from '../src/auth/supabase-auth-client';
import { loadApiConfig } from '../src/config';

const config = loadApiConfig(process.env);
const email = process.env.SMOKE_EMAIL;
const password = process.env.SMOKE_PASSWORD;

if (!email || !password) {
  console.error(
    'auth-smoke: set SMOKE_EMAIL and SMOKE_PASSWORD in apps/api/.env (see .env.example).',
  );
  process.exit(1);
}

const auth = createSupabaseAuthClient(config.supabase);

const signIn = await auth.signInWithPassword(email, password);
if (!signIn.ok) {
  console.error('❌ sign-in FAILED:', signIn.error);
  process.exit(1);
}
console.log(
  `✅ sign-in OK — userId=${signIn.value.userId}, access-token expiresIn=${signIn.value.expiresIn}s`,
);

const refreshed = await auth.refresh(signIn.value.refreshToken);
if (!refreshed.ok) {
  console.error('❌ refresh FAILED:', refreshed.error);
  process.exit(1);
}
console.log(`✅ refresh OK — rotated tokens, userId=${refreshed.value.userId}`);

const signedOut = await auth.signOut(refreshed.value.accessToken);
console.log(
  signedOut.ok ? '✅ sign-out OK' : `⚠️  sign-out returned: ${JSON.stringify(signedOut.error)}`,
);

console.log('\n🎉 auth-smoke: the Supabase auth integration works end-to-end.');
