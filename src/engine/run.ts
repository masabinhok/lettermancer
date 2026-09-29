import { MOD_IDS, MODS, RELIC_IDS, RELICS, type KeyMods, type ModId, type RelicId } from './mods';
import { pick, randInt, sample, shuffle, type Rng } from './rng';
import type { BossRule, EnemySpec, NodeKind, Run, StarterId } from './state';
import { emptyStats } from './stats';

export const ACT_LAYOUT: readonly NodeKind[] = ['fight', 'fight', 'shop', 'fight', 'elite', 'shop', 'boss'];
export const ACTS = 3;

export interface StarterDef {
  id: StarterId;
  name: string;
  desc: string;
  keyMods: KeyMods;
  relics: RelicId[];
  coins: number;
  unlock: string | null;
}

export const STARTERS: Record<StarterId, StarterDef> = {
  apprentice: {
    id: 'apprentice',
    name: 'Apprentice',
    desc: 'Ember on E, Gold on A. A warm, forgiving start.',
    keyMods: { e: ['ember'], a: ['gold'] },
    relics: [],
    coins: 5,
    unlock: null,
  },
  glassblower: {
    id: 'glassblower',
    name: 'Glassblower',
    desc: 'Glass on E, T and O. Huge hits — if your fingers are honest.',
    keyMods: { e: ['glass'], t: ['glass'], o: ['glass'] },
    relics: [],
    coins: 0,
    unlock: 'Reach Act 3',
  },
  cryomancer: {
    id: 'cryomancer',
    name: 'Cryomancer',
    desc: 'Frost on S and R, Spark on N. Control the tempo.',
    keyMods: { s: ['frost'], r: ['frost'], n: ['spark'] },
    relics: [],
    coins: 0,
    unlock: 'Beat an elite or boss without a single typo',
  },
  tycoon: {
    id: 'tycoon',
    name: 'Tycoon',
    desc: 'Gold on E and T, 15 coins and the Interest relic. Buy your power.',
    keyMods: { e: ['gold'], t: ['gold'] },
    relics: ['interest'],
    coins: 15,
    unlock: 'Hold 60 coins at once',
  },
};

export const STARTER_IDS = Object.keys(STARTERS) as StarterId[];

export function newRun(starter: StarterId, seed: number, rng: Rng): Run {
  const s = STARTERS[starter];
  return {
    seed,
    starter,
    hp: 50,
    maxHp: 50,
    coins: s.coins,
    keyMods: structuredClone(s.keyMods),
    relics: [...s.relics],
    act: 1,
    node: 0,
    bosses: shuffle(rng, ['hydra', 'mirror', 'blackout'] as BossRule[]),
    totals: { correct: 0, errors: 0, activeMs: 0, maxCombo: 0, words: 0, fights: 0, perfectFights: 0, peakWpm: 0 },
    stats: emptyStats(),
    result: null,
  };
}

export const currentNode = (run: Run): NodeKind => ACT_LAYOUT[run.node];

/** Move to the next node. Returns what happened. */
export function advance(run: Run): 'next' | 'new-act' | 'victory' {
  run.node++;
  if (run.node < ACT_LAYOUT.length) return 'next';
  run.act++;
  run.node = 0;
  if (run.act > ACTS) {
    run.result = 'won';
    return 'victory';
  }
  return 'new-act';
}

interface ActParams {
  len: [number, number];
  hp: [number, number];
  atk: [number, number];
  intent: [number, number];
}

const ACT_PARAMS: ActParams[] = [
  { len: [3, 5], hp: [10, 15], atk: [3, 4], intent: [7500, 9000] },
  { len: [4, 7], hp: [16, 22], atk: [4, 6], intent: [7500, 9000] },
  { len: [5, 8], hp: [24, 32], atk: [6, 8], intent: [7000, 8400] },
];

const MONSTERS: [string, string][][] = [
  [['Typo Imp', 'ʇ'], ['Serif Slime', '§'], ['Tilde Worm', '~'], ['Pilcrow', '¶'], ['Caret Bat', '^']],
  [['Ligature Leech', 'æ'], ['Glyph Golem', 'Ω'], ['Ampersand', '&'], ['Caps Wraith', 'Ⱥ'], ['Dagger', '‡']],
  [['Null Knight', '∅'], ['Backspace Banshee', '⌫'], ['Sigma Beast', 'Σ'], ['Lambda Lurker', 'λ'], ['Integral', '∫']],
];

const ELITES: [string, string][] = [
  ['Octothorpe', '#'],
  ['The Asterisk', '✻'],
  ['At-Lord', '@'],
];

