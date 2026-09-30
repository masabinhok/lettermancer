import { describe, expect, it } from 'vitest';
import { bonusesFrom, KEEPSAKES, nextCost } from '../src/content/progression';
import { PROPHECIES } from '../src/content/prophecies';
import { newRunConfig } from '../src/machine';
import {
  applyUnlocks,
  archivistLine,
  awardRun,
  buyUpgrade,
  clampOaths,
  defaultMeta,
  heatCap,
  migrateMeta,
  runBonusesFor,
  tradeSeals,
} from '../src/meta';
import { makeRng } from '../src/rng';
import { runScore } from '../src/run';
import { playRun } from '../src/sim';
import { emptyStats, keyMastery, recordCorrect, recordError } from '../src/stats';

const snap = { mastery: {}, totalKeys: 0 };

describe('unlocks', () => {
  it('unlocks each starter once', () => {
    const m = defaultMeta();
    expect(applyUnlocks(m, { act: 2, coins: 59 })).toEqual([]);
    expect(applyUnlocks(m, { act: 3 })).toEqual(['glassblower']);
    expect(applyUnlocks(m, { act: 3, coins: 60, flawlessElite: true })).toEqual(['cryomancer', 'tycoon']);
    expect(applyUnlocks(m, { act: 3, coins: 60, flawlessElite: true })).toEqual([]);
  });
});

describe('progression', () => {
  it('buys upgrades with rising costs and turns them into run bonuses', () => {
    const m = defaultMeta();
    m.ink = 200;
    expect(buyUpgrade(m, 'vitality')).toBe(true);
    expect(buyUpgrade(m, 'vitality')).toBe(true);
    expect(m.ink).toBe(200 - 40 - 90);
    expect(nextCost(m.upgrades, 'vitality')).toBe(160);
    expect(buyUpgrade(m, 'vitality')).toBe(false); // can't afford
    expect(buyUpgrade(m, 'insight')).toBe(false); // needs Gold Leaf
    expect(runBonusesFor(m).maxHp).toBe(6);
  });

  it('keepsakes level up with use', () => {
    expect(bonusesFrom({}, { id: 'quartz-pen', uses: 0 }).startShield).toBe(2);
    expect(bonusesFrom({}, { id: 'quartz-pen', uses: 3 }).startShield).toBe(3);
    expect(bonusesFrom({}, { id: 'ember-locket', uses: 6 }).startBoon).toEqual({ key: 'e', mod: 'ember', rarity: 2 });
    expect(Object.keys(KEEPSAKES)).toHaveLength(5);
  });

  it('trades seals for gold leaf', () => {
    const m = defaultMeta();
    m.seals = 7;
    expect(tradeSeals(m)).toBe(true);
    expect(tradeSeals(m)).toBe(true);
    expect(tradeSeals(m)).toBe(false);
    expect(m.leaf).toBe(2);
  });

  it('caps Heat at two above your best win', () => {
    const m = defaultMeta();
    m.oaths = { swift: 3, iron: 3 };
    expect(heatCap(m)).toBe(2);
    expect(clampOaths(m)).toEqual({ swift: 2 });
  });

  it('awards currencies, codex entries, keepsakes and prophecies after a run', () => {
    const m = defaultMeta();
    const cfg = newRunConfig('apprentice', 404);
    const machine = playRun(cfg, { wpm: 90, accuracy: 0.99, rng: makeRng(1) });
    const a = awardRun(
      m,
      { report: machine.report, run: machine.run, config: cfg, score: runScore(machine.run) },
      snap,
    );
    expect(machine.run.result).toBe('won');
    expect(a.ink).toBeGreaterThan(100);
    expect(a.leaf).toBe(3);
    expect(m.wins).toBe(1);
    expect(m.keepsakes).toContain('ember-locket');
    expect(m.keepsakes).toContain('sage-leaf');
    expect(Object.keys(m.codex.bosses)).toHaveLength(3);
    expect(a.prophecies.map((p) => p.id)).toContain('win');
    expect(m.seals).toBe(a.seals);
    // Awarded once only.
    expect(
      awardRun(m, { report: machine.report, run: machine.run, config: cfg, score: 0 }, snap).prophecies.map(
        (p) => p.id,
      ),
    ).not.toContain('win');
  });

  it('gentle runs pay half ink and never raise the Heat cap', () => {
    const m = defaultMeta();
    const cfg = newRunConfig('apprentice', 404, {}, { gentle: true, oaths: { swift: 1 } });
    const machine = playRun(cfg, { wpm: 90, accuracy: 0.99, rng: makeRng(1) });
    awardRun(m, { report: machine.report, run: machine.run, config: cfg, score: 0 }, snap);
    expect(m.maxHeatWon).toBe(0);
  });

  it('migrates old saves by filling new fields', () => {
    const m = migrateMeta({ runs: 3, unlocked: ['apprentice'] } as never);
    expect(m.runs).toBe(3);
    expect(m.codex.enemies).toEqual({});
    expect(m.practice.lessonLetters).toBe(6);
  });

  it('the Archivist speaks to your last run, then moves on', () => {
    const m = defaultMeta();
    m.runs = 4;
    m.lastRun = { result: 'lost', act: 1, killedBy: 'Mirror Scribe', bossesBeaten: [], heat: 0, gentle: false };
    const line = archivistLine(m);
    expect(line.id).toBe('mirror');
    m.heard.push(line.id);
    expect(archivistLine(m).id).not.toBe('mirror');
  });

  it('has around sixty prophecies with unique ids', () => {
    expect(PROPHECIES.length).toBeGreaterThanOrEqual(55);
    expect(new Set(PROPHECIES.map((p) => p.id)).size).toBe(PROPHECIES.length);
  });
});

describe('key mastery', () => {
  it('ranks keys by lifetime speed and accuracy', () => {
    const s = emptyStats();
    for (let i = 0; i < 40; i++) {
      recordCorrect(s, 'e', 'x', 150);
      recordCorrect(s, 'q', 'x', 320);
      recordCorrect(s, 'z', 'x', 500);
    }
    for (let i = 0; i < 10; i++) recordError(s, 'q');
    const m = keyMastery(s);
    expect(m.e).toBe(3);
    expect(m.q).toBe(0); // 20% errors
    expect(m.z).toBe(0);
    expect(m.a).toBe(0);
  });
});
