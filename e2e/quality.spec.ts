/**
 * Launch-quality checks: an accessibility audit of every main screen and the first-screen JS budget.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { gzipSync } from 'node:zlib';

const SCREENS = ['/', '/leaderboards', '/practice', '/profile', '/login', '/privacy', '/run?starter=apprentice'];

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('keycraft.meta.v1', JSON.stringify({ prologueDone: true, runs: 1 })));
});

for (const path of SCREENS) {
  test(`no serious accessibility problems on ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.locator('[data-screen]').first().waitFor();
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`);
    expect(serious).toEqual([]);
  });
}

test('the first screen loads under 200 KB of gzipped JavaScript', async ({ page }) => {
  const sizes: number[] = [];
  page.on('response', async (r) => {
    if (r.url().endsWith('.js')) sizes.push(gzipSync(await r.body()).length);
  });
  await page.goto('/', { waitUntil: 'networkidle' });
  const kb = sizes.reduce((a, b) => a + b, 0) / 1024;
  expect(kb).toBeLessThan(200);
});
