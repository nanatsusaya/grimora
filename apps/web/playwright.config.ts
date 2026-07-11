/**
 * Playwright config for `apps/web` (issue #105-C, pulled forward from #105-D per ADR 0017's E2E layer,
 * which was deferred only until `apps/web` existed). Scoped, for now, to the single OPFS browser smoke
 * (`e2e/opfs-smoke.spec.ts`) — the first real in-browser verification of the #105-B OPFS stores. It runs
 * a Vite dev server on a fixed port and drives headless Chromium against it.
 */
import { defineConfig } from '@playwright/test';

/** Fixed, uncommon port so the E2E dev server does not collide with a hand-started `bun run dev`. */
const PORT = 5179;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `bunx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
