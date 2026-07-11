/**
 * E2E for the dev-only "Reset all" action (issue #133): it must wipe *all* local state and return the app
 * to a genuine first-launch state. Create a character, click "Reset all", and after the reload the create
 * form is back with no character — proving OPFS + localStorage were actually cleared, not just the shell
 * caches. The button is dev-only (`import.meta.env.DEV`), which is true against the Vite dev server here.
 *
 * Runs in headless Chromium; each test gets an isolated browser context, so it starts from empty storage.
 */
import { expect, test } from '@playwright/test';

test('Reset all wipes the character and returns to a first-launch state', async ({ page }) => {
  await page.goto('/');

  // Create a character so there is persisted state (OPFS event log + read model + localStorage pointers).
  await page.getByLabel('Name').fill('Gorbas');
  await page.getByRole('button', { name: 'Create character' }).click();
  await expect(page.getByTestId('character-name')).toHaveText('Gorbas');

  // Reset all → wipes OPFS + localStorage + shell caches, then reloads.
  await page.getByRole('button', { name: 'Reset all (dev)' }).click();

  // Back to a first launch: the create form is shown and no character sheet exists.
  await expect(page.getByRole('button', { name: 'Create character' })).toBeVisible();
  await expect(page.getByTestId('character-sheet')).toHaveCount(0);
});
