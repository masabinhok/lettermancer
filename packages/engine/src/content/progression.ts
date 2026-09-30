/**
 * Permanent progression: the Codex of Hands (upgrades bought between runs) and keepsakes.
 * Upgrades are deliberately small and get pricier — your fingers stay the main source of power.
 */
import { NO_BONUSES, type RunBonuses } from '../state';

export type Currency = 'ink' | 'leaf';

export type UpgradeId = 'vitality' | 'purse' | 'momentum' | 'scholar' | 'reroll' | 'insight' | 'favor' | 'second-wind';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  glyph: string;
  /** what each rank gives */
  desc: string;
  currency: Currency;
  /** cost of each rank, in order */
  costs: number[];
}

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  vitality: {
    id: 'vitality',
    name: 'Vitality',
    glyph: '♥',
    desc: '+3 maximum health per rank.',
    currency: 'ink',
    costs: [40, 90, 160],
  },
  purse: {
    id: 'purse',
    name: 'Deep Purse',
    glyph: '●',
    desc: 'Start each run with 10 more coins per rank.',
    currency: 'ink',
    costs: [30, 75],
  },
  momentum: {
    id: 'momentum',
    name: 'Momentum',
    glyph: '»',
    desc: 'Start each run with 5 combo per rank.',
    currency: 'ink',
    costs: [50, 120],
  },
  scholar: {
    id: 'scholar',
    name: 'Scholar',
    glyph: '✎',
    desc: 'Earn 20% more Ink per rank.',
    currency: 'ink',
    costs: [60, 140],
  },
  reroll: {
    id: 'reroll',
    name: 'Second Thoughts',
    glyph: '↻',
    desc: 'Re-roll one reward screen per run, per rank.',
    currency: 'ink',
    costs: [70, 150],
  },
  insight: {
    id: 'insight',
    name: 'Insight',
    glyph: '◉',
    desc: 'Every boon screen offers one more choice.',
    currency: 'leaf',
    costs: [3],
  },
  favor: {
    id: 'favor',
    name: "Muse's Favor",
    glyph: '✧',
    desc: 'Your first boon each run is at least Rare, then Epic.',
    currency: 'leaf',
    costs: [2, 5],
  },
  'second-wind': {
    id: 'second-wind',
    name: 'Second Wind',
    glyph: '☥',
    desc: 'Once per run, survive a killing blow with 30% health.',
    currency: 'leaf',
    costs: [4],
  },
};

export const UPGRADE_IDS = Object.keys(UPGRADES) as UpgradeId[];

export type UpgradeRanks = Partial<Record<UpgradeId, number>>;

export const rankOf = (ranks: UpgradeRanks, id: UpgradeId) => Math.min(UPGRADES[id].costs.length, ranks[id] ?? 0);

/** Price of the next rank, or null when maxed. */
export function nextCost(ranks: UpgradeRanks, id: UpgradeId): number | null {
  return UPGRADES[id].costs[rankOf(ranks, id)] ?? null;
}

export type KeepsakeId = 'ember-locket' | 'quartz-pen' | 'sand-charm' | 'lucky-coin' | 'sage-leaf';

export interface KeepsakeDef {
  id: KeepsakeId;
  name: string;
  glyph: string;
  /** effect at each of three levels */
  levels: [string, string, string];
  /** how to earn it */
  unlock: string;
}

export const KEEPSAKES: Record<KeepsakeId, KeepsakeDef> = {
  'ember-locket': {
    id: 'ember-locket',
    name: 'Ember Locket',
    glyph: '♦',
    levels: ['Start with a Common Ember on E.', 'Start with a Rare Ember on E.', 'Start with an Epic Ember on E.'],
    unlock: 'Given by the Archivist after your first run.',
  },
  'quartz-pen': {
    id: 'quartz-pen',
    name: 'Quartz Pen',
    glyph: '◇',
    levels: [
      'Start every fight with 2 Shield.',
      'Start every fight with 3 Shield.',
      'Start every fight with 4 Shield.',
    ],
    unlock: 'Clear Act I.',
  },
  'sand-charm': {
    id: 'sand-charm',
    name: 'Sand Charm',
    glyph: '⧗',
    levels: [
      'Enemies wait 1 second longer before their first attack.',
      'Enemies wait 1.5 seconds longer before their first attack.',
      'Enemies wait 2 seconds longer before their first attack.',
    ],
    unlock: 'Win a fight without a single typo.',
  },
  'lucky-coin': {
    id: 'lucky-coin',
    name: 'Lucky Coin',
    glyph: '✪',
    levels: ['Fights pay 15% more coins.', 'Fights pay 25% more coins.', 'Fights pay 35% more coins.'],
    unlock: 'Hold 100 coins at once.',
  },
  'sage-leaf': {
    id: 'sage-leaf',
    name: 'Sage Leaf',
    glyph: '❦',
    levels: ['Heal 1 after every fight.', 'Heal 2 after every fight.', 'Heal 3 after every fight.'],
    unlock: 'Win a run.',
  },
};

export const KEEPSAKE_IDS = Object.keys(KEEPSAKES) as KeepsakeId[];
/** Runs with a keepsake equipped before it levels up. */
export const KEEPSAKE_RUNS_PER_LEVEL = 3;

export const keepsakeLevel = (uses: number): 1 | 2 | 3 =>
  uses >= KEEPSAKE_RUNS_PER_LEVEL * 2 ? 3 : uses >= KEEPSAKE_RUNS_PER_LEVEL ? 2 : 1;

/** Everything the player's permanent progress adds to a run, as plain numbers. */
export function bonusesFrom(ranks: UpgradeRanks, keepsake: { id: KeepsakeId; uses: number } | null): RunBonuses {
  const r = (id: UpgradeId) => rankOf(ranks, id);
  const b: RunBonuses = {
    ...NO_BONUSES,
    maxHp: 3 * r('vitality'),
    startCoins: 10 * r('purse'),
    startCombo: 5 * r('momentum'),
    inkBonus: 0.2 * r('scholar'),
    rerolls: r('reroll'),
    extraChoices: r('insight'),
    firstBoonRarity: (r('favor') >= 2 ? 2 : r('favor') >= 1 ? 1 : 0) as RunBonuses['firstBoonRarity'],
    secondWind: r('second-wind') ? 0.3 : 0,
  };
  if (keepsake) {
    const lvl = keepsakeLevel(keepsake.uses);
    if (keepsake.id === 'ember-locket') b.startBoon = { key: 'e', mod: 'ember', rarity: (lvl - 1) as 0 | 1 | 2 };
    if (keepsake.id === 'quartz-pen') b.startShield = lvl + 1;
    if (keepsake.id === 'sand-charm') b.graceMs = 500 + lvl * 500;
    if (keepsake.id === 'lucky-coin') b.coinMult = 1 + [0.15, 0.25, 0.35][lvl - 1];
    if (keepsake.id === 'sage-leaf') b.healAfterFight = lvl;
  }
  return b;
}
