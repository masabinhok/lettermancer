/**
 * Practice: Monkeytype-style tests (timed, word counts, quotes) and Keybr-style adaptive lessons.
 * The cursor advances only on the correct key, like combat; every miss counts against accuracy.
 */
import { QUOTES } from './content/quotes';
import WORDS from './content/words.json';
import { makeRng, pick, type Rng } from './rng';
import { emptyStats, recordCorrect, recordError, type Stats } from './stats';

export type PracticeMode = 'time' | 'words' | 'quote' | 'lesson';

export interface PracticeConfig {
  mode: PracticeMode;
  /** seconds for time mode, word count for words/lesson; ignored for quotes */
  amount: number;
  punctuation: boolean;
  numbers: boolean;
  seed: number;
  /** lesson mode: the letters unlocked so far, and the one to focus on */
  letters?: string;
  focus?: string;
}

export interface PracticeKey {
  /** ms since the first keystroke */
  at: number;
  ok: boolean;
}

export interface PracticeState {
  config: PracticeConfig;
  text: string;
  /** characters typed correctly so far (the cursor) */
  pos: number;
  errors: number;
  /** positions where a mistake happened */
  missedAt: number[];
  /** clock time of the first keystroke */
  startAt: number | null;
  /** latest clock time seen */
  now: number;
  done: boolean;
  keys: PracticeKey[];
  stats: Stats;
  lastCorrectAt: number | null;
  /** where the quote came from, in quote mode */
  source: string | null;
}

/** Letters in the order the adaptive lessons unlock them (most common first). */
export const LESSON_ORDER = 'enitrlsauodychgmpbkvwfzxqj';
export const LESSON_START = 6;

const COMMON = (WORDS as string[]).filter((w) => w.length >= 2 && w.length <= 8);
const PUNCT_END = ['.', ',', ',', '.', '?', '!', ';', ':'];

function pickWord(rng: Rng): string {
  // Lean toward short, common words the way real text does.
  const short = rng() < 0.55;
  for (let i = 0; i < 20; i++) {
    const w = pick(rng, COMMON);
    if (!short || w.length <= 5) return w;
  }
  return pick(rng, COMMON);
}

function decorate(words: string[], rng: Rng, punctuation: boolean, numbers: boolean): string[] {
  const out: string[] = [];
  let capitalize = punctuation;
  for (let w of words) {
    if (numbers && rng() < 0.12) w = String(Math.floor(rng() * (rng() < 0.5 ? 100 : 10000)));
    if (punctuation) {
      if (capitalize) w = w[0].toUpperCase() + w.slice(1);
      capitalize = false;
      if (rng() < 0.18) {
        const p = pick(rng, PUNCT_END);
        w += p;
        capitalize = p === '.' || p === '?' || p === '!';
      } else if (rng() < 0.04) w = `"${w}"`;
    }
    out.push(w);
  }
  return out;
}

/** Words that use only the given letters, for adaptive lessons. Falls back to pronounceable pseudo-words. */
export function lessonWords(letters: string, focus: string, count: number, rng: Rng): string[] {
  const allowed = new Set(letters);
  const pool = COMMON.filter((w) => w.length >= 3 && w.length <= 7 && [...w].every((c) => allowed.has(c)));
  const withFocus = pool.filter((w) => w.includes(focus));
  const vowels = [...letters].filter((c) => 'aeiouy'.includes(c));
  const consonants = [...letters].filter((c) => !'aeiouy'.includes(c));
  const pseudo = () => {
    let w = '';
    const len = 3 + Math.floor(rng() * 4);
    for (let i = 0; i < len; i++) w += pick(rng, i % 2 === 0 ? consonants : vowels.length ? vowels : consonants);
    if (!w.includes(focus)) w = focus + w.slice(1);
    return w;
  };
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const useFocus = rng() < 0.5;
    const source = useFocus ? withFocus : pool;
    out.push(source.length >= 8 ? pick(rng, source) : pseudo());
  }
  return out;
}

/** How many words to lay out up front for a timed test (more are added if you're fast). */
const TIME_WORDS = 150;

export function createPractice(config: PracticeConfig): PracticeState {
  const rng = makeRng(config.seed);
  let text: string;
  let source: string | null = null;
  if (config.mode === 'quote') {
    const q = pick(rng, QUOTES);
    text = q.text;
    source = q.source;
  } else if (config.mode === 'lesson') {
    const letters = config.letters ?? LESSON_ORDER.slice(0, LESSON_START);
    text = lessonWords(letters, config.focus ?? letters[letters.length - 1], config.amount, rng).join(' ');
  } else {
    const n = config.mode === 'time' ? TIME_WORDS : config.amount;
    const words = Array.from({ length: n }, () => pickWord(rng));
    text = decorate(words, rng, config.punctuation, config.numbers).join(' ');
  }
  return {
    config,
    text,
    pos: 0,
    errors: 0,
    missedAt: [],
    startAt: null,
    now: 0,
    done: false,
    keys: [],
    stats: emptyStats(),
    lastCorrectAt: null,
    source,
  };
}

