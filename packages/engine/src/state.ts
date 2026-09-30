import type { BlessingId, KeyMods, RelicId } from './mods';
import type { OathLevels } from './content/oaths';
import type { Stats } from './stats';

export type NodeKind = 'fight' | 'elite' | 'shop' | 'event' | 'boss';
export type BossRule = 'hydra' | 'mirror' | 'blackout' | 'redactor' | 'grammarian' | 'wyrm';
export type StarterId = 'apprentice' | 'glassblower' | 'cryomancer' | 'tycoon';
export type MuseId = 'ignis' | 'glacia' | 'volta' | 'aurum' | 'resona' | 'aegis';

/** What a door promises before you walk through it. */
export type DoorReward = { kind: 'muse'; muse: MuseId } | { kind: 'coins' } | { kind: 'heal' } | { kind: 'relic' };

export interface Door {
  node: NodeKind;
  reward: DoorReward | null;
}

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

/** Permanent bonuses the player brings into a run (from meta progression). Plain numbers, so replays stay exact. */
export interface RunBonuses {
  maxHp: number;
  startCoins: number;
  startCombo: number;
  /** extra reward choices on boon screens */
  extraChoices: number;
  /** free rerolls of a reward screen per run */
  rerolls: number;
  /** revive once at this fraction of max HP (0 = none) */
  secondWind: number;
  /** multiplier for ink earned (meta currency) */
  inkBonus: number;
  /** first muse boon of the run is at least this rare */
  firstBoonRarity: 0 | 1 | 2 | 3;
}

export const NO_BONUSES: RunBonuses = {
  maxHp: 0,
  startCoins: 0,
  startCombo: 0,
  extraChoices: 0,
  rerolls: 0,
  secondWind: 0,
  inkBonus: 0,
  firstBoonRarity: 0,
};

export interface Run {
  seed: number;
  starter: StarterId;
  hp: number;
  maxHp: number;
  coins: number;
  keyMods: KeyMods;
  relics: RelicId[];
  blessings: BlessingId[];
  oaths: OathLevels;
  bonuses: RunBonuses;
  /** 1-based */
  act: number;
  /** rooms cleared in this act (the boss is room ROOMS_PER_ACT) */
  room: number;
  bosses: BossRule[];
  /** combo carried into the next fight */
  carryCombo: number;
  /** shield carried between fights (Bulwark) */
  carryShield: number;
  /** a revive is still available */
  secondWindLeft: boolean;
  /** Gentle pace: slower, weaker enemies for learners. Not eligible for leaderboards. */
  gentle: boolean;
  rerollsLeft: number;
  totals: RunTotals;
  /** typing stats for this run only (lifetime stats live in storage) */
  stats: Stats;
  result: 'won' | 'lost' | null;
}

export type EnemyKind = 'normal' | 'elite' | 'boss' | 'minion';

export type Trait =
  /** words shorter than 6 letters deal half damage */
  | 'armored'
  /** its word changes every few seconds */
  | 'shifter'
  /** splits in two when it dies */
  | 'splitter'
  /** its hits also drain your combo */
  | 'thief'
  /** heals the most wounded ally */
  | 'healer'
  /** attacks faster after each attack */
  | 'enrage'
  /** shields its allies */
  | 'warden'
  /** summons minions */
  | 'summoner'
  /** quick, light attacks */
  | 'quick';

export interface Enemy {
  id: number;
  kind: EnemyKind;
  name: string;
  glyph: string;
  hp: number;
  maxHp: number;
  atk: number;
  word: string;
  /** indices of letters hidden from view (The Redactor) */
  masked: number[];
  /** combat time the current word appeared */
  shownAt: number;
  /** ms elapsed toward the next attack */
  intent: number;
  intentMs: number;
  burn: number;
  /** damage absorbed before HP */
  shield: number;
  minLen: number;
  maxLen: number;
  traits: Trait[];
  rule?: BossRule;
  /** boss phase, starting at 1 */
  phase: number;
  /** ms toward the next trait action (shift, heal, ward, summon) */
  traitClock: number;
}

export type EnemySpec = Omit<
  Enemy,
  'id' | 'word' | 'masked' | 'shownAt' | 'intent' | 'burn' | 'phase' | 'traitClock' | 'shield'
> & {
  shield?: number;
};
