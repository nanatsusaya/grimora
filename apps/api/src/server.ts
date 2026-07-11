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
import { createApiComposition } from './composition/composition-root';

const app = createApp(createApiComposition());

/**
 * The listen port. Read straight from the environment for the scaffold; in the real build config/secrets
 * are injected at the composition root via `SecretsPort` (ADR 0010 §4), never read ad hoc.
 */
const port = Number(process.env.PORT ?? 3001);

export default { port, fetch: app.fetch };
