import { expect, test, type Page } from '@playwright/test';
import { loadEngine } from './engine';

/** The act's title card: once its title has typed in (instantly with reduced motion), Enter begins the act. */
async function passIntro(page: Page) {
  await expect(page.locator('[data-screen="intro"].ready')).toBeVisible();
  await page.keyboard.press('Enter');
}

/** Doors rise one by one; once they're all up, the first press looks closer and Enter steps through. */
async function goThroughDoor(page: Page, n = 1) {
  await expect(page.locator('[data-screen="doors"] .hint')).toContainText('look closer');
  await page.keyboard.press(String(n));
  await page.keyboard.press('Enter');
}

async function enterFight(page: Page) {
  await page.goto('/run?starter=apprentice');
  await passIntro(page);
  await expect(page.locator('[data-screen="doors"]')).toBeVisible();
  await goThroughDoor(page); // the first doors are always fights
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
  await passIntro(page);
  await expect(page.locator('[data-screen="doors"]')).toBeVisible();
  const muse = (await page.locator('.door .title').first().textContent())!.trim();
  await goThroughDoor(page);
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
  await expect(page.locator('[data-screen="reward"] h1')).toHaveText(muse);
  // Offers slide in, then the first one can be taken.
  await expect(page.locator('[data-screen="reward"] .plaque.shown')).toHaveCount(3);
  await expect(page.locator('[data-screen="reward"] .actions.shown')).toBeVisible();
  await page.keyboard.press('1');
  await expect(page.locator('[data-screen="install"], [data-screen="doors"]').first()).toBeVisible();
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
      rules: 3, // RULES_VERSION in packages/engine/src/machine.ts
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
  await goThroughDoor(page);
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

test('with reduced motion, damage numbers still show (they hold still instead)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await enterFight(page);
  const word = (await page.locator('.enemy .word').first().textContent())!.trim();
  for (const ch of word) await page.keyboard.press(ch);
  const num = page.locator('.float-text').first();
  await expect(num).toBeVisible();
  expect(Number(await num.evaluate((el) => getComputedStyle(el).opacity))).toBeGreaterThan(0.9);
});

test('in the shop, a bought item leaves the shelf and its number does nothing', async ({ page }) => {
  // Load a bot-played run at its first shop, with plenty of coins.
  const { makeRng, newRunConfig, playRun, RunMachine } = await loadEngine();
  const cfg = newRunConfig('apprentice', 4242);
  const full = playRun(cfg, { wpm: 70, accuracy: 0.97, rng: makeRng(2) }).actions;
  let n = 1;
  while (RunMachine.replay(cfg, full.slice(0, n)).view.kind !== 'shop') n++;
  const save = { config: cfg, actions: full.slice(0, n) };
  await page.addInitScript((save) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('lettermancer.meta.v1', JSON.stringify({ prologueDone: true, runs: 1 }));
    localStorage.setItem('lettermancer.run.v1', JSON.stringify(save));
  }, save);
  await page.goto('/run?resume');
  await expect(page.locator('[data-screen="shop"]')).toBeVisible();
  // Mend (a service) is always the last item and always affordable here.
  const mend = page.locator('[data-screen="shop"] .card', { hasText: 'Mend' });
  const key = (await mend.locator('.hk').textContent())!.trim();
  await page.keyboard.press(key);
  await expect(mend).toHaveCount(0);
  await page.keyboard.press(key);
  await expect(page.locator('.float-text', { hasText: 'Not enough coins' })).toHaveCount(0);
  // Every remaining card is the same size.
  const heights = await page
    .locator('[data-screen="shop"] .card')
    .evaluateAll((els) => els.map((e) => (e as HTMLElement).offsetHeight));
  expect(new Set(heights).size).toBe(1);
});
