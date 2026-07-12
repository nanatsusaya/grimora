/**
 * The `apps/api` server entry point (ADR 0027 §5).
 *
 * Builds the composition and the HTTP app, then exports Bun's server shape (`{ port, fetch }`) — Bun is
 * the canonical dev + prod runtime (ADR 0027 R4). The app itself (`app.fetch`) is **node-compatible**: no
 * bun-only APIs are used here or in the routes, so the same code runs under `@hono/node-server` in the
 * ADR 0014 §3 container. Only this bootstrap line differs per runtime.
 *
 * Run locally: `bun run dev` (watch) or `bun run start`.
 */

import { createApp } from './app';
import { createSupabaseAuthClient } from './auth/supabase-auth-client';
import { createApiComposition } from './composition/composition-root';
import { loadApiConfig } from './config';

/**
 * The composition-root edge: read + validate config from the environment **once, here** (ADR 0010 §4 —
 * secrets/config only at the composition root), then wire the real Supabase auth client. A missing
 * `PROJECT_URL`/`PUBLISHABLE_KEY` fails fast at startup rather than surfacing as a confusing 500 later.
 */
const config = loadApiConfig(process.env);
const app = createApp(
  createApiComposition({
    auth: createSupabaseAuthClient(config.supabase),
    cookie: config.cookie,
  }),
);

/** The listen port (env-overridable; defaults to 3001 for local dev). */
const port = Number(process.env.PORT ?? 3001);

export default { port, fetch: app.fetch };
