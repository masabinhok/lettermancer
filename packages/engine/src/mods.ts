export type ModId = 'ember' | 'frost' | 'spark' | 'gold' | 'echo' | 'glass' | 'ward';

export interface ModDef {
  id: ModId;
  name: string;
  glyph: string;
  color: string;
  desc: string;
  cost: number;
}

export const MODS: Record<ModId, ModDef> = {
  ember: { id: 'ember', name: 'Ember', glyph: '▲', color: '#ff6b35', desc: 'Each letter applies 2 Burn (damage every second, then fades).', cost: 7 },
  frost: { id: 'frost', name: 'Frost', glyph: '◆', color: '#5ee7ff', desc: "Each letter pushes the target's attack back 0.7s.", cost: 6 },
  spark: { id: 'spark', name: 'Spark', glyph: 'ϟ', color: '#ffe14d', desc: 'Each letter zaps another enemy for 3 (scaled by combo).', cost: 7 },
  gold: { id: 'gold', name: 'Gold', glyph: '●', color: '#f5b83d', desc: 'Each letter earns +1 coin.', cost: 5 },
  echo: { id: 'echo', name: 'Echo', glyph: '◎', color: '#b48cff', desc: 'Letter counts double for damage.', cost: 6 },
  glass: { id: 'glass', name: 'Glass', glyph: '◇', color: '#e8f4ff', desc: 'Letter deals ×3 — but mistyping it shatters the Glass.', cost: 8 },
  ward: { id: 'ward', name: 'Ward', glyph: '■', color: '#6bdc8a', desc: 'Each letter grants 1 Shield for this fight.', cost: 6 },
};

export const MOD_IDS = Object.keys(MODS) as ModId[];

export type RelicId =
  | 'twin-fangs'
  | 'no-e'
  | 'marathon'
  | 'steady-hands'
  | 'whetstone'
  | 'hourglass'
  | 'interest'
  | 'vampire'
  | 'first-strike'
  | 'thorns';

export interface RelicDef {
  id: RelicId;
  name: string;
  glyph: string;
  desc: string;
  cost: number;
}

export const RELICS: Record<RelicId, RelicDef> = {
  'twin-fangs': { id: 'twin-fangs', name: 'Twin Fangs', glyph: 'ᵂ', desc: 'Words with a double letter (ll, ee, ss…) deal ×2.', cost: 16 },
  'no-e': { id: 'no-e', name: 'Lipogram', glyph: 'Ɇ', desc: 'Words without the letter E deal +50%.', cost: 14 },
  marathon: { id: 'marathon', name: 'Marathon', glyph: '∞', desc: 'Words of 8+ letters heal 2 HP.', cost: 15 },
  'steady-hands': { id: 'steady-hands', name: 'Steady Hands', glyph: '≈', desc: 'A typo halves your combo instead of resetting it.', cost: 18 },
  whetstone: { id: 'whetstone', name: 'Whetstone', glyph: '⟋', desc: '+2 base damage on every word.', cost: 14 },
  hourglass: { id: 'hourglass', name: 'Hourglass', glyph: '⧗', desc: 'Enemies attack 15% slower.', cost: 18 },
  interest: { id: 'interest', name: 'Interest', glyph: '%', desc: 'After each fight, +1 coin per 5 held (max 5).', cost: 12 },
  vampire: { id: 'vampire', name: 'Fang Ink', glyph: '†', desc: 'Every 25 combo heals 3 HP.', cost: 16 },
  'first-strike': { id: 'first-strike', name: 'First Strike', glyph: '»', desc: 'Your first word each fight deals ×3.', cost: 13 },
  thorns: { id: 'thorns', name: 'Thorns', glyph: '✱', desc: 'When hit, deal 4 damage back to the attacker.', cost: 13 },
};

export const RELIC_IDS = Object.keys(RELICS) as RelicId[];

export type KeyMods = Record<string, ModId[]>;
export const MAX_MODS_PER_KEY = 2;

/** Install a mod on a key. A key holds two mods; installing a third pushes out the oldest. */
export function installMod(keyMods: KeyMods, key: string, mod: ModId): { keyMods: KeyMods; replaced: ModId | null } {
  const current = keyMods[key] ?? [];
  const next = [...current, mod];
  const replaced = next.length > MAX_MODS_PER_KEY ? next.shift()! : null;
  return { keyMods: { ...keyMods, [key]: next }, replaced };
}

export function removeMod(keyMods: KeyMods, key: string, mod: ModId): KeyMods {
  const current = keyMods[key] ?? [];
  const i = current.indexOf(mod);
  if (i < 0) return keyMods;
  const next = current.filter((_, j) => j !== i);
  const out = { ...keyMods, [key]: next };
  if (next.length === 0) delete out[key];
  return out;
}

export const COMBO_TIERS = [
  { at: 0, mult: 1 },
  { at: 10, mult: 1.5 },
  { at: 25, mult: 2 },
  { at: 50, mult: 3 },
  { at: 100, mult: 4 },
] as const;

export function comboTier(combo: number): { tier: number; mult: number } {
  let tier = 0;
  for (let i = 0; i < COMBO_TIERS.length; i++) if (combo >= COMBO_TIERS[i].at) tier = i;
  return { tier, mult: COMBO_TIERS[tier].mult };
}

export interface WordResult {
  dmg: number;
  crit: boolean;
  burn: number;
  frost: number;
  sparks: number;
  sparkDmg: number;
  coins: number;
  shield: number;
  heal: number;
}

export const SPARK_DAMAGE = 3;
export const BURN_PER_EMBER = 2;
export const FROST_PUSH_MS = 700;

/** Resolve everything a completed word does. Pure — used by combat and tests. */
export function resolveWord(
  word: string,
  keyMods: KeyMods,
  relics: readonly RelicId[],
  combo: number,
  firstWord: boolean,
): WordResult {
  let base = 0;
  const r: WordResult = { dmg: 0, crit: false, burn: 0, frost: 0, sparks: 0, sparkDmg: 0, coins: 0, shield: 0, heal: 0 };
  for (const ch of word) {
    const mods = keyMods[ch] ?? [];
    let v = 1;
    for (const m of mods) if (m === 'echo') v += 1;
    for (const m of mods) if (m === 'glass') v *= 3;
    base += v;
    for (const m of mods) {
      if (m === 'ember') r.burn += BURN_PER_EMBER;
      else if (m === 'frost') r.frost += 1;
      else if (m === 'spark') r.sparks += 1;
      else if (m === 'gold') r.coins += 1;
      else if (m === 'ward') r.shield += 1;
    }
  }
  const has = (id: RelicId) => relics.includes(id);
  if (has('whetstone')) base += 2;

  let mult = comboTier(combo).mult;
  if (has('twin-fangs') && /(.)\1/.test(word)) {
    mult *= 2;
    r.crit = true;
  }
  if (has('no-e') && !word.includes('e')) mult *= 1.5;
  if (has('first-strike') && firstWord) {
    mult *= 3;
    r.crit = true;
  }
  r.dmg = Math.round(base * mult);
  r.sparkDmg = Math.round(SPARK_DAMAGE * comboTier(combo).mult);
  if (has('marathon') && word.length >= 8) r.heal = 2;
  return r;
}
