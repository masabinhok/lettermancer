import { expect, test, type Page } from '@playwright/test';

async function enterFight(page: Page) {
  await page.goto('/run?starter=apprentice');
  await expect(page.locator('[data-screen="intro"]')).toBeVisible();
  await page.waitForTimeout(350); // the title card ignores an Enter pressed right away
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-screen="doors"]')).toBeVisible();
  await page.keyboard.press('1'); // the first doors are always fights
  await expect(page.locator('[data-screen="combat"]')).toBeVisible();
}

test('first visit offers the tutorial, which teaches by doing', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Learn to play/ })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-screen="prologue"]')).toBeVisible();
  await expect(page.locator('.coach-inner h1')).toHaveText('Strike');
  for (let i = 0; i < 40 && (await page.locator('.coach-inner h1').textContent()) === 'Strike'; i++) {
    const next = page.locator('.enemy.targeted .l.next');
    const k = (await next.count())
      ? await next.textContent()
      : (await page.locator('.enemy .word').first().textContent())!.trim()[0];
    await page.keyboard.press(k!);
  }
  await expect(page.locator('.coach-inner h1')).toHaveText('Choose a target');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-screen="title"]')).toBeVisible();
  expect(errors).toEqual([]);
});

test('typing a word damages the enemy', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await enterFight(page);
  const word = (await page.locator('.enemy .word').first().textContent())!.trim();
  const hp = page.locator('.enemy .hp span').first();
  const before = await hp.textContent();
  for (const ch of word) await page.keyboard.press(ch);
  await expect(hp).not.toHaveText(before!);
  expect(errors).toEqual([]);
});

test('a run in progress survives a reload', async ({ page }) => {
  await enterFight(page);
  const word = (await page.locator('.enemy .word').first().textContent())!.trim();
  await page.keyboard.press(word[0]);
  await page.keyboard.press('Escape'); // pausing saves
  await expect(page.locator('[data-screen="pause"]')).toBeVisible();

  await page.goto('/');
  await expect(page.getByRole('button', { name: /Continue your run/ })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-screen="pause"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.enemy.targeted .l.done')).toHaveText(word[0]);
});

test('the pause menu opens your build', async ({ page }) => {
  await enterFight(page);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Your build' }).click();
  await expect(page.locator('[data-screen="build"]')).toBeVisible();
  await expect(page.locator('[data-screen="build"]')).toContainText('Ember');
});

test('choosing a muse door leads to that muse offering boons', async ({ page }) => {
  await page.goto('/run?starter=apprentice');
  await expect(page.locator('[data-screen="intro"]')).toBeVisible();
  await page.waitForTimeout(350);
  await page.keyboard.press('Enter');
  const muse = (await page.locator('.door .title').first().textContent())!.trim();
  await page.keyboard.press('1');
  await expect(page.locator('[data-screen="combat"]')).toBeVisible();
  // Type until the fight is won.
  for (let i = 0; i < 400; i++) {
    if (await page.locator('[data-screen="reward"]').count()) break;
    const next = page.locator('.enemy.targeted .l.next');
    const k = (await next.count())
      ? await next.textContent()
      : (
          await page
            .locator('.enemy .word')
            .first()
            .textContent()
            .catch(() => '')
        )?.trim()[0];
    if (k) await page.keyboard.press(k);
    else await page.waitForTimeout(50);
  }
  await expect(page.locator('[data-screen="reward"] h1')).toContainText(`${muse} offers a boon`);
});

test('the Scriptorium opens its stations from the keyboard', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-screen="title"]')).toBeVisible();
  await expect(page.getByText('The Archivist')).toBeVisible();
  for (const [key, screen] of [
    ['h', 'codex-of-hands'],
    ['k', 'keepsakes'],
    ['p', 'prophecies'],
    ['c', 'codex'],
  ]) {
    await page.keyboard.press(key);
    await expect(page.locator(`[data-screen="${screen}"]`)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator(`[data-screen="${screen}"]`)).toHaveCount(0);
  }
});

test('a 10-word practice test gives a result with a speed chart', async ({ page }) => {
  await page.goto('/practice');
  await expect(page.locator('[data-screen="practice"]')).toBeVisible();
  await page.getByRole('tab', { name: 'Words' }).click();
  await page.getByRole('button', { name: '10', exact: true }).click();
  for (let i = 0; i < 400 && !(await page.locator('.result').count()); i++) {
    const k = await page.locator('.text .caret').textContent();
    await page.keyboard.press(k!);
  }
  await expect(page.locator('.result .big')).toContainText('wpm');
  await expect(page.locator('.result svg[role="img"]')).toBeVisible();
});
