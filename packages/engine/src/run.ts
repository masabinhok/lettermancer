/**
 * Run structure: starters, the doors you choose between, encounters, rewards and the shop.
 */
import { ACT_BASE, BOSS_BASE, BOSS_POOLS, BOSSES, ELITES, ROSTER, type MonsterDef } from './content/enemies';
import { heat, oath, type OathLevels } from './content/oaths';
import {
  BLESSING_IDS,
  BLESSINGS,
  eligibleDuos,
  installMod,
  isDuo,
  MOD_IDS,
  MODS,
  MUSE_IDS,
  MUSES,
  RELIC_IDS,
  RELICS,
  type BlessingId,
  type KeyMods,
  type ModId,
  type Rarity,
  type RelicId,
} from './mods';
import { pick, randInt, sample, type Rng } from './rng';
import {
  NO_BONUSES,
  type Door,
  type DoorReward,
  type EnemySpec,
  type MuseId,
  type NodeKind,
  type Run,
  type RunBonuses,
  type StarterId,
} from './state';
import { emptyStats } from './stats';

export const ACTS = 3;
/** Rooms chosen through doors before the act's boss. */
export const ROOMS_PER_ACT = 7;
export const BASE_HP = 50;
/** Gentle pace: enemy health and attack speed multipliers. */
export const GENTLE_HP = 0.7;
export const GENTLE_SPEED = 0.6;

// ---------- starters ----------

export interface StarterDef {
  id: StarterId;
  name: string;
  desc: string;
  keyMods: KeyMods;
  relics: RelicId[];
  coins: number;
  unlock: string | null;
}

const power = (mod: ModId, rarity: Rarity = 0) => ({ mod, rarity });

export const STARTERS: Record<StarterId, StarterDef> = {
  apprentice: {
    id: 'apprentice',
    name: 'Apprentice',
    desc: 'Ember on E, Gold on A. A warm, forgiving start.',
    keyMods: { e: [power('ember')], a: [power('gold')] },
    relics: [],
    coins: 5,
    unlock: null,
  },
  glassblower: {
    id: 'glassblower',
    name: 'Glassblower',
    desc: 'Glass on E, T and O. Huge hits — if your fingers are honest.',
    keyMods: { e: [power('glass')], t: [power('glass')], o: [power('glass')] },
    relics: [],
    coins: 0,
    unlock: 'Reach Act 3',
  },
  cryomancer: {
    id: 'cryomancer',
    name: 'Cryomancer',
    desc: 'Frost on S and R, Spark on N. Control the tempo.',
    keyMods: { s: [power('frost')], r: [power('frost')], n: [power('spark')] },
    relics: [],
    coins: 0,
    unlock: 'Beat an elite or boss without a single typo',
  },
  tycoon: {
    id: 'tycoon',
    name: 'Tycoon',
    desc: 'Gold on E and T, 15 coins and the Interest relic. Buy your power.',
    keyMods: { e: [power('gold')], t: [power('gold')] },
    relics: ['interest'],
    coins: 15,
    unlock: 'Hold 60 coins at once',
  },
};

export const STARTER_IDS = Object.keys(STARTERS) as StarterId[];

export function newRun(
  starter: StarterId,
  seed: number,
  rng: Rng,
  oaths: OathLevels = {},
  bonuses: RunBonuses = NO_BONUSES,
  gentle = false,
): Run {
  const s = STARTERS[starter];
  const maxHp = BASE_HP + bonuses.maxHp;
  return {
    seed,
    starter,
    hp: maxHp,
    maxHp,
    coins: s.coins + bonuses.startCoins,
    keyMods: bonuses.startBoon
      ? installMod(structuredClone(s.keyMods), bonuses.startBoon.key, bonuses.startBoon.mod, bonuses.startBoon.rarity)
          .keyMods
      : structuredClone(s.keyMods),
    relics: [...s.relics],
    blessings: [],
    oaths: { ...oaths },
    bonuses: { ...bonuses },
    act: 1,
    room: 0,
    bosses: BOSS_POOLS.map((pool) => pick(rng, pool)),
    carryCombo: bonuses.startCombo,
    carryShield: 0,
    secondWindLeft: bonuses.secondWind > 0,
    gentle,
    rerollsLeft: bonuses.rerolls,
    totals: {
      correct: 0,
      errors: 0,
      activeMs: 0,
      maxCombo: 0,
      words: 0,
      fights: 0,
      perfectFights: 0,
      peakWpm: 0,
      maxCoins: s.coins + bonuses.startCoins,
      coinsSpent: 0,
    },
    stats: emptyStats(),
    result: null,
  };
}

// ---------- doors ----------

