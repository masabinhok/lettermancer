import { expect, test } from '@playwright/test';

test('start a run and land a hit', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await expect(page.locator('.screen.menu')).toBeVisible();
  await page.keyboard.press('Enter'); // menu -> act banner
  await expect(page.locator('.screen.banner')).toBeVisible();
  await page.waitForTimeout(300); // the banner ignores the Enter that opened it
  await page.keyboard.press('Enter'); // banner -> first fight
  const word = page.locator('.enemy .word').first();
  await expect(word).toBeVisible();
  const text = (await word.textContent())!;
  const hpBefore = await page.locator('.enemy .enemy-hp span').first().textContent();
  for (const ch of text) await page.keyboard.press(ch);
  await expect(page.locator('.enemy .enemy-hp span').first()).not.toHaveText(hpBefore!);
  expect(errors).toEqual([]);
});
