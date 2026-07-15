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

  // The sheet appears with the created name and the DSA5 derived values, all eight attributes seeded to
  // 12: LP = 5 + 2×CON(12) = 29 (human LE base + 2×CON, #223), DODGE = round(AGI/2) = 6,
  // INI = round((COU+AGI)/2) = 12 — each computed through the core interpreter from the plugin's AST.
  await expect(page.getByTestId('character-name')).toHaveText('Brumil');
  await expect(page.getByTestId('derived-LP')).toHaveText('29');
  await expect(page.getByTestId('derived-DODGE')).toHaveText('6');
  await expect(page.getByTestId('derived-INI')).toHaveText('12');

  // Edit a trait → command → projection → UI re-renders (ADR 0012 §3 one-way reactivity).
  await page.getByLabel('COU').fill('14');
  // INI depends on COU, so it recomputes: round((14 + 12) / 2) = 13.
  await expect(page.getByTestId('derived-INI')).toHaveText('13');
  // ...but LP must NOT move: it depends on CON alone. This is the #223 regression guard — the old,
  // wrong formula (5 + COU + AGI) would show 31 here, so this assertion fails loudly if it ever returns.
  await expect(page.getByTestId('derived-LP')).toHaveText('29');

  // Editing CON is what actually drives LP: 5 + 2×14 = 33.
  await page.getByLabel('CON').fill('14');
  await expect(page.getByTestId('derived-LP')).toHaveText('33');

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
  await expect(page.getByLabel('CON')).toHaveValue('14');
  await expect(page.getByTestId('derived-LP')).toHaveText('33');
});

test('the character picker lists multiple characters and switches between them (#107 slice 3c)', async ({
  page,
}) => {
  await page.goto('/');

  // First character.
  await page.getByLabel('Name').fill('Brumil');
  await page.getByRole('button', { name: 'Create character' }).click();
  await expect(page.getByTestId('character-name')).toHaveText('Brumil');

  // The picker now lists the character (this is the surface that also reveals a pulled cross-device one).
  const picker = page.getByTestId('character-picker');
  await expect(picker).toBeVisible();
  await expect(picker.getByRole('button', { name: /Brumil/ })).toBeVisible();

  // Start + create a second character.
  await page.getByRole('button', { name: 'New character' }).click();
  await page.getByLabel('Name').fill('Gerbald');
  await page.getByRole('button', { name: 'Create character' }).click();
  await expect(page.getByTestId('character-name')).toHaveText('Gerbald');

  // Both characters are now offerable in the picker; open the first one through it.
  await expect(picker.getByRole('button', { name: /Gerbald/ })).toBeVisible();
  await picker.getByRole('button', { name: /Brumil/ }).click();
  await expect(page.getByTestId('character-name')).toHaveText('Brumil');

  // The opened character persists across a reload (the picker set the localStorage current pointer).
  await page.reload();
  await expect(page.getByTestId('character-name')).toHaveText('Brumil');
});
