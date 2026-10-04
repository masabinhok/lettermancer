/**
 * Permanent progress between runs: currencies, upgrades, keepsakes, prophecies, the codex,
 * and what the Archivist says about your last run. Pure functions over a plain `Meta` object.
 */
import { MODS } from './mods';
import type { RunConfig, RunReport } from './machine';
import { heat, OATH_IDS, OATHS, type OathLevels } from './content/oaths';
import {
  bonusesFrom,
  keepsakeLevel,
  nextCost,
  UPGRADES,
  type KeepsakeId,
  type UpgradeId,
  type UpgradeRanks,
} from './content/progression';
import { PROPHECIES, type PracticeSummary, type ProphecyDef } from './content/prophecies';
import { TRIALS, type TrialDef } from './content/trials';
import type { PracticeResult } from './practice';
import type { Run, RunBonuses, StarterId } from './state';
import type { MasteryRank } from './stats';

export type KeyboardMode = 'full' | 'compact' | 'hidden';
export const KEYBOARD_MODES: readonly KeyboardMode[] = ['full', 'compact', 'hidden'];

export interface Codex {
  /** enemy name -> times met */
  enemies: Record<string, number>;
  /** boss rule -> times beaten */
  bosses: Record<string, number>;
  events: string[];
  /** key powers and blessings you have taken */
  boons: string[];
}

export interface PracticeProgress {
  /** consecutive days with at least one practice test */
  streak: number;
  lastDay: string | null;
  /** best wpm per test id, e.g. "time-30" */
  best: Record<string, number>;
  /** ink earned from practice today (capped) */
  inkToday: number;
  inkDay: string | null;
  /** letters unlocked in adaptive lessons */
  lessonLetters: number;
}

export interface LastRun {
  result: 'won' | 'lost';
  act: number;
  killedBy: string | null;
  bossesBeaten: string[];
  heat: number;
  gentle: boolean;
}

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
  ink: number;
  leaf: number;
  seals: number;
  upgrades: UpgradeRanks;
  keepsakes: KeepsakeId[];
  equipped: KeepsakeId | null;
  keepsakeUses: Partial<Record<KeepsakeId, number>>;
  /** prophecy id -> ISO date earned */
  prophecies: Record<string, string>;
  codex: Codex;
  winsByStarter: Partial<Record<StarterId, number>>;
  /** highest Heat you have won at; your Oath cap is two above it */
  maxHeatWon: number;
  bestScore: number;
  /** quickest won run by the stopwatch (active play time, ms); 0 until you win one */
  fastestWinMs: number;
  lastRun: LastRun | null;
  practice: PracticeProgress;
  /** Archivist lines already heard */
  heard: string[];
  /** ids of trials passed */
  trialsPassed: string[];
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
  ink: 0,
  leaf: 0,
  seals: 0,
  upgrades: {},
  keepsakes: [],
  equipped: null,
  keepsakeUses: {},
  prophecies: {},
  codex: { enemies: {}, bosses: {}, events: [], boons: [] },
  winsByStarter: {},
  maxHeatWon: 0,
  bestScore: 0,
  fastestWinMs: 0,
  lastRun: null,
  practice: { streak: 0, lastDay: null, best: {}, inkToday: 0, inkDay: null, lessonLetters: 6 },
  heard: [],
  trialsPassed: [],
});

/** Fill in fields added in later versions, so old saves keep working. */
export function migrateMeta(raw: Partial<Meta>): Meta {
  const d = defaultMeta();
  return {
    ...d,
    ...raw,
    codex: { ...d.codex, ...raw.codex },
    practice: { ...d.practice, ...raw.practice },
  };
}

// ---------- starters ----------

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

// ---------- Oaths ----------

/** How much Heat you may carry: two more than the most you have won at, plus one per Heat trial passed. */
export const heatCap = (meta: Meta): number =>
  meta.maxHeatWon + 2 + TRIALS.filter((t) => t.raisesHeat && meta.trialsPassed.includes(t.id)).length;

