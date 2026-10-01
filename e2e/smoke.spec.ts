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

test('the daily rite is one attempt a day; the weekly can be played again', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-screen="title"]')).toBeVisible();
  await page.keyboard.press('d');
  await expect(page.locator('[data-screen="intro"]')).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Daily rite/ })).toBeDisabled();
  await page.goto('/run?mode=daily');
  await expect(page.locator('[data-screen="refused"]')).toContainText('already played');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-screen="title"]')).toBeVisible();
  await page.keyboard.press('w');
  await expect(page.locator('[data-screen="intro"]')).toBeVisible();
});

test('racing your best practice test shows its ghost', async ({ page }) => {
  await page.goto('/practice');
  await page.getByRole('tab', { name: 'Words' }).click();
  await page.getByRole('button', { name: '10', exact: true }).click();
  for (let i = 0; i < 400 && !(await page.locator('.result').count()); i++)
    await page.keyboard.press((await page.locator('.text .caret').textContent())!);
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: /^ghost \d+/ }).click();
  await expect(page.locator('.ghost-name')).toContainText('Your best');
  for (let i = 0; i < 3; i++) await page.keyboard.press((await page.locator('.text .caret').textContent())!);
  await expect(page.locator('.text .ghost')).toHaveCount(1);
});

test('the leaderboards open from the Scriptorium', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-screen="title"]')).toBeVisible();
  await page.keyboard.press('l');
  await expect(page.locator('[data-screen="leaderboards"]')).toBeVisible();
  await page.keyboard.press('4');
  await expect(page.getByRole('tab', { name: /Heat/ })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-screen="title"]')).toBeVisible();
});

test('progress saved under the old name carries over', async ({ page }) => {
  // A returning player: storage holds only the old keys when the new build first loads.
  await page.addInitScript(() => {
    if (localStorage.getItem('lettermancer.meta.v1') === null)
      localStorage.setItem('keycraft.meta.v1', JSON.stringify({ prologueDone: true, runs: 2, ink: 77 }));
  });
  await page.goto('/');
  await expect(page.locator('[data-screen="title"]')).toBeVisible();
  await expect(page.locator('.purse')).toContainText('77');
});

test('power pips sit on their own keys, whatever their rarity', async ({ page }) => {
  // A run that starts with an Epic Frost on S (as a keepsake would give), next to the Apprentice's Ember on E.
  await page.addInitScript(() => {
    if (localStorage.getItem('lettermancer.run.v1')) return;
    const bonuses = {
      maxHp: 0,
      startCoins: 0,
      startCombo: 0,
      extraChoices: 0,
      rerolls: 0,
      secondWind: 0,
      inkBonus: 0,
      firstBoonRarity: 0,
      startShield: 0,
      graceMs: 0,
      coinMult: 1,
      healAfterFight: 0,
      startBoon: { key: 's', mod: 'frost', rarity: 2 },
    };
    const config = {
      rules: 2,
      seed: 7,
      starter: 'apprentice',
      weak: {},
      oaths: {},
      bonuses,
      mode: 'standard',
      gentle: false,
    };
    localStorage.setItem('lettermancer.meta.v1', JSON.stringify({ prologueDone: true, runs: 1 }));
    localStorage.setItem('lettermancer.run.v1', JSON.stringify({ config, actions: [] }));
  });
  await page.goto('/run?resume');
  await expect(page.locator('[data-screen="doors"]')).toBeVisible();
  await page.keyboard.press('1');
  await expect(page.locator('[data-screen="combat"]')).toBeVisible();
  const misplaced = await page.evaluate(() =>
    [...document.querySelectorAll('.key')].flatMap((key) => {
      const k = key.getBoundingClientRect();
      return [...key.querySelectorAll('.pip')]
        .filter((pip) => {
          const p = pip.getBoundingClientRect();
          return p.left < k.left || p.right > k.right;
        })
        .map(() => key.getAttribute('data-key'));
    }),
  );
  expect(await page.locator('[data-key="s"] .pip').count()).toBe(1);
  expect(misplaced).toEqual([]);
});
