import { describe, expect, it } from 'vitest';
import { accuracy, emptyStats, keyWeakness, mergeStats, nemesisBigram, recordCorrect, recordError, topWeakKeys } from '../src/engine/stats';

describe('stats', () => {
  it('ranks slow and error-prone keys as weakest', () => {
    const s = emptyStats();
    for (let i = 0; i < 10; i++) {
      recordCorrect(s, 'a', 'x', 100);
      recordCorrect(s, 'b', 'x', 100);
      recordCorrect(s, 'q', 'x', 400);
    }
    for (let i = 0; i < 5; i++) recordError(s, 'b');
    const w = keyWeakness(s);
    expect(w.a).toBe(0);
    expect(Math.max(w.b, w.q)).toBe(1);
    expect(topWeakKeys(s, 2).sort()).toEqual(['b', 'q']);
  });

  it('ignores latencies from pauses', () => {
    const s = emptyStats();
    recordCorrect(s, 'a', 'x', 5000);
    expect(s.keys.a).toEqual({ n: 1, err: 0, lat: 0, latN: 0 });
  });

  it('finds the slowest bigram and merges', () => {
    const a = emptyStats();
    const b = emptyStats();
    for (let i = 0; i < 3; i++) {
      recordCorrect(a, 'r', 'b', 300);
      recordCorrect(b, 'h', 't', 120);
    }
    mergeStats(a, b);
    expect(nemesisBigram(a)?.bigram).toBe('br');
    expect(a.keys.h.n).toBe(3);
    recordError(a, 'h');
    expect(accuracy(a)).toBeCloseTo(6 / 7);
  });
});
