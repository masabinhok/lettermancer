/** Per-key and per-bigram typing stats. Drives the heatmap and adaptive word picking. */

export interface KeyStat {
  /** correct presses */
  n: number;
  /** times this was the expected key but something else was pressed */
  err: number;
  /** summed latency (ms) of correct presses that had a measurable previous key */
  lat: number;
  latN: number;
}

export interface Stats {
  keys: Record<string, KeyStat>;
  bigrams: Record<string, { lat: number; n: number }>;
}

/** Gaps longer than this are thinking time, not typing time. */
export const MAX_LATENCY_MS = 2000;

export const emptyStats = (): Stats => ({ keys: {}, bigrams: {} });

const keyStat = (s: Stats, k: string): KeyStat => (s.keys[k] ??= { n: 0, err: 0, lat: 0, latN: 0 });

export function recordCorrect(s: Stats, key: string, prev: string | null, latencyMs: number | null): void {
  const k = keyStat(s, key);
  k.n++;
  if (prev && latencyMs !== null && latencyMs > 0 && latencyMs <= MAX_LATENCY_MS) {
    k.lat += latencyMs;
    k.latN++;
    const b = (s.bigrams[prev + key] ??= { lat: 0, n: 0 });
    b.lat += latencyMs;
    b.n++;
  }
}

export function recordError(s: Stats, expected: string): void {
  keyStat(s, expected).err++;
}

export function mergeStats(into: Stats, from: Stats): Stats {
  for (const [k, v] of Object.entries(from.keys)) {
    const t = keyStat(into, k);
    t.n += v.n;
    t.err += v.err;
    t.lat += v.lat;
    t.latN += v.latN;
  }
  for (const [k, v] of Object.entries(from.bigrams)) {
    const t = (into.bigrams[k] ??= { lat: 0, n: 0 });
    t.lat += v.lat;
    t.n += v.n;
  }
  return into;
}

const MIN_SAMPLES = 5;

/**
 * Weakness score per key in [0, 1]: how much slower than your average, plus error rate.
 * Keys with too few samples are left out.
 */
export function keyWeakness(s: Stats): Record<string, number> {
  const entries = Object.entries(s.keys).filter(([, v]) => v.n + v.err >= MIN_SAMPLES);
  let totLat = 0;
  let totN = 0;
  for (const [, v] of entries) {
    totLat += v.lat;
    totN += v.latN;
  }
  const avg = totN ? totLat / totN : 0;
  const raw: Record<string, number> = {};
  let max = 0;
  for (const [k, v] of entries) {
    const slow = avg && v.latN ? Math.max(0, v.lat / v.latN / avg - 1) : 0;
    const errRate = v.err / (v.n + v.err);
    const score = slow + errRate * 4;
    raw[k] = score;
    max = Math.max(max, score);
  }
  if (max > 0) for (const k in raw) raw[k] /= max;
  return raw;
}

export function topWeakKeys(s: Stats, n: number): string[] {
  return Object.entries(keyWeakness(s))
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

/** Slowest letter pair with enough samples. */
export function nemesisBigram(s: Stats, minSamples = 3): { bigram: string; ms: number } | null {
  let best: { bigram: string; ms: number } | null = null;
  for (const [bg, v] of Object.entries(s.bigrams)) {
    if (v.n < minSamples) continue;
    const ms = v.lat / v.n;
    if (!best || ms > best.ms) best = { bigram: bg, ms };
  }
  return best;
}

export function accuracy(s: Stats): number {
  let n = 0;
  let err = 0;
  for (const v of Object.values(s.keys)) {
    n += v.n;
    err += v.err;
  }
  return n + err ? n / (n + err) : 1;
}