/** Trim sworn Oaths down to the cap, highest levels last. */
export function clampOaths(meta: Meta): OathLevels {
  const out: OathLevels = {};
  let left = heatCap(meta);
  for (const id of OATH_IDS) {
    const lvl = Math.min(meta.oaths[id] ?? 0, OATHS[id].max, left);
    if (lvl > 0) out[id] = lvl;
    left -= lvl;
  }
  return out;
}

// ---------- bonuses ----------

export function runBonusesFor(meta: Meta): RunBonuses {
  const k = meta.equipped;
  return bonusesFrom(meta.upgrades, k ? { id: k, uses: meta.keepsakeUses[k] ?? 0 } : null);
}

export function buyUpgrade(meta: Meta, id: UpgradeId): boolean {
  const cost = nextCost(meta.upgrades, id);
  if (cost === null) return false;
  const cur = UPGRADES[id].currency;
  if (meta[cur] < cost) return false;
  meta[cur] -= cost;
  meta.upgrades = { ...meta.upgrades, [id]: (meta.upgrades[id] ?? 0) + 1 };
  return true;
}

export const SEALS_PER_LEAF = 3;

/** The Archivist trades Seals for Gold Leaf. */
export function tradeSeals(meta: Meta): boolean {
  if (meta.seals < SEALS_PER_LEAF) return false;
  meta.seals -= SEALS_PER_LEAF;
  meta.leaf += 1;
  return true;
}

// ---------- after a run ----------

export interface Award {
  ink: number;
  leaf: number;
  seals: number;
  prophecies: ProphecyDef[];
  keepsakes: KeepsakeId[];
  /** the equipped keepsake reached a new level */
  keepsakeLevel: number | null;
  score: number;
}

export interface RunInput {
  report: RunReport;
  run: Run;
  config: RunConfig;
  score: number;
}

export interface Snapshot {
  mastery: Record<string, MasteryRank>;
  totalKeys: number;
}

/** Ink a run pays out. */
export function inkFor(input: RunInput): number {
  const { report, run, config } = input;
  const base =
    run.totals.words / 4 + run.totals.fights * 3 + report.bossesBeaten.length * 20 + (report.result === 'won' ? 50 : 0);
  const mult = (1 + heat(config.oaths) * 0.1) * (1 + run.bonuses.inkBonus) * (config.gentle ? 0.5 : 1);
  return Math.round(base * mult);
}

/** Gold Leaf a run pays out: one per boss, plus a bonus for winning under Heat. */
export function leafFor(input: RunInput): number {
  const h = heat(input.config.oaths);
  return input.report.bossesBeaten.length + (input.report.result === 'won' && h >= 2 ? Math.floor(h / 2) : 0);
}

