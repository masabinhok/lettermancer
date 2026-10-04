/**
 * Boons: key powers you bind to letters, blessings from the muses, duo boons, and relics.
 */
import type { BossRule, MuseId } from './state';

// ---------- rarity ----------

export type Rarity = 0 | 1 | 2 | 3;
export const RARITY_NAMES = ['Common', 'Rare', 'Epic', 'Heroic'] as const;
/** How strong a key power is at each rarity. */
export const POTENCY = [1, 1.5, 2, 3] as const;
const STEP = [1, 2, 2, 3] as const;
const GLASS_MULT = [3, 4, 5, 6] as const;

// ---------- key powers ----------

export type ModId = 'ember' | 'frost' | 'spark' | 'gold' | 'echo' | 'glass' | 'ward';

export interface ModDef {
  id: ModId;
  name: string;
  glyph: string;
  color: string;
  /** the muse who grants it, or null (Glass is only found) */
  muse: MuseId | null;
  cost: number;
  /** what one letter does at a given rarity */
  describe(r: Rarity): string;
}

export const BURN_PER_EMBER = 2;
export const FROST_PUSH_MS = 700;
export const SPARK_DAMAGE = 3;

const burnOf = (r: Rarity) => Math.round(BURN_PER_EMBER * POTENCY[r]);
const frostOf = (r: Rarity) => Math.round(FROST_PUSH_MS * POTENCY[r]);
const sparkOf = (r: Rarity) => Math.round(SPARK_DAMAGE * POTENCY[r]);

export const MODS: Record<ModId, ModDef> = {
  ember: {
    id: 'ember',
    name: 'Ember',
    glyph: '▲',
    color: '#f2743a',
    muse: 'ignis',
    cost: 7,
    describe: (r) => `Each letter adds ${burnOf(r)} Burn: damage every second that fades by 1.`,
  },
  frost: {
    id: 'frost',
    name: 'Frost',
    glyph: '◆',
    color: '#7ccbf5',
    muse: 'glacia',
    cost: 6,
    describe: (r) => `Each letter pushes the target's attack back ${(frostOf(r) / 1000).toFixed(1)}s.`,
  },
  spark: {
    id: 'spark',
    name: 'Spark',
    glyph: 'ϟ',
    color: '#f4dc6b',
    muse: 'volta',
    cost: 7,
    describe: (r) => `Each letter zaps another enemy for ${sparkOf(r)}, scaled by combo.`,
  },
  gold: {
    id: 'gold',
    name: 'Gold',
    glyph: '●',
    color: '#e9c46a',
    muse: 'aurum',
    cost: 5,
    describe: (r) => `Each letter earns ${STEP[r]} coin${STEP[r] > 1 ? 's' : ''}.`,
  },
  echo: {
    id: 'echo',
    name: 'Echo',
    glyph: '◎',
    color: '#b79cf2',
    muse: 'resona',
    cost: 6,
    describe: (r) => `The letter deals +${POTENCY[r]} damage.`,
  },
  glass: {
    id: 'glass',
    name: 'Glass',
    glyph: '◇',
    color: '#eaf2ff',
    muse: null,
    cost: 8,
    describe: (r) => `The letter deals ×${GLASS_MULT[r]}, but mistyping it shatters the Glass.`,
  },
  ward: {
    id: 'ward',
    name: 'Ward',
    glyph: '■',
    color: '#7fe0b0',
    muse: 'aegis',
    cost: 6,
    describe: (r) => `Each letter grants ${STEP[r]} Shield for this fight.`,
  },
};

export const MOD_IDS = Object.keys(MODS) as ModId[];

export interface KeyBoon {
  mod: ModId;
  rarity: Rarity;
}

export type KeyMods = Record<string, KeyBoon[]>;
export const MAX_MODS_PER_KEY = 2;