function weighted<T>(rng: Rng, pool: [number, T][]): T {
  const total = pool.reduce((s, [w]) => s + w, 0);
  let x = rng() * total;
  for (const [w, v] of pool) {
    x -= w;
    if (x < 0) return v;
  }
  return pool[pool.length - 1][1];
}

/** The doors offered for the next room. After the last door comes the boss. */
export function rollDoors(run: Run, rng: Rng, history: readonly NodeKind[]): Door[] {
  const r = run.room;
  const museDoor = (exclude: MuseId[] = []): Door => ({
    node: 'fight',
    reward: {
      kind: 'muse',
      muse: pick(
        rng,
        MUSE_IDS.filter((m) => !exclude.includes(m)),
      ),
    },
  });
  if (r === 0) {
    const a = museDoor();
    return [a, museDoor([(a.reward as { muse: MuseId }).muse])];
  }
  if (r === ROOMS_PER_ACT - 1) {
    return [
      { node: 'shop', reward: null },
      { node: 'fight', reward: { kind: 'heal' } },
    ];
  }
  const shopRecently = history.slice(-2).includes('shop');
  const eliteThisAct = history.includes('elite');
  const pool: [number, () => Door][] = [
    [45, () => museDoor()],
    [14, () => ({ node: 'fight', reward: { kind: 'coins' } })],
    [run.hp < run.maxHp * 0.7 ? 10 : 3, () => ({ node: 'fight', reward: { kind: 'heal' } })],
    [r >= 2 && !eliteThisAct ? 16 : 0, () => ({ node: 'elite', reward: { kind: 'relic' } })],
    [r >= 2 && !shopRecently ? 13 : 0, () => ({ node: 'shop', reward: null })],
    [18, () => ({ node: 'event', reward: null })],
  ];
  const count = rng() < 0.5 ? 2 : 3;
  const doors: Door[] = [];
  for (let tries = 0; doors.length < count && tries < 40; tries++) {
    const d = weighted(rng, pool)();
    const same = doors.some((o) => o.node === d.node && JSON.stringify(o.reward) === JSON.stringify(d.reward));
    const sameMuse = doors.some(
      (o) => o.reward?.kind === 'muse' && d.reward?.kind === 'muse' && o.reward.muse === d.reward.muse,
    );
    if (!same && !sameMuse) doors.push(d);
  }
  if (!doors.some((d) => d.node === 'fight' || d.node === 'elite')) doors[0] = museDoor();
  return doors;
}

// ---------- encounters ----------

function monster(run: Run, def: MonsterDef, rng: Rng, kind: 'normal' | 'elite'): EnemySpec {
  const base = ACT_BASE[run.act - 1];
  const iron = (1 + 0.2 * oath(run.oaths, 'iron')) * (run.gentle ? GENTLE_HP : 1);
  const hp = Math.round(base.hp * def.hp * iron * (0.9 + rng() * 0.2));
  return {
    kind,
    name: def.name,
    glyph: def.glyph,
    hp,
    maxHp: hp,
    atk: Math.max(1, Math.round(base.atk * def.atk)),
    intentMs: Math.round(base.intentMs * def.speed * (0.92 + rng() * 0.16)),
    minLen: base.len[0] + (def.len ?? 0),
    maxLen: base.len[1] + (def.len ?? 0),
    traits: [...def.traits],
  };
}

/** Enemies for a room, as waves: the next wave arrives when the field is clear. */
export function makeEncounter(run: Run, node: NodeKind, rng: Rng): EnemySpec[][] {
  const roster = ROSTER[run.act - 1];
  const foe = () => monster(run, pick(rng, roster), rng, 'normal');
  if (node === 'fight') {
    if (run.act === 1 && run.room === 0) return [[foe()], [foe()]];
    if (run.act === 1) return [[foe(), foe()], [foe()]];
    if (run.act === 2)
      return [
        [foe(), foe()],
        [foe(), foe()],
      ];
    return rng() < 0.5
      ? [
          [foe(), foe()],
          [foe(), foe()],
        ]
      : [[foe(), foe()], [foe()], [foe(), foe()]];
  }
  if (node === 'elite') return [[monster(run, pick(rng, ELITES), rng, 'elite'), foe()]];
  if (node === 'boss') {
    const rule = run.bosses[run.act - 1];
    const def = BOSSES[rule];
    const base = BOSS_BASE[run.act - 1];
    const hp = Math.round(base.hp * def.hp * (1 + 0.2 * oath(run.oaths, 'iron')) * (run.gentle ? GENTLE_HP : 1));
    return [
      [
        {
          kind: 'boss',
          name: def.name,
          glyph: def.glyph,
          hp,
          maxHp: hp,
          atk: base.atk,
          intentMs: rule === 'wyrm' ? Math.round(base.intentMs * 1.25) : base.intentMs,
          minLen: def.len[0],
          maxLen: def.len[1],
          traits: [],
          rule,
        },
      ],
    ];
  }
  return [];
}

