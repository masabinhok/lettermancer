import { describe, expect, it } from 'vitest';
import { createCombat, pressKey, target, tick } from '../src/combat';
import { makeRng } from '../src/rng';
import { advance, currentNode, makeEncounter, newRun } from '../src/run';
import { WordBank } from '../src/words';
import words from '../src/content/words.json';

/** Bot plays a whole run (no shopping/mods) at a fixed speed & accuracy. Returns act reached. */
function simulate(wpmTarget: number, acc: number, seed: number) {
  const rng = makeRng(seed);
  const bank = new WordBank(words);
  const run = newRun('apprentice', seed, rng);
  const ctx = { rng, nextWord: (e: { minLen: number; maxLen: number }, ex: ReadonlySet<string>) => bank.pick({ min: e.minLen, max: e.maxLen, excludeFirst: ex }, rng).word };
  const msPerKey = 60000 / (wpmTarget * 5);
  let time = 0;
  while (!run.result) {
    const kind = currentNode(run);
    if (kind !== 'shop') {
      const c = createCombat(makeEncounter(run, kind, rng), ctx);
      while (!c.over) {
        tick(c, run, msPerKey);
        if (c.over) break;
        time += msPerKey;
        const t = target(c) ?? c.enemies[0];
        const expected = target(c) ? t.word[c.typed.length] : t.word[0];
        pressKey(c, run, rng() < acc ? expected : 'q', ctx, time);
      }
      if (c.over === 'lose') return { act: run.act, node: run.node, won: false };
      if (kind === 'boss') run.hp = Math.min(run.maxHp, run.hp + 20);
    }
    advance(run);
  }
  return { act: 4, node: 0, won: true };
}

describe('balance simulation', () => {
  // Balance guardrails. The bot never buys mods or relics, so real players do better.
  const outcome = (w: number, a: number) => {
    const res = Array.from({ length: 20 }, (_, i) => simulate(w, a, i + 1));
    return { wins: res.filter((r) => r.won).length, avgAct: res.reduce((s, r) => s + r.act, 0) / res.length };
  };

  it('a fast, accurate typist usually wins even without upgrades', () => {
    expect(outcome(70, 0.98).wins).toBeGreaterThanOrEqual(15);
  });

  it('a beginner gets past the first fights', () => {
    expect(outcome(20, 0.9).avgAct).toBeGreaterThanOrEqual(1.5);
  });
});