/**
 * Bind a power to a key. The same power again on the same key raises its rarity instead of stacking.
 * A key holds two powers; a third pushes out the oldest.
 */
export function installMod(
  keyMods: KeyMods,
  key: string,
  mod: ModId,
  rarity: Rarity = 0,
): { keyMods: KeyMods; replaced: ModId | null; upgraded: boolean } {
  const current = keyMods[key] ?? [];
  const same = current.findIndex((b) => b.mod === mod);
  if (same >= 0) {
    const next = current.map((b, i) =>
      i === same ? { mod, rarity: Math.min(3, Math.max(b.rarity + 1, rarity)) as Rarity } : b,
    );
    return { keyMods: { ...keyMods, [key]: next }, replaced: null, upgraded: true };
  }
  const next = [...current, { mod, rarity }];
  const replaced = next.length > MAX_MODS_PER_KEY ? next.shift()!.mod : null;
  return { keyMods: { ...keyMods, [key]: next }, replaced, upgraded: false };
}

export function removeMod(keyMods: KeyMods, key: string, mod: ModId): KeyMods {
  const next = (keyMods[key] ?? []).filter((b) => b.mod !== mod);
  const out = { ...keyMods, [key]: next };
  if (next.length === 0) delete out[key];
  return out;
}

export const modsOn = (keyMods: KeyMods, key: string): ModId[] => (keyMods[key] ?? []).map((b) => b.mod);

// ---------- muses and blessings ----------

export interface MuseDef {
  id: MuseId;
  name: string;
  title: string;
  color: string;
  mod: ModId;
}

export const MUSES: Record<MuseId, MuseDef> = {
  ignis: { id: 'ignis', name: 'Ignis', title: 'Muse of Flame', color: '#f2743a', mod: 'ember' },
  glacia: { id: 'glacia', name: 'Glacia', title: 'Muse of Winter', color: '#7ccbf5', mod: 'frost' },
  volta: { id: 'volta', name: 'Volta', title: 'Muse of Storms', color: '#f4dc6b', mod: 'spark' },
  aurum: { id: 'aurum', name: 'Aurum', title: 'Muse of Plenty', color: '#e9c46a', mod: 'gold' },
  resona: { id: 'resona', name: 'Resona', title: 'Muse of Song', color: '#b79cf2', mod: 'echo' },
  aegis: { id: 'aegis', name: 'Aegis', title: 'Muse of the Wall', color: '#7fe0b0', mod: 'ward' },
};

export const MUSE_IDS = Object.keys(MUSES) as MuseId[];

export type BlessingId =
  | 'kindling'
  | 'wildfire'
  | 'flashpoint'
  | 'cold-snap'
  | 'brittle'
  | 'permafrost'
  | 'arc'
  | 'static'
  | 'overcharge'
  | 'tithe'
  | 'midas'
  | 'windfall'
  | 'reverb'
  | 'chorus'
  | 'crescendo'
  | 'bulwark'
  | 'riposte'
  | 'mending'
  // duo boons
  | 'steam'
  | 'plasma'
  | 'rime'
  | 'currency'
  | 'roaring'
  | 'golden-aegis'
  | 'thunderclap';

export interface BlessingDef {
  id: BlessingId;
  name: string;
  desc: string;
  /** one muse for a blessing, two for a duo boon */
  muses: MuseId[];
  glyph: string;
}

const b = (id: BlessingId, name: string, muses: MuseId[], glyph: string, desc: string): BlessingDef => ({
  id,
  name,
  muses,
  glyph,
  desc,
});

