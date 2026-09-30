import { describe, expect, it } from 'vitest';
import { InvalidAction, newRunConfig, RunMachine, type Action } from '../src/machine';
import { makeRng } from '../src/rng';
import { playRun } from '../src/sim';

/** The parts of a machine that must match after a replay. */
const fingerprint = (m: RunMachine) => ({
  view: m.view.kind,
  run: {
    hp: m.run.hp,
    coins: m.run.coins,
    act: m.run.act,
    node: m.run.node,
    keyMods: m.run.keyMods,
    relics: m.run.relics,
    totals: m.run.totals,
    result: m.run.result,
  },
  combat: m.combat && {
    time: m.combat.time,
    typed: m.combat.typed,
    combo: m.combat.combo,
    enemies: m.combat.enemies.map((e) => [e.word, e.hp, e.intent, e.burn]),
  },
});

describe('RunMachine', () => {
  it('replays a full bot run to the identical state', () => {
    for (const seed of [1, 2, 3]) {
      const cfg = newRunConfig('apprentice', seed, { q: 1, z: 0.5 });
      const live = playRun(cfg, { wpm: 55, accuracy: 0.95, rng: makeRng(seed * 7) });
      expect(live.view.kind).toBe('over');
      const replayed = RunMachine.replay(cfg, live.actions);
      expect(fingerprint(replayed)).toEqual(fingerprint(live));
    }
  });

  it('frame-by-frame time and jump-to-key time give the same result', () => {
    const cfg = newRunConfig('apprentice', 42);
    const a = new RunMachine(cfg);
    const b = new RunMachine(cfg);
    const word = a.combat!.enemies[0].word;
    // a: 16ms frames between keys; b: jumps straight to each key
    let at = 0;
    for (const k of word) {
      at += 180;
      for (let f = a.combat!.time; f < at; f += 16) a.dispatch({ t: 'time', at: f });
      a.dispatch({ t: 'key', k, at });
      b.dispatch({ t: 'key', k, at });
    }
    expect(fingerprint(a)).toEqual(fingerprint(b));
    // idle frames aren't recorded
    expect(a.actions).toEqual(b.actions);
  });

  it('saves mid-fight and resumes exactly', () => {
    const cfg = newRunConfig('tycoon', 9);
    const m = new RunMachine(cfg);
    const w = m.combat!.enemies[0].word;
    m.dispatch({ t: 'key', k: w[0], at: 300 });
    m.dispatch({ t: 'key', k: w[1], at: 520 });
    const saved = JSON.parse(JSON.stringify(m.save(2400)));
    const resumed = RunMachine.replay(saved.config, saved.actions);
    expect(fingerprint(resumed)).toEqual(fingerprint(m));
    expect(resumed.combat!.time).toBe(2400);
  });

  it('rejects impossible or out-of-place actions', () => {
    const m = new RunMachine(newRunConfig('apprentice', 5));
    expect(() => m.dispatch({ t: 'buy', i: 0 })).toThrow(InvalidAction);
    m.dispatch({ t: 'time', at: 1000 });
    expect(() => m.dispatch({ t: 'key', k: 'a', at: 500 })).toThrow(InvalidAction);
    expect(() => m.dispatch({ t: 'key', k: 'ab', at: 1200 })).toThrow(InvalidAction);
    expect(() => RunMachine.replay({ ...newRunConfig('apprentice', 5), rules: 0 }, [])).toThrow(InvalidAction);
  });

  it('a tampered log does not reproduce the claimed run', () => {
    const cfg = newRunConfig('apprentice', 77);
    const live = playRun(cfg, { wpm: 60, accuracy: 0.97, rng: makeRng(3) });
    const tampered: Action[] = live.actions.map((a) => (a.t === 'key' ? { ...a, k: 'q' } : a));
    let differs: boolean;
    try {
      differs = JSON.stringify(fingerprint(RunMachine.replay(cfg, tampered))) !== JSON.stringify(fingerprint(live));
    } catch (e) {
      differs = e instanceof InvalidAction;
    }
    expect(differs).toBe(true);
  });
});

describe('RunReport', () => {
  it('records fights, picks, slow words, and what killed you', () => {
    const cfg = newRunConfig('apprentice', 11);
    const m = playRun(cfg, { wpm: 18, accuracy: 0.85, rng: makeRng(4) });
    const r = m.report;
    expect(r.result).toBe(m.run.result);
    expect(r.fights.length).toBeGreaterThan(0);
    expect(r.slowWords.length).toBeGreaterThan(0);
    if (r.result === 'lost') expect(r.killedBy).toBeTruthy();
    expect(r.picks.some((p) => p.kind === 'install')).toBe(true);
    // derived purely from the replay
    expect(RunMachine.replay(cfg, m.actions).report).toEqual(r);
  });
});
