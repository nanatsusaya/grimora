/**
 * Live auth-journey E2E (#120 E3b) — the real in-browser proof the adapter unit tests (E3a, fake `fetch`)
 * cannot give: sign in through the UI → the `HttpOnly` refresh cookie persists the session across a full
 * reload (ADR 0012 §5, via `restore()`) → sign out returns to the login form.
 *
 * **Gated, not in CI:** it needs a running `apps/api` wired to a real Supabase project + a pre-confirmed
 * dev user — none of which CI has (no secrets). It is skipped unless `AUTH_E2E=1` and `SMOKE_EMAIL`/
 * `SMOKE_PASSWORD` are set, and requires `apps/api` running on the Vite proxy target (default `:3001`).
 * Run locally:
 *   1) terminal A:  cd apps/api && bun --env-file .env --watch src/server.ts   (ensure PORT=3001)
 *   2) terminal B:  AUTH_E2E=1 SMOKE_EMAIL=… SMOKE_PASSWORD=… bunx playwright test auth-journey
 */

import { expect, test } from '@playwright/test';

const email = process.env.SMOKE_EMAIL;
const password = process.env.SMOKE_PASSWORD;
const enabled = process.env.AUTH_E2E === '1' && !!email && !!password;

test.describe('auth login journey (live apps/api + Supabase)', () => {
  test.skip(
    !enabled,
    'Set AUTH_E2E=1 + SMOKE_EMAIL/SMOKE_PASSWORD and run apps/api locally (needs Supabase).',
  );

  test('sign in → session persists across a reload → sign out', async ({ page }) => {
    await page.goto('/');

    // Cold start: not signed in → the login form is shown.
    await expect(page.getByTestId('auth-login')).toBeVisible();
    await page.getByLabel('Email').fill(email as string);
    await page.getByLabel('Password').fill(password as string);
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Signed in — the proxy set the refresh cookie and returned the access token.
    await expect(page.getByTestId('auth-signed-in')).toBeVisible();

    // #120 E4: the first login recorded the device → account binding (ADR 0012 §13) in localStorage.
    const rawBinding = await page.evaluate(() => localStorage.getItem('grimora.account-binding'));
    expect(rawBinding).not.toBeNull();
    const binding = JSON.parse(rawBinding as string) as { deviceId: string; accountId: string };
    expect(binding.accountId.length).toBeGreaterThan(0);
    expect(binding.deviceId.length).toBeGreaterThan(0);

    // Reload drops the in-memory access token, but the HttpOnly refresh cookie survives → restore() from
    // the composition root re-establishes the session without re-login (the ADR 0012 §5 proof).
    await page.reload();
    await expect(page.getByTestId('auth-signed-in')).toBeVisible();

    // Sign out clears the cookie + in-memory session → back to the login form.
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByTestId('auth-login')).toBeVisible();
  });
});