export const BLESSINGS: Record<BlessingId, BlessingDef> = {
  kindling: b('kindling', 'Kindling', ['ignis'], '♠', 'Burn ticks twice as often.'),
  wildfire: b('wildfire', 'Wildfire', ['ignis'], '✶', 'When a burning enemy dies, its Burn leaps to another enemy.'),
  flashpoint: b('flashpoint', 'Flashpoint', ['ignis'], '✦', 'Critical hits add 6 Burn.'),
  'cold-snap': b('cold-snap', 'Cold Snap', ['glacia'], '❄', 'Every 20 combo pushes back every enemy attack by 1.5s.'),
  brittle: b('brittle', 'Brittle', ['glacia'], '✧', 'Enemies less than 30% charged take 25% more damage.'),
  permafrost: b(
    'permafrost',
    'Permafrost',
    ['glacia'],
    '❅',
    'Frost also pushes back every other enemy at half strength.',
  ),
  arc: b('arc', 'Arc', ['volta'], '↯', 'Every spark jumps to a second enemy.'),
  static: b('static', 'Static', ['volta'], 'ϟ', 'The first letter of every word zaps a random enemy for 2.'),
  overcharge: b('overcharge', 'Overcharge', ['volta'], '⚡', 'Sparks deal double damage to enemies above half health.'),
  tithe: b('tithe', 'Tithe', ['aurum'], '⚖', 'Shop prices are 20% lower.'),
  midas: b('midas', 'Midas', ['aurum'], '♛', 'Words deal +1 damage for every 15 coins you hold (up to +5).'),
  windfall: b('windfall', 'Windfall', ['aurum'], '✪', 'Every kill drops 3 coins.'),
  reverb: b('reverb', 'Reverb', ['resona'], '≋', 'Doubled letters (ee, ll, ss) each count double.'),
  chorus: b('chorus', 'Chorus', ['resona'], '♫', 'Every combo tier above ×1 is worth ×0.5 more.'),
  crescendo: b('crescendo', 'Crescendo', ['resona'], '♩', 'Each clean word in a row deals +1 more damage (up to +8).'),
  bulwark: b('bulwark', 'Bulwark', ['aegis'], '▣', 'Keep up to 10 Shield between fights.'),
  riposte: b('riposte', 'Riposte', ['aegis'], '⚔', 'When Shield blocks a hit, the attacker takes that much damage.'),
  mending: b('mending', 'Mending', ['aegis'], '✚', 'Heal 3 health after every fight.'),
  steam: b('steam', 'Steam', ['ignis', 'glacia'], '☁', 'Frost on a burning enemy deals its Burn at once.'),
  plasma: b('plasma', 'Plasma', ['ignis', 'volta'], '✹', 'Sparks add 2 Burn to what they hit.'),
  rime: b('rime', 'Rime Guard', ['glacia', 'aegis'], '❆', 'Frost letters also grant 1 Shield.'),
  currency: b('currency', 'Currency', ['volta', 'aurum'], '⌁', 'Every spark earns a coin.'),
  roaring: b('roaring', 'Roaring Flame', ['resona', 'ignis'], '♨', 'Echo letters also add 1 Burn.'),
  'golden-aegis': b(
    'golden-aegis',
    'Golden Aegis',
    ['aurum', 'aegis'],
    '◈',
    'Start each fight with Shield equal to a tenth of your coins.',
  ),
  thunderclap: b('thunderclap', 'Thunderclap', ['resona', 'volta'], '☇', 'Critical hits zap every enemy for 5.'),
};

export const BLESSING_IDS = Object.keys(BLESSINGS) as BlessingId[];
export const isDuo = (id: BlessingId) => BLESSINGS[id].muses.length > 1;

/** Muses you have any boon from: a key power bound to a key, or a blessing. */
export function musesHeld(keyMods: KeyMods, blessings: readonly BlessingId[]): Set<MuseId> {
  const out = new Set<MuseId>();
  for (const list of Object.values(keyMods)) for (const kb of list) if (MODS[kb.mod].muse) out.add(MODS[kb.mod].muse!);
  for (const id of blessings) if (!isDuo(id)) out.add(BLESSINGS[id].muses[0]);
  return out;
}

