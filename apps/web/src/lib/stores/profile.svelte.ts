/**
 * The player's local profile: settings, meta progress, lifetime typing stats and run analytics.
 * Everything lives in localStorage; cloud sync layers on top when signed in.
 */
import {
  awardRun,
  applyUnlocks,
  checkProphecies,
  emptyStats,
  heat,
  keyMastery,
  mergeStats,
  migrateMeta,
  runScore,
  totalCorrect,
  type Award,
  type KeyboardMode,
  type Meta,
  type PracticeSummary,
  type ProphecyDef,
  type RunMachine,
  type RunReport,
  type StarterId,
  type Stats,
  type UnlockCheck,
  type RunConfig,
} from '@lettermancer/engine';

export type KeyboardLayout = 'qwerty' | 'dvorak' | 'colemak' | 'azerty';

export interface Settings {
  /** 0..1 */
  volume: number;
  sfx: number;
  music: number;
  fingerHints: boolean;
  keyboard: KeyboardMode;
  reducedMotion: 'system' | 'on' | 'off';
  fontScale: number;
  layout: KeyboardLayout;
  /** draw each power's symbol above empowered letters, so color isn't the only cue */
  powerSymbols: boolean;
}

export const defaultSettings = (): Settings => ({
  volume: 0.8,
  sfx: 1,
  music: 0.6,
  fingerHints: true,
  keyboard: 'compact',
  reducedMotion: 'system',
  fontScale: 1,
  layout: 'qwerty',
  powerSymbols: false,
});

export const STORE_KEYS = {
  settings: 'lettermancer.settings.v1',
  meta: 'lettermancer.meta.v1',
  stats: 'lettermancer.stats.v1',
  analytics: 'lettermancer.analytics.v1',
} as const;

const ANALYTICS_KEPT = 50;

/**
 * The game was called Keycraft before launch. Carry anything saved under the old name across once,
 * so nobody's progress, settings or run in progress is lost. Runs before anything reads storage.
 */
function migrateOldName(): void {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const old = localStorage.key(i);
      if (!old?.startsWith('keycraft.')) continue;
      const key = `lettermancer.${old.slice('keycraft.'.length)}`;
      if (localStorage.getItem(key) === null) localStorage.setItem(key, localStorage.getItem(old)!);
    }
  } catch {
    // Storage unavailable: nothing to carry over.
  }
}
migrateOldName();

export function readStore<T extends object>(key: string, fallback: () => T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback(), ...JSON.parse(raw) } : fallback();
  } catch {
    return fallback();
  }
}

export function writeStore(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable (private mode, quota): the game still works, it just forgets.
  }
}

export interface StoredReport extends RunReport {
  date: string;
  seed: number;
  mode: RunConfig['mode'];
  heat: number;
  gentle: boolean;
  score: number;
}

type Listener = () => void;

class Profile {
  settings = $state<Settings>(readStore(STORE_KEYS.settings, defaultSettings));
  meta = $state<Meta>(migrateMeta(readStore(STORE_KEYS.meta, () => ({}) as Meta)));
  /** lifetime per-key stats; replaced (not mutated) so readers update */
  stats = $state.raw<Stats>(readStore(STORE_KEYS.stats, emptyStats));
  analytics = $state.raw<StoredReport[]>(readArray<StoredReport>(STORE_KEYS.analytics));
  private listeners = new Set<Listener>();

  /** Called after any change worth syncing to the cloud. */
  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private changed(): void {
    for (const fn of this.listeners) fn();
  }

  saveSettings(): void {
    writeStore(STORE_KEYS.settings, this.settings);
  }

  saveMeta(): void {
    writeStore(STORE_KEYS.meta, this.meta);
    this.changed();
  }

  saveStats(): void {
    writeStore(STORE_KEYS.stats, this.stats);
  }

  addStats(fight: Stats): void {
    this.stats = mergeStats(structuredClone(this.stats), fight);
    this.saveStats();
  }

  /** Apply milestone unlocks; returns newly unlocked starters. */
  unlock(check: UnlockCheck): StarterId[] {
    const earned = applyUnlocks(this.meta, check);
    if (earned.length) this.saveMeta();
    return earned;
  }

  private snapshot() {
    return { mastery: keyMastery(this.stats), totalKeys: totalCorrect(this.stats) };
  }

  /** Keep the quickest win by the run stopwatch. */
  recordWinTime(ms: number): void {
    if (ms > 0 && (!this.meta.fastestWinMs || ms < this.meta.fastestWinMs)) {
      this.meta.fastestWinMs = Math.round(ms);
      this.saveMeta();
    }
  }

  /** Record a finished run and hand out Ink, Gold Leaf, keepsakes and prophecies. */
  finishRun(m: RunMachine, abandoned = false): Award {
    const report: RunReport = abandoned ? { ...m.report, result: 'lost', act: m.run.act, room: m.run.room } : m.report;
    const score = runScore(m.run);
    const award = awardRun(this.meta, { report, run: m.run, config: m.config, score }, this.snapshot());
    this.saveMeta();
    const entry: StoredReport = {
      ...report,
      date: new Date().toISOString(),
      seed: m.config.seed,
      mode: m.config.mode,
      heat: heat(m.config.oaths),
      gentle: m.config.gentle,
      score,
    };
    this.analytics = [entry, ...this.analytics].slice(0, ANALYTICS_KEPT);
    writeStore(STORE_KEYS.analytics, this.analytics);
    return award;
  }

  /** Check prophecies after a practice test (or any time stats change). */
  checkProphecies(practice?: PracticeSummary): ProphecyDef[] {
    const earned = checkProphecies(this.meta, { ...this.snapshot(), practice });
    if (earned.length) this.saveMeta();
    return earned;
  }

  /** Replace everything local with data from the cloud (used on first sign-in merge). */
  replaceAll(data: { meta: Meta; stats: Stats }): void {
    this.meta = migrateMeta(data.meta);
    this.stats = data.stats;
    writeStore(STORE_KEYS.meta, this.meta);
    this.saveStats();
  }
}

function readArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export const profile = new Profile();
