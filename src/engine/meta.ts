import type { StarterId } from './state';

export type KeyboardMode = 'full' | 'compact' | 'hidden';
export const KEYBOARD_MODES: readonly KeyboardMode[] = ['full', 'compact', 'hidden'];

export interface Meta {
  runs: number;
  wins: number;
  bestAct: number;
  unlocked: StarterId[];
  lastStarter: StarterId;
  fingerHints: boolean;
  keyboard: KeyboardMode;
  sound: boolean;
}

export const defaultMeta = (): Meta => ({
  runs: 0,
  wins: 0,
  bestAct: 0,
  unlocked: ['apprentice'],
  lastStarter: 'apprentice',
  fingerHints: true,
  keyboard: 'full',
  sound: true,
});

export interface UnlockCheck {
  act?: number;
  perfectFight?: boolean;
  coins?: number;
}

/** Returns starters newly unlocked by this milestone (and records them on meta). */
export function applyUnlocks(meta: Meta, check: UnlockCheck): StarterId[] {
  const earned: StarterId[] = [];
  const unlock = (id: StarterId, cond: boolean | undefined) => {
    if (cond && !meta.unlocked.includes(id)) {
      meta.unlocked.push(id);
      earned.push(id);
    }
  };
  unlock('glassblower', (check.act ?? 0) >= 2);
  unlock('cryomancer', check.perfectFight);
  unlock('tycoon', (check.coins ?? 0) >= 40);
  return earned;
}