/** Handle a keystroke at clock time `at`. Returns whether it was correct. */
export function pressPractice(s: PracticeState, key: string, at: number): boolean {
  if (s.done) return false;
  s.startAt ??= at;
  advancePractice(s, at);
  if (s.done) return false;
  const expected = s.text[s.pos];
  const t = at - s.startAt;
  if (key !== expected) {
    s.errors++;
    if (!s.missedAt.includes(s.pos)) s.missedAt.push(s.pos);
    if (/[a-z]/i.test(expected)) recordError(s.stats, expected.toLowerCase());
    s.keys.push({ at: t, ok: false });
    return false;
  }
  const prev = s.pos > 0 ? s.text[s.pos - 1].toLowerCase() : null;
  const latency = prev && /[a-z]/.test(prev) && s.lastCorrectAt !== null ? at - s.lastCorrectAt : null;
  if (/[a-z]/i.test(expected)) recordCorrect(s.stats, expected.toLowerCase(), prev, latency);
  s.lastCorrectAt = at;
  s.pos++;
  s.keys.push({ at: t, ok: true });
  // Timed tests never run out of words.
  if (s.config.mode === 'time' && s.text.length - s.pos < 60) {
    const rng = makeRng(s.config.seed + s.text.length);
    s.text +=
      ' ' +
      decorate(
        Array.from({ length: 50 }, () => pickWord(rng)),
        rng,
        s.config.punctuation,
        s.config.numbers,
      ).join(' ');
  }
  if (s.config.mode !== 'time' && s.pos >= s.text.length) {
    s.done = true;
    s.now = at;
  }
  return true;
}

/** Move the clock; ends a timed test when time is up. */
export function advancePractice(s: PracticeState, at: number): void {
  if (s.done || s.startAt === null) return;
  s.now = Math.max(s.now, at);
  if (s.config.mode === 'time' && s.now - s.startAt >= s.config.amount * 1000) {
    s.done = true;
    s.now = s.startAt + s.config.amount * 1000;
  }
}

export interface SecondSample {
  second: number;
  /** average wpm from the start up to this second */
  wpm: number;
  /** raw wpm within this second */
  raw: number;
  errors: number;
}

export interface PracticeResult {
  mode: PracticeMode;
  /** test id, e.g. "time-30" or "words-25-punct" */
  testId: string;
  seconds: number;
  wpm: number;
  raw: number;
  accuracy: number;
  /** 0-100: how even your pace was */
  consistency: number;
  correct: number;
  errors: number;
  series: SecondSample[];
  /** letters you slowed down on, slowest first */
  slowLetters: { key: string; ms: number }[];
  source: string | null;
}

export function testId(c: PracticeConfig): string {
  if (c.mode === 'quote') return 'quote';
  if (c.mode === 'lesson') return 'lesson';
  return `${c.mode}-${c.amount}${c.punctuation ? '-punct' : ''}${c.numbers ? '-num' : ''}`;
}

export function summarizePractice(s: PracticeState): PracticeResult {
  const ms = s.startAt === null ? 0 : Math.max(1, s.now - s.startAt);
  const minutes = ms / 60000;
  const correct = s.keys.filter((k) => k.ok).length;
  const errors = s.keys.length - correct;
  const secs = Math.max(1, Math.ceil(ms / 1000));
  const series: SecondSample[] = [];
  let cumulative = 0;
  for (let i = 0; i < secs; i++) {
    const inSec = s.keys.filter((k) => k.at >= i * 1000 && k.at < (i + 1) * 1000);
    const ok = inSec.filter((k) => k.ok).length;
    cumulative += ok;
    series.push({
      second: i + 1,
      wpm: Math.round(cumulative / 5 / ((i + 1) / 60)),
      raw: Math.round((inSec.length / 5) * 60),
      errors: inSec.length - ok,
    });
  }
  const raws = series.map((x) => x.raw);
  const mean = raws.reduce((a, b) => a + b, 0) / raws.length;
  const sd = Math.sqrt(raws.reduce((a, b) => a + (b - mean) ** 2, 0) / raws.length);
  const slowLetters = Object.entries(s.stats.keys)
    .filter(([, v]) => v.latN >= 2)
    .map(([key, v]) => ({ key, ms: Math.round(v.lat / v.latN) }))
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 5);
  return {
    mode: s.config.mode,
    testId: testId(s.config),
    seconds: Math.round(ms / 1000),
    wpm: minutes ? Math.round(correct / 5 / minutes) : 0,
    raw: minutes ? Math.round(s.keys.length / 5 / minutes) : 0,
    accuracy: s.keys.length ? correct / s.keys.length : 1,
    consistency: mean ? Math.max(0, Math.min(100, Math.round(100 * (1 - sd / mean)))) : 0,
    correct,
    errors,
    series,
    slowLetters,
    source: s.source,
  };
}

// ---------- adaptive lessons ----------

/** A letter is learned when you type it this fast and this cleanly, often enough. */
export const LESSON_TARGET = { samples: 20, ms: 330, errorRate: 0.06 };

/** The letter to drill: the newest one until it's learned, then the weakest. */
export function lessonFocus(letters: string, stats: Stats): string {
  const newest = letters[letters.length - 1];
  if (!letterLearned(newest, stats)) return newest;
  let worst = newest;
  let worstMs = -1;
  for (const k of letters) {
    const v = stats.keys[k];
    const ms = v && v.latN ? v.lat / v.latN : 999;
    if (ms > worstMs) {
      worst = k;
      worstMs = ms;
    }
  }
  return worst;
}

export function letterLearned(k: string, stats: Stats): boolean {
  const v = stats.keys[k];
  if (!v || v.n + v.err < LESSON_TARGET.samples || !v.latN) return false;
  return v.lat / v.latN <= LESSON_TARGET.ms && v.err / (v.n + v.err) <= LESSON_TARGET.errorRate;
}

/** Progress of one letter toward learned, 0..1. */
export function letterProgress(k: string, stats: Stats): number {
  const v = stats.keys[k];
  if (!v) return 0;
  const samples = Math.min(1, (v.n + v.err) / LESSON_TARGET.samples);
  const speed = v.latN ? Math.min(1, LESSON_TARGET.ms / (v.lat / v.latN)) : 0;
  const acc = v.n + v.err ? Math.min(1, LESSON_TARGET.errorRate / Math.max(0.001, v.err / (v.n + v.err))) : 0;
  return Math.min(samples, speed, acc);
}
