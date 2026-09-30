import { describe, expect, it } from 'vitest';
import { TRIALS } from '../src/content/trials';
import { defaultMeta, heatCap, PRACTICE_INK_PER_DAY, recordPractice } from '../src/meta';
import {
  advancePractice,
  createPractice,
  lessonFocus,
  lessonWords,
  letterLearned,
  pressPractice,
  summarizePractice,
  type PracticeConfig,
} from '../src/practice';
import { makeRng } from '../src/rng';
import { emptyStats, recordCorrect } from '../src/stats';

const cfg = (over: Partial<PracticeConfig> = {}): PracticeConfig => ({
  mode: 'words',
  amount: 10,
  punctuation: false,
  numbers: false,
  seed: 1,
  ...over,
});

/** Type the whole remaining text at a fixed pace. */
function typeAll(s: ReturnType<typeof createPractice>, msPerKey: number, start = 1000, typoEvery = 0) {
  let at = start;
  let n = 0;
  while (!s.done && at < start + 600_000) {
    if (typoEvery && ++n % typoEvery === 0) pressPractice(s, '#', at);
    pressPractice(s, s.text[s.pos], at);
    at += msPerKey;
    advancePractice(s, at);
  }
  return at;
}

describe('practice tests', () => {
  it('builds the requested number of words', () => {
    expect(createPractice(cfg({ amount: 25 })).text.split(' ')).toHaveLength(25);
  });

  it('adds punctuation and numbers when asked', () => {
    const s = createPractice(cfg({ amount: 100, punctuation: true, numbers: true }));
    expect(s.text).toMatch(/[A-Z]/);
    expect(s.text).toMatch(/[.,?!;:]/);
    expect(s.text).toMatch(/\d/);
  });

  it('scores a clean 60 wpm run as ~60 wpm with 100% accuracy', () => {
    const s = createPractice(cfg({ amount: 25 }));
    typeAll(s, 200); // 5 keys/s = 60 wpm
    const r = summarizePractice(s);
    expect(r.wpm).toBeGreaterThanOrEqual(58);
    expect(r.wpm).toBeLessThanOrEqual(62);
    expect(r.accuracy).toBe(1);
    expect(r.consistency).toBeGreaterThan(80);
    expect(r.series.length).toBeGreaterThan(5);
  });

  it('counts typos against accuracy and raw speed', () => {
    const s = createPractice(cfg({ amount: 25 }));
    typeAll(s, 200, 1000, 10);
    const r = summarizePractice(s);
    expect(r.accuracy).toBeLessThan(0.95);
    expect(r.raw).toBeGreaterThan(r.wpm);
  });

  it('timed tests end on the clock and never run out of words', () => {
    const s = createPractice(cfg({ mode: 'time', amount: 15 }));
    typeAll(s, 60); // 200 wpm
    const r = summarizePractice(s);
    expect(s.done).toBe(true);
    expect(r.seconds).toBe(15);
    expect(r.wpm).toBeGreaterThan(150);
  });

  it('quotes carry their source', () => {
    const s = createPractice(cfg({ mode: 'quote' }));
    expect(s.source).toBeTruthy();
  });
});

describe('adaptive lessons', () => {
  it('uses only unlocked letters and leans on the focus letter', () => {
    const words = lessonWords('enitrl', 'l', 40, makeRng(3));
    expect(words.join('')).toMatch(/^[enitrl]+$/);
    expect(words.filter((w) => w.includes('l')).length).toBeGreaterThan(10);
  });

  it('focuses the newest letter until it is learned', () => {
    const stats = emptyStats();
    expect(lessonFocus('enitrl', stats)).toBe('l');
    for (let i = 0; i < 25; i++) recordCorrect(stats, 'l', 'e', 200);
    expect(letterLearned('l', stats)).toBe(true);
    expect(lessonFocus('enitrl', stats)).not.toBe('l');
  });
});

describe('practice rewards', () => {
  const result = (over = {}) => ({
    mode: 'time' as const,
    testId: 'time-30',
    seconds: 30,
    wpm: 55,
    raw: 57,
    accuracy: 0.97,
    consistency: 80,
    correct: 140,
    errors: 4,
    series: [],
    slowLetters: [],
    source: null,
    ...over,
  });

  it('keeps a daily streak and caps ink per day', () => {
    const m = defaultMeta();
    const a = recordPractice(m, result(), '2026-10-01');
    expect(a.streak).toBe(1);
    expect(a.ink).toBeGreaterThan(0);
    expect(recordPractice(m, result(), '2026-10-02').streak).toBe(2);
    expect(recordPractice(m, result(), '2026-10-04').streak).toBe(1);
    for (let i = 0; i < 30; i++) recordPractice(m, result({ seconds: 120, wpm: 90, accuracy: 1 }), '2026-10-04');
    expect(m.practice.inkToday).toBe(PRACTICE_INK_PER_DAY);
  });

  it('passes a trial only when the test matches and the bar is cleared', () => {
    const m = defaultMeta();
    const capBefore = heatCap(m);
    expect(recordPractice(m, result({ wpm: 29 }), '2026-10-01', 'steady').trials).toEqual([]);
    expect(recordPractice(m, result({ testId: 'time-15' }), '2026-10-01', 'steady').trials).toEqual([]);
    const a = recordPractice(m, result(), '2026-10-01', 'steady');
    expect(a.trials.map((t) => t.id)).toEqual(['steady']);
    expect(m.leaf).toBe(TRIALS[0].leaf);
    expect(heatCap(m)).toBe(capBefore + 1);
  });
});
