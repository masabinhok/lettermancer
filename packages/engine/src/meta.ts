import type { OathLevels } from './content/oaths';
import type { StarterId } from './state';

export type KeyboardMode = 'full' | 'compact' | 'hidden';
export const KEYBOARD_MODES: readonly KeyboardMode[] = ['full', 'compact', 'hidden'];

export interface Meta {
  runs: number;
  wins: number;
  bestAct: number;
  unlocked: StarterId[];
  lastStarter: StarterId;
  /** finished (or skipped) the tutorial */
  prologueDone: boolean;
  /** the Oaths the player has sworn for their next run */
  oaths: OathLevels;
  /** Gentle pace assist for the next run */
  gentle: boolean;
}

export const defaultMeta = (): Meta => ({
  runs: 0,
  wins: 0,
  bestAct: 0,
  unlocked: ['apprentice'],
  lastStarter: 'apprentice',
  prologueDone: false,
  oaths: {},
  gentle: false,
});

export interface UnlockCheck {
  act?: number;
  /** won an elite or boss fight without a single typo */
  flawlessElite?: boolean;
  coins?: number;
}

export const UNLOCK_ACT = 3;
export const UNLOCK_COINS = 60;

/** Returns starters newly unlocked by this milestone (and records them on meta). */
export function applyUnlocks(meta: Meta, check: UnlockCheck): StarterId[] {
  const earned: StarterId[] = [];
  const unlock = (id: StarterId, cond: boolean | undefined) => {
    if (cond && !meta.unlocked.includes(id)) {
      meta.unlocked.push(id);
      earned.push(id);
    }
  };
  unlock('glassblower', (check.act ?? 0) >= UNLOCK_ACT);
  unlock('cryomancer', check.flawlessElite);
  unlock('tycoon', (check.coins ?? 0) >= UNLOCK_COINS);
  return earned;
}
