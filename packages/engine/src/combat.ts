import { comboTier, FROST_PUSH_MS, removeMod, resolveWord } from './mods';
import { pick, type Rng } from './rng';
import { hydraHead, MAX_HYDRA_HEADS } from './run';
import type { Enemy, EnemySpec, Run } from './state';
import { emptyStats, recordCorrect, recordError, type Stats } from './stats';

export interface CombatCtx {
  rng: Rng;
  /** Supplies a fresh word for an enemy, avoiding the given first letters. */
  nextWord(enemy: Enemy, excludeFirst: ReadonlySet<string>): string;
}

export interface Combat {
  /** ms of combat time elapsed (advances only while the game is running) */
  time: number;
  enemies: Enemy[];
  targetId: number | null;
  typed: string;
  combo: number;
  maxCombo: number;
  shield: number;
  correct: number;
  errors: number;
  words: number;
  coinsEarned: number;
  firstWordDone: boolean;
  burnClock: number;
  nextId: number;
  /** wall-clock time and key of the last correct press, for latency stats */
  lastCorrectAt: number | null;
  stats: Stats;
  over: 'win' | 'lose' | null;
}

export type CombatEvent =
  | { t: 'target'; enemyId: number }
  | { t: 'key-ok'; enemyId: number; key: string }
  | { t: 'key-miss'; key: string; expected: string | null }
  | { t: 'combo-tier'; tier: number }
  | { t: 'combo-break'; lost: number }
  | { t: 'hit'; enemyId: number; dmg: number; crit: boolean }
  | { t: 'burn'; enemyId: number; dmg: number }
  | { t: 'spark'; fromId: number; toId: number; dmg: number }
  | { t: 'thorns'; enemyId: number; dmg: number }
  | { t: 'frost'; enemyId: number; ms: number }
  | { t: 'kill'; enemyId: number }
  | { t: 'spawn'; enemyId: number }
  | { t: 'new-word'; enemyId: number }
  | { t: 'player-hit'; enemyId: number; dmg: number; blocked: number }
  | { t: 'shield'; amount: number }
  | { t: 'heal'; amount: number }
  | { t: 'coins'; amount: number }
  | { t: 'glass-shatter'; key: string }
  | { t: 'win' }
  | { t: 'lose' };

const THORNS_DMG = 4;
const VAMPIRE_EVERY = 25;
const VAMPIRE_HEAL = 3;

function assignWord(c: Combat, e: Enemy, ctx: CombatCtx): void {
  const used = new Set(c.enemies.filter((o) => o.id !== e.id).map((o) => o.word[0]));
  let word = ctx.nextWord(e, used);
  if (e.rule === 'mirror') {
    for (let i = 0; i < 10; i++) {
      word = [...word].reverse().join('');
      if (!used.has(word[0])) break;
      word = ctx.nextWord(e, used);
    }
  }
  e.word = word;
  e.shownAt = c.time;
}

function spawn(c: Combat, spec: EnemySpec, ctx: CombatCtx): Enemy {
  const e: Enemy = { ...spec, id: c.nextId++, word: '', shownAt: c.time, intent: 0, burn: 0 };
  c.enemies.push(e);
  assignWord(c, e, ctx);
  return e;
}

export function createCombat(specs: EnemySpec[], ctx: CombatCtx): Combat {
  const c: Combat = {
    time: 0,
    enemies: [],
    targetId: null,
    typed: '',
    combo: 0,
    maxCombo: 0,
    shield: 0,
    correct: 0,
    errors: 0,
    words: 0,
    coinsEarned: 0,
    firstWordDone: false,
    burnClock: 0,
    nextId: 1,
    lastCorrectAt: null,
    stats: emptyStats(),
    over: null,
  };
  specs.forEach((s, i) => {
    const e = spawn(c, s, ctx);
    // Stagger so enemies don't all swing at once.
    e.intent = -i * 1200;
  });
  return c;
}

export const target = (c: Combat): Enemy | undefined => c.enemies.find((e) => e.id === c.targetId);

export function cancelTarget(c: Combat): void {
  c.targetId = null;
  c.typed = '';
}

/** Delete the last typed letter; with nothing typed, drop the target. */
export function backspace(c: Combat): void {
  if (c.typed.length > 0) c.typed = c.typed.slice(0, -1);
  else cancelTarget(c);
  // Latency across a deletion isn't a real bigram.
  c.lastCorrectAt = null;
}

function damage(c: Combat, e: Enemy, dmg: number, ev: CombatEvent[]): void {
  e.hp -= dmg;
  if (e.hp > 0) return;
  e.hp = 0;
  c.enemies = c.enemies.filter((o) => o !== e);
  if (c.targetId === e.id) cancelTarget(c);
  ev.push({ t: 'kill', enemyId: e.id });
}

function checkEnd(c: Combat, run: Run, ev: CombatEvent[]): void {
  if (c.over) return;
  if (run.hp <= 0) {
    run.hp = 0;
    c.over = 'lose';
    ev.push({ t: 'lose' });
  } else if (c.enemies.length === 0) {
    c.over = 'win';
    ev.push({ t: 'win' });
  }
}

function miss(
  c: Combat,
  run: Run,
  key: string,
  e: Enemy | undefined,
  expected: string | null,
  ev: CombatEvent[],
): void {
  c.errors++;
  if (expected) recordError(c.stats, expected);
  const before = c.combo;
  c.combo = run.relics.includes('steady-hands') ? Math.floor(c.combo / 2) : 0;
  if (before >= 5) ev.push({ t: 'combo-break', lost: before - c.combo });
  if (expected && run.keyMods[expected]?.includes('glass')) {
    run.keyMods = removeMod(run.keyMods, expected, 'glass');
    ev.push({ t: 'glass-shatter', key: expected });
  }
  // Blackout words flash back after a mistake so it stays fair.
  if (e?.rule === 'blackout') e.shownAt = c.time;
  ev.push({ t: 'key-miss', key, expected });
}

