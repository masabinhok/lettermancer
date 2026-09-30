/**
 * The player's local profile: settings, meta progress, lifetime typing stats and run analytics.
 * Everything lives in localStorage until the player signs in (cloud sync layers on top later).
 */
import {
  applyUnlocks,
  defaultMeta,
  emptyStats,
  mergeStats,
  type KeyboardMode,
  type Meta,
  type RunReport,
  type StarterId,
  type Stats,
  type UnlockCheck,
} from '@keycraft/engine';

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

const KEYS = {
  settings: 'keycraft.settings.v1',
  meta: 'keycraft.meta.v1',
  stats: 'keycraft.stats.v1',
  analytics: 'keycraft.analytics.v1',
} as const;

const ANALYTICS_KEPT = 50;

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
}

class Profile {
  settings = $state<Settings>(readStore(KEYS.settings, defaultSettings));
  meta = $state<Meta>(readStore(KEYS.meta, defaultMeta));
  /** lifetime per-key stats; replaced (not mutated) so readers update */
  stats = $state.raw<Stats>(readStore(KEYS.stats, emptyStats));
  analytics = $state.raw<StoredReport[]>(readArray<StoredReport>(KEYS.analytics));

  saveSettings(): void {
    writeStore(KEYS.settings, this.settings);
  }

  saveMeta(): void {
    writeStore(KEYS.meta, this.meta);
  }

  addStats(fight: Stats): void {
    const next = mergeStats(structuredClone(this.stats), fight);
    this.stats = next;
    writeStore(KEYS.stats, next);
  }

  /** Apply milestone unlocks; returns newly unlocked starters. */
  unlock(check: UnlockCheck): StarterId[] {
    const earned = applyUnlocks(this.meta, check);
    if (earned.length) this.saveMeta();
    return earned;
  }

  recordRun(report: RunReport, seed: number, won: boolean, act: number): void {
    this.meta.runs++;
    if (won) this.meta.wins++;
    this.meta.bestAct = Math.max(this.meta.bestAct, won ? 4 : act);
    this.saveMeta();
    const entry: StoredReport = { ...report, date: new Date().toISOString(), seed };
    this.analytics = [entry, ...this.analytics].slice(0, ANALYTICS_KEPT);
    writeStore(KEYS.analytics, this.analytics);
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