/** Record a finished run on meta and hand out everything it earned. Mutates `meta`. */
export function awardRun(meta: Meta, input: RunInput, snap: Snapshot): Award {
  const { report, run, config } = input;
  const won = report.result === 'won';
  const h = heat(config.oaths);

  meta.runs++;
  if (won) {
    meta.wins++;
    meta.winsByStarter[config.starter] = (meta.winsByStarter[config.starter] ?? 0) + 1;
    if (!config.gentle) meta.maxHeatWon = Math.max(meta.maxHeatWon, h);
  }
  meta.bestAct = Math.max(meta.bestAct, won ? 4 : run.act);
  if (!config.gentle) meta.bestScore = Math.max(meta.bestScore, input.score);
  meta.lastRun = {
    result: won ? 'won' : 'lost',
    act: run.act,
    killedBy: report.killedBy,
    bossesBeaten: report.bossesBeaten,
    heat: h,
    gentle: config.gentle,
  };

  // Codex
  const cx = meta.codex;
  for (const name of report.enemiesSeen) cx.enemies[name] = (cx.enemies[name] ?? 0) + 1;
  for (const b of report.bossesBeaten) cx.bosses[b] = (cx.bosses[b] ?? 0) + 1;
  for (const p of report.picks) {
    if (p.kind === 'event') {
      const id = p.id.split(':')[0];
      if (!cx.events.includes(id)) cx.events.push(id);
    }
    if (p.kind === 'blessing' && !cx.boons.includes(p.id)) cx.boons.push(p.id);
    if (p.kind === 'power' || p.kind === 'buy') {
      const id = p.id.split(':')[0];
      if (id in MODS && !cx.boons.includes(id)) cx.boons.push(id);
    }
  }
  for (const list of Object.values(run.keyMods))
    for (const b of list) if (!cx.boons.includes(b.mod)) cx.boons.push(b.mod);

  // Currencies
  const ink = inkFor(input);
  const leaf = leafFor(input);
  meta.ink += ink;
  meta.leaf += leaf;

  // Keepsakes
  const newKeepsakes: KeepsakeId[] = [];
  const give = (id: KeepsakeId, cond: boolean) => {
    if (cond && !meta.keepsakes.includes(id)) {
      meta.keepsakes.push(id);
      newKeepsakes.push(id);
    }
  };
  give('ember-locket', true);
  give('quartz-pen', report.bossesBeaten.length >= 1);
  give('sand-charm', run.totals.perfectFights > 0);
  give('lucky-coin', run.totals.maxCoins >= 100);
  give('sage-leaf', won);
  let levelUp: number | null = null;
  if (meta.equipped) {
    const before = keepsakeLevel(meta.keepsakeUses[meta.equipped] ?? 0);
    meta.keepsakeUses[meta.equipped] = (meta.keepsakeUses[meta.equipped] ?? 0) + 1;
    const after = keepsakeLevel(meta.keepsakeUses[meta.equipped]!);
    if (after > before) levelUp = after;
  }

  const prophecies = checkProphecies(meta, { run: input, ...snap });
  return {
    ink,
    leaf,
    seals: prophecies.reduce((s, p) => s + p.seals, 0),
    prophecies,
    keepsakes: newKeepsakes,
    keepsakeLevel: levelUp,
    score: input.score,
  };
}

/** Award any prophecies now fulfilled. Mutates `meta`. */
export function checkProphecies(
  meta: Meta,
  x: Snapshot & { run?: RunInput; practice?: PracticeSummary },
): ProphecyDef[] {
  const earned: ProphecyDef[] = [];
  const now = new Date().toISOString();
  for (const p of PROPHECIES) {
    if (meta.prophecies[p.id]) continue;
    if (p.check({ meta, mastery: x.mastery, totalKeys: x.totalKeys, run: x.run, practice: x.practice })) {
      meta.prophecies[p.id] = now;
      meta.seals += p.seals;
      earned.push(p);
    }
  }
  return earned;
}

// ---------- the Archivist ----------

/**
 * The Archivist keeps the Scriptorium and remembers every run. Returns the most fitting line
 * not yet heard, falling back to a general one.
 */
