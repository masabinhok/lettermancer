// Usage: node scripts/playtest.mjs <label> <wpm> <typoRate> [buy]   (dev server must be running)
// Plays Keycraft in headless Chromium like a human: reads words off the DOM, types with delays & typos.
import { chromium } from 'playwright';
const OUT = process.env.OUT ?? 'playtest-shots/';
await import('node:fs').then((fs) => fs.mkdirSync(OUT, { recursive: true }));
const [label, wpm, typo, shopBuy] = [process.argv[2], +process.argv[3], +process.argv[4], process.argv[5] === 'buy'];
const msPerKey = 60000 / (wpm * 5);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(process.env.URL ?? 'http://localhost:5173');
await page.waitForTimeout(800);
let shot = 0;
const snap = async (name) => page.screenshot({ path: `${OUT}${label}-${String(shot++).padStart(2, '0')}-${name}.png` });
const screen = () => page.evaluate(() => document.querySelector('.screen')?.className.replace('screen ', '') ?? 'none');
const seen = new Set();
const log = [];
const t0 = Date.now();
let lastScreen = '';
while (Date.now() - t0 < 12 * 60_000) {
  const s = await screen();
  if (s !== lastScreen) {
    log.push(
      `${((Date.now() - t0) / 1000).toFixed(0)}s ${s} ${await page.evaluate(() => document.querySelector('.hp-text')?.textContent ?? '')}`,
    );
    lastScreen = s;
    const key = s.split(' ')[0];
    if (!seen.has(key) || key === 'results' || key === 'banner') {
      await page.waitForTimeout(300);
      await snap(key);
      seen.add(key);
    }
  }
  if (s.startsWith('menu') || s.startsWith('banner')) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    continue;
  }
  if (s.startsWith('results')) {
    await snap('results-final');
    break;
  }
  if (s.startsWith('reward')) {
    await page.waitForTimeout(500);
    await page.keyboard.press('1');
    await page.waitForTimeout(400);
    if (await page.$('.installer')) {
      if (!seen.has('install')) {
        await snap('install');
        seen.add('install');
      }
      await page.keyboard.press('e');
      await page.waitForTimeout(700);
    } else {
      await page.keyboard.press('1');
      await page.waitForTimeout(400);
      if (await page.$('.installer')) {
        await page.keyboard.press('t');
        await page.waitForTimeout(700);
      }
    }
    continue;
  }
  if (s.startsWith('shop')) {
    if (shopBuy) {
      for (const k of ['7', '5', '1']) {
        await page.keyboard.press(k);
        await page.waitForTimeout(300);
        if (await page.$('.installer')) {
          await page.keyboard.press('a');
          await page.waitForTimeout(700);
        }
      }
    }
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    continue;
  }
  if (s.startsWith('combat')) {
    // mid-combat snapshot once, after a few seconds
    if (!seen.has('combat-mid') && Date.now() - t0 > 8000) {
      await snap('combat-mid');
      seen.add('combat-mid');
    }
    const st = await page.evaluate(() => {
      const t = document.querySelector('.enemy.targeted .word');
      if (t) return { next: t.querySelector('.l.next')?.textContent };
      const w = [...document.querySelectorAll('.enemy:not(.dying) .word')].map((w) => w.textContent);
      return { first: w.find((x) => x && x[0] !== '_')?.[0] };
    });
    const k = st.next ?? st.first;
    if (!k || k === '_') {
      await page.waitForTimeout(100);
      continue;
    }
    if (Math.random() < typo) {
      await page.keyboard.press('q');
      await page.waitForTimeout(msPerKey);
    }
    await page.keyboard.press(k);
    await page.waitForTimeout(msPerKey * (0.6 + Math.random() * 0.8));
    continue;
  }
  await page.waitForTimeout(200);
}
console.log(log.join('\n'));
console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();
