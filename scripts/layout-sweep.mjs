// Checks that every screen fits the window at common sizes: nothing cut off at the bottom or sides.
// In-run screens come from a bot-played run, loaded at the moment each screen appears.
//
// Usage: (cd apps/web && npx vite dev --port 5317) then: node scripts/layout-sweep.mjs [outDir]
//   env URL (default http://localhost:5317). With outDir, also saves a screenshot of each screen.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const URL = process.env.URL ?? 'http://localhost:5317';
const OUT = process.argv[2];
const ENGINE = `/@fs${resolve('packages/engine/src/index.ts')}`;
/** Common desktop windows (browser toolbars eat ~100-130px of height), plus 133% zoom on 1080p and 768p screens. */
const SIZES = process.env.SIZES
  ? process.env.SIZES.split(',').map((s) => s.split('x').map(Number))
  : [
      [1280, 720],
      [1366, 657],
      [1440, 780],
      [1536, 730],
      [1920, 950],
      [2560, 1300],
      [1444, 714], // 1920x1080 at 133% zoom
      [1027, 486], // 1366x768 at 133% zoom
      [1280, 560], // a short window
    ];
const ROUTES = ['/', '/practice', '/leaderboards', '/profile', '/login', '/privacy'];
const KINDS = ['combat', 'doors', 'reward', 'install', 'shop', 'event'];
if (OUT) mkdirSync(OUT, { recursive: true });

/** The furthest any visible element pokes past the window, ignoring content inside a scroll or clip box. */
function overflow() {
  let worst = 0;
  let what = '';
  for (const el of document.querySelectorAll('[data-screen] *')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue;
    let p = el.parentElement;
    let clipped = false;
    while (p) {
      if (getComputedStyle(p).overflowY !== 'visible' && p.scrollHeight > p.clientHeight + 1) {
        clipped = true;
        break;
      }
      p = p.parentElement;
    }
    if (clipped) continue;
    const over = Math.max(r.bottom - innerHeight, r.right - innerWidth, -r.left);
    if (over > worst) {
      worst = over;
      what = typeof el.className === 'string' ? el.className : el.tagName;
    }
  }
  if (worst > 2) return `${Math.round(worst)}px over (${what.slice(0, 40)})`;
  // Game screens should fit without scrolling; long pages (practice, profile...) may scroll.
  const screen = document.querySelector('[data-screen]');
  const longPage = ['practice', 'profile', 'leaderboards', 'privacy', 'login'].includes(
    screen?.getAttribute('data-screen'),
  );
  if (!longPage)
    for (const el of [screen, ...screen.querySelectorAll('*')]) {
      const st = getComputedStyle(el);
      if (/(auto|scroll)/.test(st.overflowY) && el.scrollHeight > el.clientHeight + 2)
        return `scrolls ${el.scrollHeight - el.clientHeight}px (${String(el.className).slice(0, 30)})`;
    }
  return 'ok';
}

const browser = await chromium.launch();
let failed = false;
for (const [w, h] of SIZES) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(`${URL}/privacy`);
  await page.waitForSelector('[data-screen]');
  // Find the first moment each in-run screen appears (and the most crowded fight) in a bot-played run.
  const found = await page.evaluate(
    async ({ ENGINE, KINDS }) => {
      const E = await import(ENGINE);
      const out = {};
      for (const seed of [4242, 77, 913]) {
        const cfg = E.newRunConfig('apprentice', seed);
        const full = E.playRun(cfg, { wpm: 70, accuracy: 0.97, rng: E.makeRng(seed) }).actions;
        for (let n = 1; n < full.length; n++) {
          const v = E.RunMachine.replay(cfg, full.slice(0, n)).view;
          const save = { config: cfg, actions: full.slice(0, n) };
          if (v.kind === 'combat') {
            if (!out.combat || v.combat.enemies.length > out.combat.size)
              out.combat = { save, size: v.combat.enemies.length };
          } else if (
            KINDS.includes(v.kind) &&
            !out[v.kind] &&
            (v.kind !== 'reward' || (v.muse && v.offers.length === 3))
          )
            out[v.kind] = { save };
        }
      }
      return out;
    },
    { ENGINE, KINDS },
  );
  const results = [];
  const record = async (name) => {
    const r = await page.evaluate(overflow);
    if (r !== 'ok') failed = true;
    results.push(`${name}:${r}`);
    if (OUT && (w === 1280 || w === 1920 || w === 1027))
      await page.screenshot({ path: `${OUT}/${name.replace(/\W/g, '') || 'home'}-${w}.png` });
  };
  for (const route of ROUTES) {
    await page.evaluate(() =>
      localStorage.setItem('lettermancer.meta.v1', JSON.stringify({ prologueDone: true, runs: 3 })),
    );
    await page.goto(URL + route);
    await page.waitForSelector('[data-screen]');
    await page.waitForTimeout(400);
    await record(route);
  }
  for (const kind of KINDS) {
    if (!found[kind]) {
      results.push(`${kind}:not reached`);
      continue;
    }
    await page.evaluate((save) => localStorage.setItem('lettermancer.run.v1', JSON.stringify(save)), found[kind].save);
    await page.goto(`${URL}/run?resume`);
    await page.waitForSelector(`[data-screen="${kind}"]`);
    await page.waitForTimeout(1500); // let reveal animations finish
    if (kind === 'combat') {
      await page.keyboard.press('Escape'); // resumed fights start paused
      await page.waitForTimeout(400);
    }
    await record(kind);
  }
  console.log(`${w}x${h}  ${results.join('  ')}`);
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
