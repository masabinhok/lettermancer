import { describe, expect, it } from 'vitest';
import { bonusesFrom } from '../src/content/progression';
import { newRunConfig } from '../src/machine';
import type { RunBonuses } from '../src/state';
import { makeRng } from '../src/rng';
import { playRun } from '../src/sim';

/** Plays 20 runs; returns wins and the average act reached (4 = cleared). */
export function outcome(wpm: number, accuracy: number, n = 20, gentle = false, bonuses?: RunBonuses) {
  let wins = 0;
  let acts = 0;
  for (let i = 1; i <= n; i++) {
    const m = playRun(newRunConfig('apprentice', i * 101, {}, { gentle, bonuses }), { wpm, accuracy, rng: makeRng(i) });
    if (m.run.result === 'won') wins++;
    acts += m.run.result === 'won' ? 4 : m.run.act;
  }
  return { wins, avgAct: acts / n };
}

// Balance guardrails. Thresholds move as the design changes; the report prints every time.
describe('balance', () => {
  const table = [
    [25, 0.9],
    [40, 0.95],
    [60, 0.97],
    [80, 0.98],
  ].map(([w, a]) => ({ w, a, ...outcome(w, a) }));

  it('prints the balance table', () => {
    console.log(
      table.map((r) => `${r.w} wpm ${r.a * 100}%: wins ${r.wins}/20, avg act ${r.avgAct.toFixed(2)}`).join('\n'),
    );
  });

  it('skill is rewarded: faster, cleaner typists get further', () => {
    for (let i = 1; i < table.length; i++) expect(table[i].avgAct).toBeGreaterThanOrEqual(table[i - 1].avgAct);
  });

  it('a fast, accurate typist usually wins', () => {
    expect(table[3].wins).toBeGreaterThanOrEqual(15);
  });

  it('a slow, sloppy typist rarely wins without upgrades', () => {
    expect(table[0].wins).toBeLessThanOrEqual(3);
  });

  it('a 40 wpm typist wins some and loses some', () => {
    expect(table[1].wins).toBeGreaterThanOrEqual(3);
    expect(table[1].wins).toBeLessThanOrEqual(16);
  });

  it('gentle pace lets a beginner make real progress', () => {
    const gentle = outcome(25, 0.9, 20, true);
    console.log(`25 wpm gentle: wins ${gentle.wins}/20, avg act ${gentle.avgAct.toFixed(2)}`);
    expect(gentle.avgAct).toBeGreaterThanOrEqual(2);
  });

  it('a returning 40 wpm player with modest upgrades wins about half the time', () => {
    const b = bonusesFrom({ vitality: 2, purse: 1, momentum: 1, reroll: 1 }, { id: 'quartz-pen', uses: 3 });
    const r = outcome(40, 0.95, 20, false, b);
    console.log(`40 wpm with upgrades: wins ${r.wins}/20, avg act ${r.avgAct.toFixed(2)}`);
    expect(r.wins).toBeGreaterThan(table[1].wins);
  });
});