export function archivistLine(meta: Meta): { id: string; text: string } {
  const r = meta.lastRun;
  const lines: { id: string; when: boolean; text: string }[] = [
    {
      id: 'welcome',
      when: meta.runs === 0,
      text: 'Another hand for the Scriptorium. Sit, scribe. The ink has been waiting for you.',
    },
    {
      id: 'first-run',
      when: meta.runs === 1,
      text: 'You came back. They always do. Here — take this locket. It remembers fire.',
    },
    {
      id: 'first-win',
      when: meta.wins === 1 && r?.result === 'won',
      text: 'You wrote the last word. I have not said that to anyone in a very long time.',
    },
    {
      id: 'hydra',
      when: r?.killedBy === 'Hydra of Ands',
      text: 'The Hydra. Cut one head and two answer. Finish its words before the heads multiply.',
    },
    {
      id: 'mirror',
      when: r?.killedBy === 'Mirror Scribe',
      text: 'The Mirror Scribe. Do not read its words. Read its letters, one by one, as they sit.',
    },
    {
      id: 'blackout',
      when: r?.killedBy === 'Blackout',
      text: 'Blackout takes the words, never the memory. Look once. Then trust your hands.',
    },
    {
      id: 'redactor',
      when: r?.killedBy === 'The Redactor',
      text: 'The Redactor blots out letters. But words are stubborn. They want to be whole.',
    },
    {
      id: 'grammarian',
      when: r?.killedBy === 'The Grammarian',
      text: 'The Grammarian demands commas and full stops. Your right little finger knows the way.',
    },
    {
      id: 'wyrm',
      when: r?.killedBy === 'Lexicon Wyrm',
      text: 'The Wyrm is slow and its words are long. Do not rush. It cannot outpace a steady hand.',
    },
    {
      id: 'thief',
      when: !!r?.killedBy && ['Ligature Leech', 'The Asterisk'].includes(r.killedBy),
      text: 'Thieves steal combo, not courage. Kill them first; they are fragile.',
    },
    {
      id: 'act1-death',
      when: r?.result === 'lost' && r.act === 1 && meta.runs > 2,
      text: 'The Home Row still holds you. Try the gentle pace, or choose Aegis early for shield.',
    },
    {
      id: 'heat',
      when: (r?.heat ?? 0) >= 3 && r?.result === 'won',
      text: 'You swore Oaths and kept them. The muses noticed. So did I.',
    },
    {
      id: 'gentle',
      when: !!r?.gentle && r.result === 'won',
      text: 'Gentle or not, the words fell. When your hands are ready, the Oaths will be waiting.',
    },
    {
      id: 'upgrade',
      when: meta.ink >= 40 && Object.keys(meta.upgrades).length === 0,
      text: 'You carry Ink. The Codex of Hands can make you sturdier. Spend it — hands forget less than hearts.',
    },
    {
      id: 'practice',
      when: meta.runs >= 3 && Object.keys(meta.practice.best).length === 0,
      text: 'Even the best scribes practice between battles. The practice desk never bites back.',
    },
  ];
  const fresh = lines.find((l) => l.when && !meta.heard.includes(l.id));
  if (fresh) return fresh;
  const general = [
    'Every word you finish is a word that cannot hurt you again.',
    'Slow keys are not weak keys. They are keys that have not been asked enough.',
    'The muses favor those who return.',
    'Accuracy first. Speed follows like a loyal dog.',
    'I have read every run you have written. The later pages are better.',
  ];
  return { id: 'general', text: general[meta.runs % general.length] };
}

// ---------- practice ----------

export const PRACTICE_INK_PER_DAY = 60;

export interface PracticeAward {
  ink: number;
  streak: number;
  newBest: boolean;
  trials: TrialDef[];
}

const dayBefore = (day: string) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

/**
 * Record a finished practice test: daily streak, personal best, capped Ink, and trials.
 * `day` is the player's local date as YYYY-MM-DD. Mutates `meta`.
 */
export function recordPractice(
  meta: Meta,
  r: PracticeResult,
  day: string,
  trialId: string | null = null,
): PracticeAward {
  const p = meta.practice;
  if (p.lastDay !== day) p.streak = p.lastDay === dayBefore(day) ? p.streak + 1 : 1;
  p.lastDay = day;

  const newBest = r.seconds >= 10 && r.wpm > (p.best[r.testId] ?? 0);
  if (newBest) p.best[r.testId] = r.wpm;

  if (p.inkDay !== day) {
    p.inkDay = day;
    p.inkToday = 0;
  }
  const earned = Math.round((r.seconds / 10) * Math.max(0.5, Math.min(2, r.wpm / 40)) * r.accuracy ** 2);
  const ink = Math.max(0, Math.min(earned, PRACTICE_INK_PER_DAY - p.inkToday));
  p.inkToday += ink;
  meta.ink += ink;

  const trials: TrialDef[] = [];
  const t = trialId ? TRIALS.find((x) => x.id === trialId) : null;
  if (
    t &&
    !meta.trialsPassed.includes(t.id) &&
    r.testId === `${t.mode}-${t.amount}${t.punctuation ? '-punct' : ''}` &&
    r.wpm >= t.minWpm &&
    r.accuracy >= t.minAccuracy
  ) {
    meta.trialsPassed.push(t.id);
    meta.leaf += t.leaf;
    trials.push(t);
  }
  return { ink, streak: p.streak, newBest, trials };
}
