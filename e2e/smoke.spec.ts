import { expect, test } from '@playwright/test';

test('start a run from the title and land a hit', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await expect(page.locator('[data-screen="title"]')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-screen="intro"]')).toBeVisible();
  await page.waitForTimeout(350); // the title card ignores the Enter that opened it
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-screen="combat"]')).toBeVisible();

  const word = (await page.locator('.enemy .word').first().textContent())!.trim();
  const hp = page.locator('.enemy .hp span').first();
  const before = await hp.textContent();
  for (const ch of word) await page.keyboard.press(ch);
  await expect(hp).not.toHaveText(before!);
  expect(errors).toEqual([]);
});

test('a run in progress survives a reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-screen="title"]')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-screen="intro"]')).toBeVisible();
  await page.waitForTimeout(350);
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-screen="combat"]')).toBeVisible();
  const word = (await page.locator('.enemy .word').first().textContent())!.trim();
  await page.keyboard.press(word[0]);
  await page.keyboard.press('Escape'); // pause saves
  await expect(page.locator('[data-screen="pause"]')).toBeVisible();

  await page.goto('/');
  await expect(page.getByRole('button', { name: /Continue your run/ })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-screen="pause"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.enemy.targeted .l.done')).toHaveText(word[0]);
});