export const BOSSES: Record<BossRule, { name: string; glyph: string; desc: string }> = {
  hydra: { name: 'Hydra of Ands', glyph: '&', desc: 'Every hit grows a new head.' },
  mirror: { name: 'Mirror Scribe', glyph: 'Ǝ', desc: 'Its words are written backwards.' },
  blackout: { name: 'Blackout', glyph: '■', desc: 'Its words fade — type from memory.' },
};

export function makeEncounter(run: Run, kind: NodeKind, rng: Rng): EnemySpec[] {
  const p = ACT_PARAMS[run.act - 1];
  const normal = (): EnemySpec => {
    const [name, glyph] = pick(rng, MONSTERS[run.act - 1]);
    const hp = randInt(rng, p.hp[0], p.hp[1]);
    return {
      kind: 'normal',
      name,
      glyph,
      hp,
      maxHp: hp,
      atk: randInt(rng, p.atk[0], p.atk[1]),
      intentMs: randInt(rng, p.intent[0], p.intent[1]),
      minLen: p.len[0],
      maxLen: p.len[1],
    };
  };

  if (kind === 'fight') {
    const firstFight = run.act === 1 && run.node === 0;
    const count = firstFight ? 1 : run.act === 1 ? randInt(rng, 1, 2) : run.act === 2 ? 2 : randInt(rng, 2, 3);
    return Array.from({ length: count }, normal);
  }
  if (kind === 'elite') {
    const [name, glyph] = pick(rng, ELITES);
    const hp = Math.round(p.hp[1] * 2.6);
    return [
      {
        kind: 'elite',
        name,
        glyph,
        hp,
        maxHp: hp,
        atk: Math.round(p.atk[1] * 1.5),
        intentMs: p.intent[0],
        minLen: p.len[0] + 2,
        maxLen: p.len[1] + 2,
      },
    ];
  }
  if (kind === 'boss') {
    const rule = run.bosses[run.act - 1];
    const b = BOSSES[rule];
    const hp = [70, 115, 160][run.act - 1];
    const len: Record<BossRule, [number, number]> = { hydra: [7, 10], mirror: [4, 6], blackout: [5, 8] };
    return [
      {
        kind: 'boss',
        name: b.name,
        glyph: b.glyph,
        hp,
        maxHp: hp,
        atk: [6, 9, 12][run.act - 1],
        intentMs: [8000, 7500, 7000][run.act - 1],
        minLen: len[rule][0],
        maxLen: len[rule][1],
        rule,
      },
    ];
  }
  return [];
}

/** A small Hydra head, spawned when the Hydra is hit. */
export function hydraHead(run: Run): EnemySpec {
  return {
    kind: 'head',
    name: 'Head',
    glyph: '&',
    hp: 5 + run.act * 3,
    maxHp: 5 + run.act * 3,
    atk: 2 + run.act,
    intentMs: 6000,
    minLen: 3,
    maxLen: 4,
  };
}

export const MAX_HYDRA_HEADS = 2;

export interface FightReward {
  coins: number;
  mods: ModId[];
  relics: RelicId[];
}

export function rollReward(run: Run, kind: NodeKind, rng: Rng): FightReward {
  const coins = kind === 'boss' ? 15 : kind === 'elite' ? 10 : randInt(rng, 4, 6);
  return {
    coins,
    mods: sample(rng, MOD_IDS, 3),
    relics: kind === 'elite' || kind === 'boss' ? rollRelics(run, rng, 3) : [],
  };
}

export function rollRelics(run: Run, rng: Rng, n: number): RelicId[] {
  return sample(
    rng,
    RELIC_IDS.filter((r) => !run.relics.includes(r)),
    n,
  );
}

export type ShopItem =
  | { kind: 'mod'; mod: ModId; cost: number; sold: boolean }
  | { kind: 'relic'; relic: RelicId; cost: number; sold: boolean }
  | { kind: 'heal'; amount: number; cost: number; sold: boolean };

export function rollShop(run: Run, rng: Rng): ShopItem[] {
  const bump = run.act - 1;
  const items: ShopItem[] = sample(rng, MOD_IDS, 4).map((mod) => ({
    kind: 'mod' as const,
    mod,
    cost: MODS[mod].cost + bump,
    sold: false,
  }));
  for (const relic of rollRelics(run, rng, 2)) items.push({ kind: 'relic', relic, cost: RELICS[relic].cost + bump * 2, sold: false });
  items.push({ kind: 'heal', amount: 15, cost: 6 + bump * 2, sold: false });
  return items;
}

export const REROLL_BASE = 3;
