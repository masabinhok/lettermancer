import { describe, expect, it } from 'vitest';
import { newRunConfig } from '../src/machine';
import { makeRng } from '../src/rng';
import { playRun } from '../src/sim';

/** Plays 20 runs; returns wins and the average act reached (4 = cleared). */
export function outcome(wpm: number, accuracy: number, n = 20) {
  let wins = 0;
  let acts = 0;
  for (let i = 1; i <= n; i++) {
    const m = playRun(newRunConfig('apprentice', i * 101), { wpm, accuracy, rng: makeRng(i) });
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
    console.log(table.map((r) => `${r.w} wpm ${r.a * 100}%: wins ${r.wins}/20, avg act ${r.avgAct.toFixed(2)}`).join('\n'));
  });

  it('skill is rewarded: faster, cleaner typists get further', () => {
    for (let i = 1; i < table.length; i++) expect(table[i].avgAct).toBeGreaterThanOrEqual(table[i - 1].avgAct);
  });

  it('a fast, accurate typist usually wins', () => {
    expect(table[3].wins).toBeGreaterThanOrEqual(12);
  });
});
