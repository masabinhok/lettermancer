import type { CombatCtx } from '../src/combat';
import { makeRng } from '../src/rng';
import { newRun } from '../src/run';
import type { EnemySpec, Run } from '../src/state';

export function testRun(): Run {
  const run = newRun('apprentice', 1, makeRng(1));
  run.keyMods = {};
  return run;
}

/** Hands out words from a queue, falling back to 'zzz'. */
export function queueCtx(words: string[]): CombatCtx {
  return { rng: makeRng(7), nextWord: () => words.shift() ?? 'zzz' };
}

export const spec = (over: Partial<EnemySpec> = {}): EnemySpec => ({
  kind: 'normal',
  name: 'Dummy',
  glyph: 'D',
  hp: 100,
  maxHp: 100,
  atk: 5,
  intentMs: 5000,
  minLen: 3,
  maxLen: 5,
  traits: [],
  ...over,
});
