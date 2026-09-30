import { newRunConfig, RunMachine } from '@keycraft/engine';
import { describe, expect, it } from 'vitest';
import { combatSnapshot, WINDUP_MS } from './snapshot';

describe('combatSnapshot', () => {
  it('marks typed, next and remaining letters and previews damage', () => {
    const m = new RunMachine(newRunConfig('apprentice', 3));
    const word = m.combat!.enemies[0].word;
    m.dispatch({ t: 'key', k: word[0], at: 200 });
    const s = combatSnapshot(m.combat!, m.run);
    const e = s.enemies[0];
    expect(e.targeted).toBe(true);
    expect(e.letters[0].state).toBe('done');
    expect(e.letters[1].state).toBe('next');
    expect(s.nextKey).toBe(word[1]);
    expect(s.preview).toBeGreaterThanOrEqual(word.length);
  });

  it('flags the wind-up in the last second before a hit', () => {
    const m = new RunMachine(newRunConfig('apprentice', 3));
    const e = m.combat!.enemies[0];
    m.dispatch({ t: 'time', at: e.intentMs - WINDUP_MS - 100 });
    expect(combatSnapshot(m.combat!, m.run).enemies[0].windup).toBe(false);
    m.dispatch({ t: 'time', at: e.intentMs - WINDUP_MS + 100 });
    expect(combatSnapshot(m.combat!, m.run).enemies[0].windup).toBe(true);
  });
});
