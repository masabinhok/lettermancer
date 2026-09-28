import type { KeyMods, RelicId } from './mods';
import type { Stats } from './stats';

export type NodeKind = 'fight' | 'elite' | 'shop' | 'boss';
export type BossRule = 'hydra' | 'mirror' | 'blackout';
export type StarterId = 'apprentice' | 'glassblower' | 'cryomancer' | 'tycoon';

export interface RunTotals {
  correct: number;
  errors: number;
  activeMs: number;
  maxCombo: number;
  words: number;
  fights: number;
  perfectFights: number;
  peakWpm: number;
}

export interface Run {
  seed: number;
  starter: StarterId;
  hp: number;
  maxHp: number;
  coins: number;
  keyMods: KeyMods;
  relics: RelicId[];
  /** 1-based */
  act: number;
  /** index into ACT_LAYOUT */
  node: number;
  bosses: BossRule[];
  totals: RunTotals;
  /** typing stats for this run only (lifetime stats live in storage) */
  stats: Stats;
  result: 'won' | 'lost' | null;
}

export type EnemyKind = 'normal' | 'elite' | 'boss' | 'head';

export interface Enemy {
  id: number;
  kind: EnemyKind;
  name: string;
  glyph: string;
  hp: number;
  maxHp: number;
  atk: number;
  word: string;
  /** combat time the current word appeared (Blackout hides words after a moment) */
  shownAt: number;
  /** ms elapsed toward the next attack */
  intent: number;
  intentMs: number;
  burn: number;
  minLen: number;
  maxLen: number;
  rule?: BossRule;
}

export type EnemySpec = Omit<Enemy, 'id' | 'word' | 'shownAt' | 'intent' | 'burn'>;
