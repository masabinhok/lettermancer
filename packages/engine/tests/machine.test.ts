import { describe, expect, it } from 'vitest';
import { InvalidAction, newRunConfig, RunMachine, type Action } from '../src/machine';
import { makeRng } from '../src/rng';
import { playRun } from '../src/sim';

/** The parts of a machine that must match after a replay. */
const fingerprint = (m: RunMachine) => ({
  view: m.view.kind,
  run: {
    hp: m.run.hp,
    maxHp: m.run.maxHp,
    coins: m.run.coins,
    act: m.run.act,
    room: m.run.room,
    keyMods: m.run.keyMods,
    relics: m.run.relics,
    blessings: m.run.blessings,
    totals: m.run.totals,
    result: m.run.result,
  },
  combat: m.combat && {
    time: m.combat.time,
    typed: m.combat.typed,
    combo: m.combat.combo,
    enemies: m.combat.enemies.map((e) => [e.word, e.hp, e.intent, e.burn, e.shield]),
  },
});

/** A machine standing in its first fight. */
function inFight(seed: number, starter: 'apprentice' | 'tycoon' = 'apprentice') {
  const m = new RunMachine(newRunConfig(starter, seed));
  m.dispatch({ t: 'door', i: 0 });
  return m;
}

describe('RunMachine', () => {
  it('starts at a choice of doors that promise muse boons', () => {
    const m = new RunMachine(newRunConfig('apprentice', 1));
    expect(m.view.kind).toBe('doors');
    if (m.view.kind === 'doors') {
      expect(m.view.doors).toHaveLength(2);
      expect(m.view.doors.every((d) => d.node === 'fight' && d.reward?.kind === 'muse')).toBe(true);
    }
  });

  it('replays a full bot run to the identical state', () => {
    for (const seed of [1, 2, 3]) {
      const cfg = newRunConfig('apprentice', seed, { q: 1, z: 0.5 }, { oaths: { swift: 1, punct: 1 } });
      const live = playRun(cfg, { wpm: 55, accuracy: 0.95, rng: makeRng(seed * 7) });
      expect(live.view.kind).toBe('over');
      const replayed = RunMachine.replay(cfg, live.actions);
      expect(fingerprint(replayed)).toEqual(fingerprint(live));
      expect(replayed.report).toEqual(live.report);
    }
  });

  it('frame-by-frame time and jump-to-key time give the same result', () => {
    const a = inFight(42);
    const b = inFight(42);
    const word = a.combat!.enemies[0].word;
    let at = 0;
    for (const k of word) {
      at += 180;
      for (let f = a.combat!.time; f < at; f += 16) a.dispatch({ t: 'time', at: f });
      a.dispatch({ t: 'key', k, at });
      b.dispatch({ t: 'key', k, at });
    }
    expect(fingerprint(a)).toEqual(fingerprint(b));
    expect(a.actions).toEqual(b.actions);
  });

  it('saves mid-fight and resumes exactly', () => {
    const m = inFight(9, 'tycoon');
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
    expect(() => m.dispatch({ t: 'key', k: 'a', at: 1 })).toThrow(InvalidAction);
    m.dispatch({ t: 'door', i: 0 });
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

  it('a winning run visits doors, fights, bosses and at least one non-fight room', () => {
    const m = playRun(newRunConfig('apprentice', 404), { wpm: 90, accuracy: 0.99, rng: makeRng(1) });
    expect(m.run.result).toBe('won');
    expect(m.report.bossesBeaten).toHaveLength(3);
    const kinds = new Set(m.report.picks.filter((p) => p.kind === 'door').map((p) => p.id.split(':')[0]));
    expect(kinds.has('fight')).toBe(true);
    expect(kinds.size).toBeGreaterThan(1);
  });

  it('ends the moment the final boss falls, with no prize to choose', () => {
    const m = playRun(newRunConfig('apprentice', 404), { wpm: 90, accuracy: 0.99, rng: makeRng(1) });
    expect(m.view.kind).toBe('over');
    const last = m.actions[m.actions.length - 1];
    expect(['key', 'time']).toContain(last.t);
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
    expect(r.enemiesSeen.length).toBeGreaterThan(0);
    if (r.result === 'lost') expect(r.killedBy).toBeTruthy();
    expect(RunMachine.replay(cfg, m.actions).report).toEqual(r);
  });
});
