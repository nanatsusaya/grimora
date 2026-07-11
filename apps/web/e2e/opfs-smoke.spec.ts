/**
 * OPFS browser smoke (#105-C, closing the #105-B verification IOU): proves the browser OPFS event store
 * actually **persists across a page reload**, and that the ADR 0012 §13 implicit device identity is
 * **reused** (not regenerated) across that reload. It drives the dev-only `window.__grimoraOpfsSmoke`
 * surface (see `src/opfs-smoke.ts`): read the identity, append a uniquely-nonce'd event, reload the page
 * (a fresh JS context, but the same-origin OPFS storage + `localStorage` identity survive), then read the
 * log back and assert this run's event is still there under the same identity.
 *
 * Runs in headless Chromium against the Vite dev server (see `playwright.config.ts`). The store lives in a
 * Web Worker because the OPFS SAHPool VFS is worker-only; this test is the end-to-end proof that the
 * worker-backed `EventStorePort` proxy (`src/store/`) is durable.
 */
import { expect, test } from '@playwright/test';

/**
 * Mirror of `OpfsSmokeApi` in `src/opfs-smoke.ts`, declared on `window` so the `page.evaluate` bodies
 * (which run **in the browser**, not this Node scope) are typed. The bodies must be self-contained
 * closures — Playwright serialises them across to the page — so each reads `window.__grimoraOpfsSmoke`
 * directly rather than via a shared Node-side helper.
 */
declare global {
  interface Window {
    __grimoraOpfsSmoke: {
      identity(): string;
      seed(): Promise<string>;
      readAll(): Promise<{ type: string; nonce: string }[]>;
    };
  }
}

test('OPFS event store persists an appended event across a page reload, under a stable identity', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(() => '__grimoraOpfsSmoke' in window);

  const identityBefore = await page.evaluate(() => window.__grimoraOpfsSmoke.identity());
  expect(identityBefore).toBeTruthy();

  const nonce = await page.evaluate(() => window.__grimoraOpfsSmoke.seed());
  expect(nonce).toBeTruthy();

  await page.reload();
  await page.waitForFunction(() => '__grimoraOpfsSmoke' in window);

  // ADR 0012 §13: the implicit device identity is reused across a cold reload, not minted anew.
  const identityAfter = await page.evaluate(() => window.__grimoraOpfsSmoke.identity());
  expect(identityAfter).toBe(identityBefore);

  const events = await page.evaluate(() => window.__grimoraOpfsSmoke.readAll());
  // The event appended before the reload must still be in the OPFS-persisted log after it.
  expect(events.some((event) => event.nonce === nonce)).toBe(true);
});
