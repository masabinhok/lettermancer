// Plays Lettermancer in headless Chromium like a person: reads words off the screen and types them
// with human-ish timing and typos, screenshotting each screen the first time it appears.
//
// Usage: node scripts/playtest.mjs <label> <wpm> <typoRate> [buy]
//   env URL (default http://localhost:5173), OUT (default playtest-shots/), MINUTES (default 12)
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const [label = 'run', wpmArg = '50', typoArg = '0.03', mode] = process.argv.slice(2);
const wpm = Number(wpmArg);
const typo = Number(typoArg);
const shopBuy = mode === 'buy';
const OUT = process.env.OUT ?? 'playtest-shots/';
const URL = process.env.URL ?? 'http://localhost:5173';
const MINUTES = Number(process.env.MINUTES ?? 12);
mkdirSync(OUT, { recursive: true });

const msPerKey = 60000 / (wpm * 5);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(URL);
await page.waitForSelector('[data-screen]');

let shot = 0;
const snap = (name) => page.screenshot({ path: `${OUT}${label}-${String(shot++).padStart(2, '0')}-${name}.png` });
const screen = () =>
  page.evaluate(() => {
    const all = [...document.querySelectorAll('[data-screen]')].map((e) => e.getAttribute('data-screen'));
    return all.includes('pause') ? 'pause' : (all[0] ?? 'none');
  });
const seen = new Set();
const log = [];
const t0 = Date.now();
let last = '';
const hp = () => page.evaluate(() => document.querySelector('.hud .hp span')?.textContent ?? '');
const wait = (ms) => page.waitForTimeout(ms);

while (Date.now() - t0 < MINUTES * 60_000) {
  const s = await screen();
  if (s !== last) {
    log.push(`${((Date.now() - t0) / 1000).toFixed(0)}s ${s} ${await hp()}`);
    last = s;
    if (!seen.has(s) || s === 'results') {
      await wait(450);
      await snap(s);
      seen.add(s);
    }
  }
  if (s === 'doors') {
    await wait(300);
    await page.keyboard.press(String(1 + Math.floor(Math.random() * 2)));
    await wait(400);
  } else if (s === 'event') {
    await wait(300);
    const outcome = await page.evaluate(() => !!document.querySelector('.outcome'));
    await page.keyboard.press(outcome ? 'Enter' : '1');
    await wait(400);
  } else if (s === 'challenge') {
    const k = await page.evaluate(() => document.querySelector('.text .next')?.textContent);
    if (k) await page.keyboard.press(k === '␣' ? ' ' : k);
    await wait(msPerKey);
  } else if (s === 'title' || s === 'intro') {
    await page.keyboard.press('Enter');
    await wait(500);
  } else if (s === 'results') {
    break;
  } else if (s === 'pause') {
    await page.keyboard.press('Escape');
    await wait(200);
  } else if (s === 'reward') {
    await wait(400);
    const cards = await page.locator('[data-screen="reward"] .card').count();
    await page.keyboard.press(cards ? '1' : 'Enter');
    await wait(400);
  } else if (s === 'install') {
    await wait(300);
    await page.keyboard.press(['e', 't', 'a', 'o', 'i', 'n', 's', 'r'][Math.floor(Math.random() * 8)]);
    await wait(500);
  } else if (s === 'shop') {
    if (shopBuy) {
      for (const k of ['7', '5', '1']) {
        await page.keyboard.press(k);
        await wait(300);
        if ((await screen()) === 'install') {
          await page.keyboard.press('a');
          await wait(500);
        }
      }
    }
    await page.keyboard.press('Enter');
    await wait(400);
  } else if (s === 'combat') {
    if (!seen.has('combat-mid') && Date.now() - t0 > 9000) {
      await snap('combat-mid');
      seen.add('combat-mid');
    }
    const k = await page.evaluate(() => {
      const t = document.querySelector('.enemy.targeted .word');
      if (t) return t.querySelector('.l.next')?.textContent;
      return [...document.querySelectorAll('.enemy .word')]
        .map((w) => w.textContent.trim())
        .find((x) => x && x[0] !== '·')?.[0];
    });
    if (!k || k === '·') {
      await wait(100);
      continue;
    }
    if (Math.random() < typo) {
      await page.keyboard.press('q');
      await wait(msPerKey);
    }
    await page.keyboard.press(k === '␣' ? ' ' : k);
    await wait(msPerKey * (0.6 + Math.random() * 0.8));
  } else {
    await wait(200);
  }
}
console.log(log.join('\n'));
console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();
