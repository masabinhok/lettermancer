/**
 * Plain, immutable render data built from the live combat each frame.
 * Keeping this pure makes the combat screen trivially reactive and easy to test.
 */
import {
  blackoutVisibleMs,
  comboTier,
  COMBO_TIERS,
  intentRate,
  resolveWord,
  SHIFT_WARN_MS,
  TRAIT_EVERY,
  type Combat,
  type Enemy,
  type KeyBoon,
  type Run,
  type Trait,
} from '@lettermancer/engine';

/** How long before an attack lands the enemy visibly winds up. */
export const WINDUP_MS = 1000;

export type LetterState = 'done' | 'next' | 'rest';

export interface LetterSnap {
  ch: string;
  state: LetterState;
  boons: KeyBoon[];
  hidden: boolean;
  /** blotted out by The Redactor */
  masked: boolean;
}

export interface EnemySnap {
  id: number;
  kind: Enemy['kind'];
  name: string;
  glyph: string;
  rule: Enemy['rule'];
  traits: Trait[];
  phase: number;
  shield: number;
  /** a shifter is about to change its word */
  shifting: boolean;
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
  const rate = intentRate(run);
  const t = c.enemies.find((e) => e.id === c.targetId);
  const enemies = c.enemies.map((e): EnemySnap => {
    const typed = e === t ? c.typed.length : 0;
    const hidden = e.rule === 'blackout' && c.time - e.shownAt > blackoutVisibleMs(e);
    const msToHit = Math.max(0, (e.intentMs - e.intent) / rate);
    return {
      id: e.id,
      kind: e.kind,
      name: e.name,
      glyph: e.glyph,
      rule: e.rule,
      traits: e.traits,
      phase: e.phase,
      shield: e.shield,
      shifting: e.traits.includes('shifter') && c.time - e.shownAt > TRAIT_EVERY.shifter! - SHIFT_WARN_MS,
      hp: e.hp,
      maxHp: e.maxHp,
      atk: e.atk,
      burn: e.burn,
      word: e.word,
      letters: [...e.word].map((ch, i) => ({
        ch,
        state: i < typed ? 'done' : i === typed && e === t ? 'next' : 'rest',
        boons: run.keyMods[ch.toLowerCase()] ?? [],
        hidden: hidden && i >= typed,
        masked: e.masked.includes(i) && i >= typed,
      })),
      intent: Math.max(0, Math.min(1, e.intent / e.intentMs)),
      msToHit,
      windup: e.intent > 0 && msToHit <= WINDUP_MS,
      targeted: e === t,
    };
  });
  const { tier, mult } = comboTier(c.combo, run.blessings);
  const prevAt = COMBO_TIERS[tier].at;
  const nextAt = COMBO_TIERS[tier + 1]?.at;
  return {
    time: c.time,
    enemies,
    typed: c.typed,
    targetId: c.targetId,
    nextKey: t ? (t.word[c.typed.length]?.toLowerCase() ?? null) : null,
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
      ? resolveWord(t.word, {
          keyMods: run.keyMods,
          relics: run.relics,
          blessings: run.blessings,
          combo: c.combo + (t.word.length - c.typed.length),
          firstWord: !c.firstWordDone,
          coins: run.coins,
          streak: c.streak,
        }).dmg
      : null,
    over: c.over,
  };
}
