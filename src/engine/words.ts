import type { Rng } from './rng';

export interface PickOptions {
  min: number;
  max: number;
  /** First letters already used by other enemies on screen — keeps targeting unambiguous. */
  excludeFirst?: ReadonlySet<string>;
  /** key -> weakness in [0,1] */
  weak?: Readonly<Record<string, number>>;
  /** keys carrying mods */
  modded?: ReadonlySet<string>;
  /** chance a word is chosen to drill weak keys */
  weakBias?: number;
  /** chance a word is chosen to feature modded keys */
  modBias?: number;
}

export type PickReason = 'random' | 'weak' | 'mod';

const CANDIDATES = 8;

/** Weighted pick of a key from key -> weight. */
function pickWeighted(rng: Rng, weights: Readonly<Record<string, number>>): string | null {
  let total = 0;
  for (const w of Object.values(weights)) total += w;
  if (total <= 0) return null;
  let r = rng() * total;
  for (const [k, w] of Object.entries(weights)) {
    r -= w;
    if (r <= 0) return k;
  }
  return null;
}

export class WordBank {
  private byLen = new Map<number, string[]>();
  private byLetter = new Map<string, string[]>();

  constructor(words: readonly string[]) {
    for (const w of words) {
      const list = this.byLen.get(w.length);
      if (list) list.push(w);
      else this.byLen.set(w.length, [w]);
      for (const ch of new Set(w)) {
        const l = this.byLetter.get(ch);
        if (l) l.push(w);
        else this.byLetter.set(ch, [w]);
      }
    }
  }

  private randomWord(rng: Rng, min: number, max: number, excludeFirst?: ReadonlySet<string>): string | null {
    for (let tries = 0; tries < 50; tries++) {
      const len = min + Math.floor(rng() * (max - min + 1));
      const list = this.byLen.get(len);
      if (!list?.length) continue;
      const w = list[Math.floor(rng() * list.length)];
      if (!excludeFirst?.has(w[0])) return w;
    }
    return null;
  }

  /** Random word containing `letter` within the length range. */
  private wordWith(rng: Rng, letter: string, min: number, max: number, excludeFirst?: ReadonlySet<string>): string | null {
    const list = this.byLetter.get(letter);
    if (!list?.length) return null;
    for (let tries = 0; tries < 200; tries++) {
      const w = list[Math.floor(rng() * list.length)];
      if (w.length >= min && w.length <= max && !excludeFirst?.has(w[0])) return w;
    }
    return null;
  }

  pick(opts: PickOptions, rng: Rng): { word: string; reason: PickReason } {
    const { min, max, excludeFirst, weak, modded, weakBias = 0.3, modBias = 0.25 } = opts;
    const fallback = () => ({ word: this.randomWord(rng, min, max, excludeFirst) ?? 'type', reason: 'random' as const });
    const roll = rng();

    let reason: PickReason;
    let letterWeights: Record<string, number>;
    let score: (w: string) => number;
    if (weak && roll < weakBias) {
      reason = 'weak';
      letterWeights = { ...weak };
      // Average weakness per letter, so long words don't win just for being long.
      score = (w) => {
        let s = 0;
        for (const ch of w) s += weak[ch] ?? 0;
        return s / w.length;
      };
    } else if (modded?.size && roll < weakBias + modBias) {
      reason = 'mod';
      letterWeights = Object.fromEntries([...modded].map((k) => [k, 1]));
      score = (w) => {
        let s = 0;
        for (const ch of w) if (modded.has(ch)) s++;
        return s;
      };
    } else {
      return fallback();
    }

    const letter = pickWeighted(rng, letterWeights);
    if (!letter) return fallback();
    let best: string | null = null;
    let bestScore = -1;
    for (let i = 0; i < CANDIDATES; i++) {
      const w = this.wordWith(rng, letter, min, max, excludeFirst);
      if (!w) break;
      const s = score(w);
      if (s > bestScore) {
        best = w;
        bestScore = s;
      }
    }
    return best ? { word: best, reason } : fallback();
  }
}

/** Share of all letters in `words` that are each letter, in [0, 1]. */
export function letterShare(words: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  let total = 0;
  for (const w of words)
    for (const ch of w) {
      counts[ch] = (counts[ch] ?? 0) + 1;
      total++;
    }
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(counts)) out[k] = n / total;
  return out;
}