// ---------- rewards ----------

export type Offer =
  | { kind: 'power'; mod: ModId; rarity: Rarity }
  | { kind: 'blessing'; id: BlessingId }
  | { kind: 'relic'; relic: RelicId };

/** Roll a rarity. Later acts tilt toward rarer boons. */
export function rollRarity(run: Run, rng: Rng, floor: Rarity = 0): Rarity {
  const tilt = (run.act - 1) * 5;
  const weights: [number, Rarity][] = [
    [60 - tilt * 2, 0],
    [28 + tilt, 1],
    [10 + tilt, 2],
    [2, 3],
  ];
  return Math.max(floor, weighted(rng, weights)) as Rarity;
}

/** Boons from one muse: their key power, their blessings, and sometimes a duo you qualify for. */
export function museOffers(run: Run, muse: MuseId, rng: Rng, count: number, floor: Rarity = 0): Offer[] {
  const out: Offer[] = [{ kind: 'power', mod: MUSES[muse].mod, rarity: rollRarity(run, rng, floor) }];
  const blessings = sample(
    rng,
    BLESSING_IDS.filter((id) => !isDuo(id) && BLESSINGS[id].muses[0] === muse && !run.blessings.includes(id)),
    count - 1,
  );
  for (const id of blessings) out.push({ kind: 'blessing', id });
  const duos = eligibleDuos(run.keyMods, run.blessings).filter((id) => BLESSINGS[id].muses.includes(muse));
  if (duos.length && out.length > 1 && rng() < 0.45) out[out.length - 1] = { kind: 'blessing', id: pick(rng, duos) };
  // Out of blessings from this muse: fill with their power at another rarity.
  while (out.length < count) out.push({ kind: 'power', mod: MUSES[muse].mod, rarity: rollRarity(run, rng, floor) });
  return out;
}

export function relicOffers(run: Run, rng: Rng, n: number): Offer[] {
  return sample(
    rng,
    RELIC_IDS.filter((r) => !run.relics.includes(r)),
    n,
  ).map((relic) => ({ kind: 'relic' as const, relic }));
}

/** Coins paid out after every won fight. */
export function fightCoins(run: Run, node: NodeKind, reward: DoorReward | null, rng: Rng): number {
  const base = node === 'boss' ? 15 : node === 'elite' ? 10 : randInt(rng, 4, 6);
  return Math.round((base + (reward?.kind === 'coins' ? 18 + run.act * 6 : 0)) * run.bonuses.coinMult);
}

// ---------- shop ----------

export type ShopItem =
  | { kind: 'mod'; mod: ModId; rarity: Rarity; cost: number; sold: boolean }
  | { kind: 'relic'; relic: RelicId; cost: number; sold: boolean }
  | { kind: 'heal'; amount: number; cost: number; sold: boolean };

export function priceFactor(run: Run): number {
  return (1 + 0.25 * oath(run.oaths, 'scarce')) * (run.blessings.includes('tithe') ? 0.8 : 1);
}

export function rollShop(run: Run, rng: Rng): ShopItem[] {
  const f = priceFactor(run);
  const bump = run.act - 1;
  const items: ShopItem[] = sample(rng, MOD_IDS, 4).map((mod) => {
    const rarity = rollRarity(run, rng);
    return {
      kind: 'mod' as const,
      mod,
      rarity,
      cost: Math.round((MODS[mod].cost + bump + rarity * 4) * f),
      sold: false,
    };
  });
  for (const o of relicOffers(run, rng, 2))
    if (o.kind === 'relic')
      items.push({
        kind: 'relic',
        relic: o.relic,
        cost: Math.round((RELICS[o.relic].cost + bump * 2) * f),
        sold: false,
      });
  items.push({ kind: 'heal', amount: 15, cost: Math.round((6 + bump * 2) * f), sold: false });
  return items;
}

export const REROLL_BASE = 3;

// ---------- scoring ----------

/** One number for leaderboards: progress, speed and cleanliness, scaled by Heat. */
export function runScore(run: Run): number {
  const t = run.totals;
  const acc = t.correct + t.errors ? t.correct / (t.correct + t.errors) : 0;
  const progress = run.result === 'won' ? ACTS * 1000 + 1500 : (run.act - 1) * 1000 + run.room * 100;
  const skill = t.words * 3 + t.maxCombo * 4 + Math.round(t.peakWpm * 5);
  return Math.round((progress + skill) * (0.5 + acc / 2) * (1 + heat(run.oaths) * 0.1));
}
