import { describe, expect, it } from 'vitest';
import { newRunConfig, type Action } from '../src/machine';
import { defaultMeta } from '../src/meta';
import { bonusesFrom } from '../src/content/progression';
import { NO_BONUSES } from '../src/state';
import {
  bonusesPossible,
  dailyLabel,
  dailyStarter,
  sharedRunConfig,
  mergeMeta,
  replayPractice,
  seedFor,
  verifyRun,
  weeklyLabel,
  weeklyOaths,
} from '../src/online';
import { createPractice, pressPractice } from '../src/practice';
import { makeRng } from '../src/rng';
import { playRun } from '../src/sim';

describe('shared seeds', () => {
  it('is stable and label-specific', () => {
    expect(seedFor('daily:2026-10-01')).toBe(seedFor('daily:2026-10-01'));
    expect(seedFor('daily:2026-10-01')).not.toBe(seedFor('daily:2026-10-02'));
    expect(dailyLabel(new Date('2026-10-01T23:30:00Z'))).toBe('daily:2026-10-01');
    expect(weeklyLabel(new Date('2026-10-01T00:00:00Z'))).toBe('weekly:2026-W40');
    expect(weeklyLabel(new Date('2027-01-01T00:00:00Z'))).toBe('weekly:2026-W53');
  });

  it('gives the week three oaths, the same for everyone', () => {
    const o = weeklyOaths('weekly:2026-W40');
    expect(Object.keys(o)).toHaveLength(3);
    expect(weeklyOaths('weekly:2026-W40')).toEqual(o);
  });
});

describe('verifyRun', () => {
  const cfg = newRunConfig('apprentice', 77);
  const live = playRun(cfg, { wpm: 70, accuracy: 0.97, rng: makeRng(5) });

  it('accepts an honest, finished run and scores it', () => {
    const v = verifyRun(cfg, live.actions);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.score).toBeGreaterThan(0);
  });

  it('rejects an unfinished run', () => {
    expect(verifyRun(cfg, live.actions.slice(0, 50))).toMatchObject({ ok: false });
  });

  it('rejects bot-speed timing', () => {
    // Squash every fight's keystrokes to 5 ms apart.
    let t = 0;
    const squashed: Action[] = live.actions.map((a) => {
      if (a.t === 'key' || a.t === 'bs' || a.t === 'untarget' || a.t === 'time') return { ...a, at: (t += 5) };
      t = 0;
      return a;
    });
    const v = verifyRun(cfg, squashed);
    expect(v.ok).toBe(false);
  });

  it('rejects gentle runs and wrong daily seeds', () => {
    expect(verifyRun({ ...cfg, gentle: true }, live.actions)).toMatchObject({ ok: false });
    expect(verifyRun({ ...cfg, mode: 'daily' }, live.actions)).toMatchObject({
      ok: false,
      reason: "not today's daily seed",
    });
  });

  it('accepts a daily run on the shared seed', () => {
    const day = new Date('2026-10-01T12:00:00Z');
    const daily = sharedRunConfig('daily', 'apprentice', day);
    const m = playRun(daily, { wpm: 60, accuracy: 0.97, rng: makeRng(9) });
    expect(verifyRun(daily, m.actions, day).ok).toBe(true);
  });
});