/** Duo boons you qualify for and don't have yet. */
export function eligibleDuos(keyMods: KeyMods, blessings: readonly BlessingId[]): BlessingId[] {
  const held = musesHeld(keyMods, blessings);
  return BLESSING_IDS.filter(
    (id) => isDuo(id) && !blessings.includes(id) && BLESSINGS[id].muses.every((m) => held.has(m)),
  );
}

// ---------- relics ----------

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
  | 'thorns'
  // signature relics: each dropped only by its boss
  | 'hydra-tooth'
  | 'mirror-shard'
  | 'night-lantern'
  | 'red-pen';

export interface RelicDef {
  id: RelicId;
  name: string;
  glyph: string;
  desc: string;
  cost: number;
  /** A signature relic: dropped only by this boss, never offered in shops or by elites. */
  boss?: BossRule;
}

export const RELICS: Record<RelicId, RelicDef> = {
  'twin-fangs': {
    id: 'twin-fangs',
    name: 'Twin Fangs',
    glyph: 'ᵂ',
    desc: 'Words with a double letter (ll, ee, ss…) deal ×2.',
    cost: 16,
  },
  'no-e': { id: 'no-e', name: 'Lipogram', glyph: 'Ɇ', desc: 'Words without the letter E deal +50%.', cost: 14 },
  marathon: { id: 'marathon', name: 'Marathon', glyph: '∞', desc: 'Words of 8+ letters heal 2 health.', cost: 15 },
  'steady-hands': {
    id: 'steady-hands',
    name: 'Steady Hands',
    glyph: '≈',
    desc: 'A typo halves your combo instead of resetting it.',
    cost: 18,
  },
  whetstone: { id: 'whetstone', name: 'Whetstone', glyph: '⟋', desc: '+2 base damage on every word.', cost: 14 },
  hourglass: { id: 'hourglass', name: 'Hourglass', glyph: '⧗', desc: 'Enemies attack 15% slower.', cost: 18 },
  interest: {
    id: 'interest',
    name: 'Interest',
    glyph: '%',
    desc: 'After each fight, +1 coin per 5 held (max 5).',
    cost: 12,
  },
  vampire: { id: 'vampire', name: 'Fang Ink', glyph: '†', desc: 'Every 25 combo heals 3 health.', cost: 16 },
  'first-strike': {
    id: 'first-strike',
    name: 'First Strike',
    glyph: '»',
    desc: 'Your first word each fight deals ×3.',
    cost: 13,
  },
  thorns: { id: 'thorns', name: 'Thorns', glyph: '✱', desc: 'When hit, deal 4 damage back to the attacker.', cost: 13 },
  'hydra-tooth': {
    id: 'hydra-tooth',
    name: "Hydra's Tooth",
    glyph: '♆',
    desc: 'Every kill heals 2 health.',
    cost: 0,
    boss: 'hydra',
  },
  'mirror-shard': {
    id: 'mirror-shard',
    name: 'Mirror Shard',
    glyph: '◫',
    desc: 'Start every fight with 6 Shield.',
    cost: 0,
    boss: 'mirror',
  },
  'night-lantern': {
    id: 'night-lantern',
    name: 'Night Lantern',
    glyph: '☾',
    desc: 'Your whole combo carries into the next fight, not half.',
    cost: 0,
    boss: 'blackout',
  },
  'red-pen': {
    id: 'red-pen',
    name: 'Red Pen',
    glyph: '✎',
    desc: "The first typo in each fight doesn't break your combo.",
    cost: 0,
    boss: 'redactor',
  },
};

/** Relics that can turn up in shops, elite rewards and events (signature relics come only from bosses). */
export const RELIC_IDS = (Object.keys(RELICS) as RelicId[]).filter((id) => !RELICS[id].boss);

/** The signature relic each boss always drops (the final bosses end the run, so they drop none). */
export const BOSS_RELIC: Partial<Record<BossRule, RelicId>> = Object.fromEntries(
  (Object.keys(RELICS) as RelicId[]).filter((id) => RELICS[id].boss).map((id) => [RELICS[id].boss!, id]),
);

