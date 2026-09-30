/**
 * Plain, immutable render data built from the live combat each frame.
 * Keeping this pure makes the combat screen trivially reactive and easy to test.
 */
import { comboTier, COMBO_TIERS, resolveWord, type Combat, type Enemy, type ModId, type Run } from '@keycraft/engine';

/** Blackout words vanish this long after appearing. */
export const BLACKOUT_VISIBLE_MS = 1400;
/** How long before an attack lands the enemy visibly winds up. */
export const WINDUP_MS = 1000;

export type LetterState = 'done' | 'next' | 'rest';

export interface LetterSnap {
  ch: string;
  state: LetterState;
  mods: ModId[];
  hidden: boolean;
}

export interface EnemySnap {
  id: number;
  kind: Enemy['kind'];
  name: string;
  glyph: string;
  rule: Enemy['rule'];
  hp: number;
  maxHp: number;
  atk: number;
  burn: number;
  word: string;
  letters: LetterSnap[];
  /** 0..1 toward the next attack */
  intent: number;
  msToHit: number;
  windup: boolean;
  targeted: boolean;
}

export interface CombatSnap {
  time: number;
  enemies: EnemySnap[];
  typed: string;
  targetId: number | null;
  nextKey: string | null;
  combo: number;
  tier: number;
  mult: number;
  /** progress 0..1 to the next combo tier */
  tierProgress: number;
  shield: number;
  hp: number;
  maxHp: number;
  coins: number;
  /** damage the current target word will deal if finished now */
  preview: number | null;
  over: Combat['over'];
}

export function combatSnapshot(c: Combat, run: Run): CombatSnap {
  const rate = run.relics.includes('hourglass') ? 0.85 : 1;
  const t = c.enemies.find((e) => e.id === c.targetId);
  const enemies = c.enemies.map((e): EnemySnap => {
    const typed = e === t ? c.typed.length : 0;
    const hidden = e.rule === 'blackout' && c.time - e.shownAt > BLACKOUT_VISIBLE_MS;
    const msToHit = Math.max(0, (e.intentMs - e.intent) / rate);
    return {
      id: e.id,
      kind: e.kind,
      name: e.name,
      glyph: e.glyph,
      rule: e.rule,
      hp: e.hp,
      maxHp: e.maxHp,
      atk: e.atk,
      burn: e.burn,
      word: e.word,
      letters: [...e.word].map((ch, i) => ({
        ch,
        state: i < typed ? 'done' : i === typed && e === t ? 'next' : 'rest',
        mods: run.keyMods[ch] ?? [],
        hidden: hidden && i >= typed,
      })),
      intent: Math.max(0, Math.min(1, e.intent / e.intentMs)),
      msToHit,
      windup: e.intent > 0 && msToHit <= WINDUP_MS,
      targeted: e === t,
    };
  });
  const { tier, mult } = comboTier(c.combo);
  const prevAt = COMBO_TIERS[tier].at;
  const nextAt = COMBO_TIERS[tier + 1]?.at;
  return {
    time: c.time,
    enemies,
    typed: c.typed,
    targetId: c.targetId,
    nextKey: t ? (t.word[c.typed.length] ?? null) : null,
    combo: c.combo,
    tier,
    mult,
    tierProgress: nextAt ? (c.combo - prevAt) / (nextAt - prevAt) : 1,
    shield: c.shield,
    hp: run.hp,
    maxHp: run.maxHp,
    coins: run.coins,
    // Combo grows by one per remaining letter, so preview with the combo you'd finish on.
    preview: t
      ? resolveWord(t.word, run.keyMods, run.relics, c.combo + (t.word.length - c.typed.length), !c.firstWordDone).dmg
      : null,
    over: c.over,
  };
}
