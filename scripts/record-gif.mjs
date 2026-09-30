// Records a short fight for the README: opens a run, types enemy words at a steady pace, and turns the
// video into docs/media/keycraft.gif with ffmpeg.
//
// Usage: node scripts/record-gif.mjs   (env URL, default http://localhost:4173 — run `npm run preview` first)
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const URL = process.env.URL ?? 'http://localhost:4173';
const SECONDS = 14;
const dir = mkdtempSync(join(tmpdir(), 'keycraft-gif-'));
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.goto(URL);
await page.evaluate(() => localStorage.setItem('keycraft.meta.v1', JSON.stringify({ prologueDone: true, runs: 1 })));
await page.goto(`${URL}/run?starter=apprentice`);
await page.waitForSelector('[data-screen="intro"]');
await page.waitForTimeout(1200);
await page.keyboard.press('Enter');
await page.waitForSelector('[data-screen="doors"]');
await page.waitForTimeout(900);
await page.keyboard.press('1');
await page.waitForSelector('[data-screen="combat"]');

const end = Date.now() + SECONDS * 1000;
while (Date.now() < end && (await page.locator('[data-screen="combat"]').count())) {
  const next = page.locator('.enemy.targeted .l.next');
  const k = (await next.count())
    ? await next.textContent()
    : (await page.locator('.enemy .word').first().textContent())?.trim()[0];
  if (k) await page.keyboard.press(k);
  await page.waitForTimeout(110 + Math.random() * 60);
}
await page.waitForTimeout(800);
await ctx.close();
await browser.close();

const video = join(
  dir,
  readdirSync(dir).find((f) => f.endsWith('.webm')),
);
mkdirSync('docs/media', { recursive: true });
execFileSync('ffmpeg', [
  '-y',
  '-ss',
  '2.5',
  '-i',
  video,
  '-vf',
  'fps=10,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
  'docs/media/keycraft.gif',
]);
console.log('wrote docs/media/keycraft.gif');