// ---------- combo ----------

export const COMBO_TIERS = [
  { at: 0, mult: 1 },
  { at: 10, mult: 1.5 },
  { at: 25, mult: 2 },
  { at: 50, mult: 3 },
  { at: 100, mult: 4 },
] as const;

export function comboTier(combo: number, blessings: readonly BlessingId[] = []): { tier: number; mult: number } {
  let tier = 0;
  for (let i = 0; i < COMBO_TIERS.length; i++) if (combo >= COMBO_TIERS[i].at) tier = i;
  const chorus = blessings.includes('chorus') && tier > 0 ? 0.5 * tier : 0;
  return { tier, mult: COMBO_TIERS[tier].mult + chorus };
}

// ---------- resolving a finished word ----------

export interface WordContext {
  keyMods: KeyMods;
  relics: readonly RelicId[];
  blessings: readonly BlessingId[];
  /** combo when the word finished */
  combo: number;
  firstWord: boolean;
  coins: number;
  /** clean words in a row before this one (Crescendo) */
  streak: number;
}

export interface WordResult {
  dmg: number;
  crit: boolean;
  burn: number;
  /** total ms the target's attack is pushed back */
  frostMs: number;
  /** damage of each spark */
  sparks: number[];
  coins: number;
  shield: number;
  heal: number;
}

/** Resolve everything a completed word does. Pure — used by combat and tests. */
export function resolveWord(word: string, x: WordContext): WordResult {
  const has = (id: RelicId) => x.relics.includes(id);
  const bless = (id: BlessingId) => x.blessings.includes(id);
  const { mult: comboMult } = comboTier(x.combo, x.blessings);
  const r: WordResult = { dmg: 0, crit: false, burn: 0, frostMs: 0, sparks: [], coins: 0, shield: 0, heal: 0 };
  const lower = word.toLowerCase();

  let base = 0;
  for (let i = 0; i < lower.length; i++) {
    const ch = lower[i];
    const boons = x.keyMods[ch] ?? [];
    let v = 1;
    for (const kb of boons) if (kb.mod === 'echo') v += POTENCY[kb.rarity];
    for (const kb of boons) if (kb.mod === 'glass') v *= GLASS_MULT[kb.rarity];
    if (bless('reverb') && (lower[i - 1] === ch || lower[i + 1] === ch) && /[a-z]/.test(ch)) v *= 2;
    base += v;
    for (const kb of boons) {
      if (kb.mod === 'ember') r.burn += burnOf(kb.rarity);
      else if (kb.mod === 'frost') {
        r.frostMs += frostOf(kb.rarity);
        if (bless('rime')) r.shield += 1;
      } else if (kb.mod === 'spark') r.sparks.push(Math.round(sparkOf(kb.rarity) * comboMult));
      else if (kb.mod === 'gold') r.coins += STEP[kb.rarity];
      else if (kb.mod === 'ward') r.shield += STEP[kb.rarity];
      else if (kb.mod === 'echo' && bless('roaring')) r.burn += 1;
    }
  }
  if (has('whetstone')) base += 2;
  if (bless('midas')) base += Math.min(5, Math.floor(x.coins / 15));
  if (bless('crescendo')) base += Math.min(8, x.streak);

  let mult = comboMult;
  if (has('twin-fangs') && /(.)\1/.test(lower)) {
    mult *= 2;
    r.crit = true;
  }
  if (has('no-e') && !lower.includes('e')) mult *= 1.5;
  if (has('first-strike') && x.firstWord) {
    mult *= 3;
    r.crit = true;
  }
  r.dmg = Math.round(base * mult);
  if (r.crit && bless('flashpoint')) r.burn += 6;
  if (has('marathon') && word.length >= 8) r.heal = 2;
  return r;
}
