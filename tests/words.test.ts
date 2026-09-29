import { describe, expect, it } from 'vitest';
import { makeRng } from '../src/engine/rng';
import { letterShare, WordBank } from '../src/engine/words';
import words from '../src/data/words.json';

const bank = new WordBank(words);

describe('WordBank', () => {
  it('respects length bounds and excluded first letters', () => {
    const rng = makeRng(3);
    const exclude = new Set(['s', 't', 'a']);
    for (let i = 0; i < 300; i++) {
      const { word } = bank.pick({ min: 4, max: 6, excludeFirst: exclude }, rng);
      expect(word.length).toBeGreaterThanOrEqual(4);
      expect(word.length).toBeLessThanOrEqual(6);
      expect(exclude.has(word[0])).toBe(false);
    }
  });

  it('biases toward weak keys about as often as configured', () => {
    const rng = makeRng(11);
    let weakPicks = 0;
    let withQ = 0;
    const N = 2000;
    for (let i = 0; i < N; i++) {
      const r = bank.pick({ min: 4, max: 8, weak: { q: 1 }, weakBias: 0.3, modBias: 0 }, rng);
      if (r.reason === 'weak') weakPicks++;
      if (r.word.includes('q')) withQ++;
    }
    // ~30% of picks target weak keys.
    expect(weakPicks / N).toBeGreaterThan(0.25);
    expect(weakPicks / N).toBeLessThan(0.35);
    // Baseline q frequency in random words is ~1-2%.
    expect(withQ / N).toBeGreaterThan(0.25);
  });

  it('features modded keys', () => {
    const rng = makeRng(5);
    let withZ = 0;
    const N = 1000;
    for (let i = 0; i < N; i++) {
      if (bank.pick({ min: 4, max: 8, modded: new Set(['z']), weakBias: 0, modBias: 1 }, rng).word.includes('z')) withZ++;
    }
    expect(withZ / N).toBeGreaterThan(0.95);
  });

  it('computes letter share', () => {
    expect(letterShare(['aab', 'b'])).toEqual({ a: 0.5, b: 0.5 });
    const share = letterShare(words);
    expect(share.e).toBeGreaterThan(share.q * 10);
  });
});
