/**
 * Everything the server needs that must match the browser exactly: shared seeds for daily and weekly
 * runs, run and practice verification by replay, and the rules for merging progress across devices.
 */
import { OATH_IDS, OATHS, type OathLevels } from './content/oaths';
import {
  bonusesFrom,
  KEEPSAKE_IDS,
  KEEPSAKE_RUNS_PER_LEVEL,
  UPGRADE_IDS,
  UPGRADES,
  type UpgradeRanks,
} from './content/progression';
import { InvalidAction, newRunConfig, RULES_VERSION, RunMachine, type Action, type RunConfig } from './machine';
import { migrateMeta, type Meta } from './meta';
import {
  advancePractice,
  createPractice,
  pressPractice,
  summarizePractice,
  type PracticeConfig,
  type PracticeResult,
} from './practice';
import { makeRng, sample } from './rng';
import { runScore, STARTER_IDS } from './run';
import { NO_BONUSES, type RunBonuses, type StarterId } from './state';
import { mergeStats, type Stats } from './stats';

// ---------- shared seeds ----------

/** FNV-1a: a small, stable string hash both the browser and the server compute identically. */
export function seedFor(label: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < label.length; i++) {
    h ^= label.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** "daily:2026-10-01", by UTC date, so everyone shares the same day. */
export const dailyLabel = (d: Date = new Date()): string => `daily:${d.toISOString().slice(0, 10)}`;

/** "weekly:2026-W40", the ISO week in UTC. */
export function weeklyLabel(d: Date = new Date()): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `weekly:${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** The week's challenge: three Oaths at fixed levels, the same for everyone. */
export function weeklyOaths(label: string): OathLevels {
  const rng = makeRng(seedFor(label));
  const out: OathLevels = {};
  for (const id of sample(rng, OATH_IDS, 3)) out[id] = Math.max(1, Math.ceil(rng() * OATHS[id].max));
  return out;
}

/** The day's keyboard: everyone plays the daily with the same one, locked or not. */
export function dailyStarter(label: string): StarterId {
  const rng = makeRng(seedFor(`${label}:starter`));
  return STARTER_IDS[Math.floor(rng() * STARTER_IDS.length)];
}

/**
 * The config for today's daily or this week's challenge. Shared runs start everyone equal:
 * no permanent bonuses, no weak-key bias, and the shared seed (plus the day's keyboard, or the week's Oaths).
 */
export function sharedRunConfig(mode: 'daily' | 'weekly', starter: StarterId, now: Date = new Date()): RunConfig {
  if (mode === 'daily') {
    const label = dailyLabel(now);
    return newRunConfig(dailyStarter(label), seedFor(label), {}, { mode });
  }
  const label = weeklyLabel(now);
  return newRunConfig(starter, seedFor(label), {}, { mode, oaths: weeklyOaths(label) });
}

// ---------- verification ----------

/** Fastest believable gap between two keystrokes, and how many faster ones we tolerate. */
export const MIN_HUMAN_GAP_MS = 25;
const MAX_FAST_FRACTION = 0.03;
/** No fight is believable above this. */
const MAX_FIGHT_WPM = 250;

/** True when the only difference could be float noise from JSON. */
function sameBonuses(a: RunBonuses, b: RunBonuses): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Could permanent progress have produced these bonuses? Rebuild the upgrade ranks from the numbers,
 * then try every keepsake at every level (or none) and look for an exact match.
 */
export function bonusesPossible(b: RunBonuses): boolean {
  if (!b || typeof b !== 'object') return false;
  const ranks: UpgradeRanks = {
    vitality: b.maxHp / 3,
    purse: b.startCoins / 10,
    momentum: b.startCombo / 5,
    scholar: Math.round(b.inkBonus / 0.2),
    reroll: b.rerolls,
    insight: b.extraChoices,
    favor: b.firstBoonRarity,
    'second-wind': b.secondWind ? 1 : 0,
  };
  for (const id of UPGRADE_IDS) {
    const r = ranks[id]!;
    if (!Number.isInteger(r) || r < 0 || r > UPGRADES[id].costs.length) return false;
  }
  const keepsakes = [
    null,
    ...KEEPSAKE_IDS.flatMap((id) => [0, 1, 2].map((l) => ({ id, uses: l * KEEPSAKE_RUNS_PER_LEVEL }))),
  ];
  return keepsakes.some((k) => sameBonuses(bonusesFrom(ranks, k), b));
}

/** Everything about a config that can be checked before replaying it. */
function configProblem(config: RunConfig): string | null {
  if (!config || typeof config !== 'object') return 'no config';
  if (!STARTER_IDS.includes(config.starter)) return 'unknown keyboard';
  const oaths = config.oaths ?? {};
  for (const [id, lvl] of Object.entries(oaths)) {
    const def = OATHS[id as keyof typeof OATHS];
    if (!def || !Number.isInteger(lvl) || lvl < 0 || lvl > def.max) return 'impossible Oaths';
  }
  const shared = config.mode === 'daily' || config.mode === 'weekly';
  if (shared) {
    // Shared runs are the same for everyone: no permanent bonuses, no weak-key bias.
    if (!sameBonuses(config.bonuses, NO_BONUSES)) return 'shared runs start without bonuses';
    if (Object.keys(config.weak ?? {}).length) return 'shared runs use the plain word pool';
  } else if (!bonusesPossible(config.bonuses)) return 'impossible bonuses';
  for (const v of Object.values(config.weak ?? {}))
    if (typeof v !== 'number' || !Number.isFinite(v)) return 'bad config';
  return null;
}

export type Verdict = { ok: true; machine: RunMachine; score: number } | { ok: false; reason: string };

/** Keystroke timing that no human produces: too many near-instant gaps. */
function inhumanTiming(times: number[]): string | null {
  if (times.length < 20) return null;
  let fast = 0;
  for (let i = 1; i < times.length; i++)
    if (times[i] - times[i - 1] < MIN_HUMAN_GAP_MS && times[i] >= times[i - 1]) fast++;
  return fast / times.length > MAX_FAST_FRACTION ? `too many keystrokes under ${MIN_HUMAN_GAP_MS} ms apart` : null;
}

/**
 * Replay a submitted run on the server. A run passes if the log replays cleanly to a finished run,
 * its timing looks human, and (for daily/weekly runs) it used the shared seed and Oaths.
 */
export function verifyRun(config: RunConfig, actions: Action[], now: Date = new Date()): Verdict {
  if (config.rules !== RULES_VERSION) return { ok: false, reason: 'made with an older version of the rules' };
  if (config.gentle) return { ok: false, reason: 'gentle pace runs are not ranked' };
  const problem = configProblem(config);
  if (problem) return { ok: false, reason: problem };
  if (config.mode === 'daily') {
    const label = dailyLabel(now);
    if (config.seed !== seedFor(label)) return { ok: false, reason: "not today's daily seed" };
    if (config.starter !== dailyStarter(label)) return { ok: false, reason: "not today's keyboard" };
  }
  if (config.mode === 'weekly') {
    const label = weeklyLabel(now);
    if (config.seed !== seedFor(label)) return { ok: false, reason: "not this week's seed" };
    if (JSON.stringify(config.oaths) !== JSON.stringify(weeklyOaths(label)))
      return { ok: false, reason: "not this week's Oaths" };
  }
  let machine: RunMachine;
  try {
    machine = RunMachine.replay(config, actions);
  } catch (e) {
    return { ok: false, reason: e instanceof InvalidAction ? `invalid log: ${e.message}` : 'replay failed' };
  }
  if (machine.view.kind !== 'over') return { ok: false, reason: 'the run is not finished' };

  // Each fight's keystrokes live on its own clock; check timing fight by fight.
  let fight: number[] = [];
  for (const a of actions) {
    if (a.t === 'key') fight.push(a.at);
    else if (a.t !== 'bs' && a.t !== 'untarget' && a.t !== 'time') {
      const bad = inhumanTiming(fight);
      if (bad) return { ok: false, reason: bad };
      fight = [];
    }
  }
  const bad = inhumanTiming(fight);
  if (bad) return { ok: false, reason: bad };
  if (machine.report.fights.some((f) => f.wpm > MAX_FIGHT_WPM)) return { ok: false, reason: 'impossible speed' };
  return { ok: true, machine, score: runScore(machine.run) };
}

export interface PracticeInput {
  k: string;
  at: number;
}

/** Replay a practice test from its keystrokes, so the server computes the result itself. */
export function replayPractice(config: PracticeConfig, inputs: PracticeInput[]): PracticeResult | null {
  const s = createPractice(config);
  let last = -Infinity;
  for (const { k, at } of inputs) {
    if (typeof k !== 'string' || k.length !== 1 || !(at >= last)) return null;
    last = at;
    pressPractice(s, k, at);
  }
  if (config.mode === 'time' && s.startAt !== null) advancePractice(s, s.startAt + config.amount * 1000);
  if (!s.done) return null;
  if (inhumanTiming(inputs.map((i) => i.at))) return null;
  return summarizePractice(s);
}

// ---------- merging progress across devices ----------

const union = <T>(a: T[] = [], b: T[] = []): T[] => [...new Set([...a, ...b])];

function maxRecord(a: Record<string, number> = {}, b: Record<string, number> = {}): Record<string, number> {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = Math.max(out[k] ?? 0, v);
  return out;
}

/**
 * Combine two copies of progress into one that loses nothing.
 * - Collections (unlocks, keepsakes, prophecies, codex, trials) are unioned.
 * - Records and bests take the maximum.
 * - Spendable currencies and settings-like choices come from `newer`.
 * When `firstSignIn` is true, the guest's local progress is being folded into an existing account,
 * so currencies are added together instead (nothing earned offline is thrown away).
 */
export function mergeMeta(older: Meta, newer: Meta, firstSignIn = false): Meta {
  const a = migrateMeta(older);
  const b = migrateMeta(newer);
  const prophecies = { ...b.prophecies };
  for (const [id, date] of Object.entries(a.prophecies))
    if (!prophecies[id] || date < prophecies[id]) prophecies[id] = date;
  return {
    ...b,
    runs: firstSignIn ? a.runs + b.runs : Math.max(a.runs, b.runs),
    wins: firstSignIn ? a.wins + b.wins : Math.max(a.wins, b.wins),
    bestAct: Math.max(a.bestAct, b.bestAct),
    bestScore: Math.max(a.bestScore, b.bestScore),
    maxHeatWon: Math.max(a.maxHeatWon, b.maxHeatWon),
    unlocked: union(a.unlocked, b.unlocked),
    prologueDone: a.prologueDone || b.prologueDone,
    ink: firstSignIn ? a.ink + b.ink : b.ink,
    leaf: firstSignIn ? a.leaf + b.leaf : b.leaf,
    seals: firstSignIn ? a.seals + b.seals : b.seals,
    upgrades: maxRecord(a.upgrades, b.upgrades),
    keepsakes: union(a.keepsakes, b.keepsakes),
    keepsakeUses: maxRecord(a.keepsakeUses, b.keepsakeUses),
    prophecies,
    codex: {
      enemies: maxRecord(a.codex.enemies, b.codex.enemies),
      bosses: maxRecord(a.codex.bosses, b.codex.bosses),
      events: union(a.codex.events, b.codex.events),
      boons: union(a.codex.boons, b.codex.boons),
    },
    winsByStarter: maxRecord(a.winsByStarter, b.winsByStarter),
    practice: {
      ...b.practice,
      best: maxRecord(a.practice.best, b.practice.best),
      lessonLetters: Math.max(a.practice.lessonLetters, b.practice.lessonLetters),
      streak: Math.max(a.practice.streak, b.practice.streak),
    },
    heard: union(a.heard, b.heard),
    trialsPassed: union(a.trialsPassed, b.trialsPassed),
  };
}

/** Key stats: on first sign-in both histories are real, so add them; later, the newer copy wins. */
export function mergeStatsFor(older: Stats, newer: Stats, firstSignIn = false): Stats {
  return firstSignIn ? mergeStats(structuredClone(newer), older) : structuredClone(newer);
}