describe('forged configs', () => {
  it('knows which bonuses permanent progress can give', () => {
    expect(bonusesPossible(NO_BONUSES)).toBe(true);
    const maxed = bonusesFrom(
      { vitality: 9, purse: 9, momentum: 9, scholar: 9, reroll: 9, insight: 9, favor: 9, 'second-wind': 9 },
      { id: 'lucky-coin', uses: 99 },
    );
    expect(bonusesPossible(JSON.parse(JSON.stringify(maxed)))).toBe(true);
    expect(bonusesPossible({ ...maxed, maxHp: maxed.maxHp + 3 })).toBe(false);
    expect(bonusesPossible({ ...NO_BONUSES, startShield: 1, graceMs: 1000 })).toBe(false);
  });

  it('rejects impossible bonuses, Oaths and keyboards before replaying', () => {
    const cfg = newRunConfig('apprentice', 77);
    const actions: Action[] = [];
    expect(verifyRun({ ...cfg, bonuses: { ...NO_BONUSES, maxHp: 500 } }, actions)).toMatchObject({
      reason: 'impossible bonuses',
    });
    expect(verifyRun({ ...cfg, oaths: { swift: 9 } }, actions)).toMatchObject({ reason: 'impossible Oaths' });
    expect(verifyRun({ ...cfg, starter: 'god' as never }, actions)).toMatchObject({ reason: 'unknown keyboard' });
  });

  it('starts shared runs without bonuses or weak-key bias', () => {
    const day = new Date('2026-10-01T12:00:00Z');
    const seed = seedFor(dailyLabel(day));
    const starter = dailyStarter(dailyLabel(day));
    const wrongKeys = newRunConfig(starter === 'apprentice' ? 'tycoon' : 'apprentice', seed, {}, { mode: 'daily' });
    expect(verifyRun(wrongKeys, [], day)).toMatchObject({ reason: "not today's keyboard" });
    const withBonus = newRunConfig(starter, seed, {}, { mode: 'daily', bonuses: { ...NO_BONUSES, maxHp: 3 } });
    expect(verifyRun(withBonus, [], day)).toMatchObject({ reason: 'shared runs start without bonuses' });
    const biased = newRunConfig(starter, seed, { q: 2 }, { mode: 'daily' });
    expect(verifyRun(biased, [], day)).toMatchObject({ reason: 'shared runs use the plain word pool' });
  });
});

describe('sharedRunConfig', () => {
  it('builds a weekly run on the shared seed and Oaths with the chosen keyboard', () => {
    const day = new Date('2026-10-01T12:00:00Z');
    const cfg = sharedRunConfig('weekly', 'tycoon', day);
    expect(cfg.starter).toBe('tycoon');
    expect(cfg.oaths).toEqual(weeklyOaths(weeklyLabel(day)));
    expect(verifyRun(cfg, [], day)).toMatchObject({ reason: 'the run is not finished' });
  });
});

describe('replayPractice', () => {
  it('recomputes a practice result from keystrokes', () => {
    const config = { mode: 'words' as const, amount: 10, punctuation: false, numbers: false, seed: 4 };
    const s = createPractice(config);
    const inputs: { k: string; at: number }[] = [];
    let at = 0;
    while (!s.done) {
      const k = s.text[s.pos];
      inputs.push({ k, at });
      pressPractice(s, k, at);
      at += 150;
    }
    const r = replayPractice(config, inputs)!;
    expect(r.wpm).toBeGreaterThan(70);
    expect(replayPractice(config, inputs.slice(0, 5))).toBeNull();
  });
});

describe('mergeMeta', () => {
  it('keeps everything from both sides and adds guest currencies on first sign-in', () => {
    const a = defaultMeta();
    a.ink = 30;
    a.unlocked = ['apprentice', 'tycoon'];
    a.prophecies = { win: '2026-09-01' };
    a.upgrades = { vitality: 2 };
    const b = defaultMeta();
    b.ink = 100;
    b.unlocked = ['apprentice', 'glassblower'];
    b.prophecies = { win: '2026-09-20', 'combo-50': '2026-09-21' };
    b.upgrades = { vitality: 1, purse: 1 };
    const merged = mergeMeta(a, b, true);
    expect(merged.ink).toBe(130);
    expect(merged.unlocked.sort()).toEqual(['apprentice', 'glassblower', 'tycoon']);
    expect(merged.prophecies.win).toBe('2026-09-01');
    expect(merged.upgrades).toEqual({ vitality: 2, purse: 1 });
    expect(mergeMeta(a, b).ink).toBe(100); // later syncs: the newer copy owns currencies
  });
});
