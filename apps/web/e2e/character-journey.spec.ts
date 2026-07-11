/**
 * Golden-journey smoke for the #105-D character sheet — the milestone test: Grimora is a runnable browser
 * app. It drives the **real UI** (no test-only hooks) through the full offline vertical slice:
 * create a character → the DSA5 derived value computes → edit a trait and watch it recompute (ADR 0012 §3
 * one-way reactivity) → roll a check → **reload** and confirm everything persisted via the OPFS stores
 * (#105-B) under the §13 device identity.
 *
 * Runs in headless Chromium against the Vite dev server (see `playwright.config.ts`); each test gets an
 * isolated browser context, so OPFS/localStorage start empty.
 */
import { expect, test } from '@playwright/test';

test('create a character, edit a trait, roll a check — all persists across a reload', async ({
  page,
}) => {
  await page.goto('/');

  // Cold start: the create form is shown once the stores are ready.
  await page.getByLabel('Name').fill('Brumil');
  await page.getByRole('button', { name: 'Create character' }).click();

  // The sheet appears with the created name and the DSA5 derived LP = 5 + COU(12) + AGI(12) = 29.
  await expect(page.getByTestId('character-name')).toHaveText('Brumil');
  await expect(page.getByTestId('derived-LP')).toHaveText('29');

  // Edit a trait → command → projection → UI re-renders with the recomputed derived value (5 + 14 + 12 = 31).
  await page.getByLabel('COU').fill('14');
  await expect(page.getByTestId('derived-LP')).toHaveText('31');

  // Roll a check → a new history line is appended.
  const historyLines = page.getByTestId('history').locator('li');
  const before = await historyLines.count();
  await page.getByRole('button', { name: 'Roll perception' }).click();
  await expect(historyLines).toHaveCount(before + 1);

  // Reload: a fresh JS context, but OPFS + the localStorage character pointer survive — the same sheet,
  // with the edited trait, must reappear (the #105-B persistence proof, now through the real UI).
  await page.reload();
  await expect(page.getByTestId('character-name')).toHaveText('Brumil');
  await expect(page.getByLabel('COU')).toHaveValue('14');
  await expect(page.getByTestId('derived-LP')).toHaveText('31');
});