function completeWord(c: Combat, run: Run, e: Enemy, ctx: CombatCtx, ev: CombatEvent[]): void {
  const res = resolveWord(e.word, run.keyMods, run.relics, c.combo, !c.firstWordDone);
  c.firstWordDone = true;
  c.words++;
  cancelTarget(c);

  ev.push({ t: 'hit', enemyId: e.id, dmg: res.dmg, crit: res.crit });
  e.burn += res.burn;
  if (res.frost) {
    const ms = res.frost * FROST_PUSH_MS;
    e.intent = Math.max(0, e.intent - ms);
    ev.push({ t: 'frost', enemyId: e.id, ms });
  }
  damage(c, e, res.dmg, ev);

  for (let i = 0; i < res.sparks; i++) {
    const others = c.enemies.filter((o) => o !== e);
    if (!others.length) break;
    const to = pick(ctx.rng, others);
    ev.push({ t: 'spark', fromId: e.id, toId: to.id, dmg: res.sparkDmg });
    damage(c, to, res.sparkDmg, ev);
  }
  if (res.coins) {
    run.coins += res.coins;
    c.coinsEarned += res.coins;
    ev.push({ t: 'coins', amount: res.coins });
  }
  if (res.shield) {
    c.shield += res.shield;
    ev.push({ t: 'shield', amount: res.shield });
  }
  if (res.heal) heal(run, res.heal, ev);

  if (e.hp > 0) {
    if (e.rule === 'hydra' && c.enemies.filter((o) => o.kind === 'head').length < MAX_HYDRA_HEADS) {
      const head = spawn(c, hydraHead(run), ctx);
      ev.push({ t: 'spawn', enemyId: head.id });
    }
    assignWord(c, e, ctx);
    ev.push({ t: 'new-word', enemyId: e.id });
  }
  checkEnd(c, run, ev);
}

function heal(run: Run, amount: number, ev: CombatEvent[]): void {
  const actual = Math.min(amount, run.maxHp - run.hp);
  if (actual <= 0) return;
  run.hp += actual;
  ev.push({ t: 'heal', amount: actual });
}

/** Handle one typed letter. `now` is wall-clock ms, used only for latency stats. */
export function pressKey(c: Combat, run: Run, key: string, ctx: CombatCtx, now: number): CombatEvent[] {
  const ev: CombatEvent[] = [];
  if (c.over) return ev;

  let e = target(c);
  if (!e) {
    const candidates = c.enemies.filter((o) => o.word[0] === key);
    if (!candidates.length) {
      miss(c, run, key, undefined, null, ev);
      return ev;
    }
    // Most urgent enemy first.
    e = candidates.reduce((a, b) => (b.intent / b.intentMs > a.intent / a.intentMs ? b : a));
    c.targetId = e.id;
    c.typed = '';
    ev.push({ t: 'target', enemyId: e.id });
  }

  const expected = e.word[c.typed.length];
  if (key !== expected) {
    miss(c, run, key, e, expected, ev);
    return ev;
  }

  const prev = c.typed.length > 0 ? c.typed[c.typed.length - 1] : null;
  const latency = prev && c.lastCorrectAt !== null ? now - c.lastCorrectAt : null;
  recordCorrect(c.stats, key, prev, latency);
  c.lastCorrectAt = now;

  const tierBefore = comboTier(c.combo).tier;
  c.typed += key;
  c.combo++;
  c.correct++;
  c.maxCombo = Math.max(c.maxCombo, c.combo);
  ev.push({ t: 'key-ok', enemyId: e.id, key });
  const tierAfter = comboTier(c.combo).tier;
  if (tierAfter > tierBefore) ev.push({ t: 'combo-tier', tier: tierAfter });
  if (run.relics.includes('vampire') && c.combo % VAMPIRE_EVERY === 0) heal(run, VAMPIRE_HEAL, ev);

  if (c.typed === e.word) completeWord(c, run, e, ctx, ev);
  return ev;
}

/** Advance time: enemy attacks and burn ticks. */
export function tick(c: Combat, run: Run, dt: number): CombatEvent[] {
  const ev: CombatEvent[] = [];
  if (c.over) return ev;
  c.time += dt;
  const rate = run.relics.includes('hourglass') ? 0.85 : 1;

  for (const e of [...c.enemies]) {
    e.intent += dt * rate;
    if (e.intent < e.intentMs) continue;
    e.intent = 0;
    const blocked = Math.min(c.shield, e.atk);
    c.shield -= blocked;
    run.hp -= e.atk - blocked;
    ev.push({ t: 'player-hit', enemyId: e.id, dmg: e.atk - blocked, blocked });
    if (run.relics.includes('thorns')) {
      ev.push({ t: 'thorns', enemyId: e.id, dmg: THORNS_DMG });
      damage(c, e, THORNS_DMG, ev);
    }
    if (run.hp <= 0) break;
  }

  c.burnClock += dt;
  while (c.burnClock >= 1000) {
    c.burnClock -= 1000;
    for (const e of [...c.enemies]) {
      if (e.burn <= 0) continue;
      ev.push({ t: 'burn', enemyId: e.id, dmg: e.burn });
      damage(c, e, e.burn, ev);
      e.burn--;
    }
  }

  checkEnd(c, run, ev);
  return ev;
}

export const wpm = (c: Combat): number => (c.time > 0 ? c.correct / 5 / (c.time / 60000) : 0);
