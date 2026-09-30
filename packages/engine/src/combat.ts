/**
 * One fight: typing, damage, enemy behaviors, boss phases and waves.
 * Pure and deterministic given the same inputs and random stream.
 */
import { BLACKOUT_VISIBLE_MS, BOSSES, MAX_MINIONS, MINION, PUNCTUATION, TRAIT_EVERY } from './content/enemies';
import { oath } from './content/oaths';
import { comboTier, removeMod, resolveWord, type BlessingId } from './mods';
import { pick, type Rng } from './rng';
import { GENTLE_SPEED } from './run';
import type { Enemy, EnemySpec, Run } from './state';
import { emptyStats, recordCorrect, recordError, type Stats } from './stats';

export interface CombatCtx {
  rng: Rng;
  /** Supplies a fresh word for an enemy, avoiding the given (lowercase) first letters. */
  nextWord(enemy: Enemy, excludeFirst: ReadonlySet<string>): string;
}

export interface Combat {
  /** ms of combat time elapsed (advances only while the game is running) */
  time: number;
  enemies: Enemy[];
  /** waves still to come, spawned when the field is cleared */
  waves: EnemySpec[][];
  wave: number;
  targetId: number | null;
  typed: string;
  combo: number;
  maxCombo: number;
  shield: number;
  correct: number;
  errors: number;
  words: number;
  /** clean words in a row */
  streak: number;
  coinsEarned: number;
  firstWordDone: boolean;
  burnClock: number;
  nextId: number;
  /** combat time of the last correct press, for latency stats and the Oath of Flow */
  lastCorrectAt: number | null;
  lastKeyAt: number;
  stats: Stats;
  over: 'win' | 'lose' | null;
}

export type CombatEvent =
  | { t: 'target'; enemyId: number }
  | { t: 'key-ok'; enemyId: number; key: string }
  | { t: 'key-miss'; key: string; expected: string | null }
  | { t: 'combo-tier'; tier: number }
  | { t: 'combo-break'; lost: number }
  | { t: 'combo-drain'; enemyId: number; lost: number }
  | { t: 'hit'; enemyId: number; dmg: number; crit: boolean; armored: boolean }
  | { t: 'burn'; enemyId: number; dmg: number }
  | { t: 'spark'; fromId: number; toId: number; dmg: number }
  | { t: 'zap'; enemyId: number; dmg: number }
  | { t: 'thorns'; enemyId: number; dmg: number }
  | { t: 'frost'; enemyId: number; ms: number }
  | { t: 'cold-snap' }
  | { t: 'kill'; enemyId: number }
  | { t: 'spawn'; enemyId: number }
  | { t: 'wave'; wave: number }
  | { t: 'new-word'; enemyId: number }
  | { t: 'word-shift'; enemyId: number }
  | { t: 'enemy-heal'; enemyId: number; amount: number }
  | { t: 'enemy-shield'; enemyId: number; amount: number }
  | { t: 'enemy-shield-break'; enemyId: number }
  | { t: 'phase'; enemyId: number; phase: number }
  | { t: 'player-hit'; enemyId: number; dmg: number; blocked: number }
  | { t: 'typo-hurt'; dmg: number }
  | { t: 'second-wind'; hp: number }
  | { t: 'shield'; amount: number }
  | { t: 'heal'; amount: number }
  | { t: 'coins'; amount: number }
  | { t: 'glass-shatter'; key: string }
  | { t: 'win' }
  | { t: 'lose' };

const THORNS_DMG = 4;
const VAMPIRE_EVERY = 25;
const VAMPIRE_HEAL = 3;
const COLD_SNAP_EVERY = 20;
const COLD_SNAP_MS = 1500;
const FLOW_BREAK_MS = 2500;
const STAGGER_MS = 1200;
const MIN_INTENT_MS = 2500;

const has = (run: Run, id: BlessingId) => run.blessings.includes(id);
const lower = (s: string) => s.toLowerCase();

/** Does `key` match `expected`? Case only matters under the Oath of Capitals. */
export function keyMatches(run: Run, key: string, expected: string | undefined): boolean {
  if (expected === undefined) return false;
  return oath(run.oaths, 'caps') ? key === expected : lower(key) === lower(expected);
}

// ---------- words ----------

function transformWord(run: Run, e: Enemy, word: string, ctx: CombatCtx): string {
  if (e.rule === 'mirror') return [...word].reverse().join('');
  if (e.rule === 'grammarian' && e.phase >= 2) {
    if (e.phase >= 3) word = `${word} ${ctx.nextWord({ ...e, minLen: 3, maxLen: 5 }, new Set())}`;
    return word + PUNCTUATION[Math.floor(ctx.rng() * PUNCTUATION.length)];
  }
  // Oaths change ordinary words (not boss rules, which already bend them).
  if (!e.rule && oath(run.oaths, 'caps') && ctx.rng() < 0.3) word = word[0].toUpperCase() + word.slice(1);
  if (!e.rule && oath(run.oaths, 'punct') && ctx.rng() < 0.3)
    word += PUNCTUATION[Math.floor(ctx.rng() * PUNCTUATION.length)];
  return word;
}

function assignWord(c: Combat, run: Run, e: Enemy, ctx: CombatCtx): void {
  const used = new Set(c.enemies.filter((o) => o.id !== e.id && o.word).map((o) => lower(o.word[0])));
  let word = '';
  for (let i = 0; i < 12; i++) {
    word = transformWord(run, e, ctx.nextWord(e, used), ctx);
    if (!used.has(lower(word[0]))) break;
  }
  e.word = word;
  e.shownAt = c.time;
  e.masked = [];
  if (e.rule === 'redactor') {
    // Blot out letters, never the first (you still need it to lock on).
    const count = e.phase >= 2 ? 2 : 1;
    const spots = [...Array(word.length).keys()].slice(1);
    while (e.masked.length < Math.min(count, spots.length)) {
      const i = spots.splice(Math.floor(ctx.rng() * spots.length), 1)[0];
      e.masked.push(i);
    }
  }
}

/** How long a Blackout word stays readable. */
export const blackoutVisibleMs = (e: Enemy): number => BLACKOUT_VISIBLE_MS[Math.min(e.phase, 2) - 1];

// ---------- spawning ----------

function spawn(c: Combat, run: Run, spec: EnemySpec, ctx: CombatCtx): Enemy {
  const e: Enemy = {
    ...spec,
    traits: [...spec.traits],
    shield: spec.shield ?? 0,
    id: c.nextId++,
    word: '',
    masked: [],
    shownAt: c.time,
    intent: 0,
    burn: 0,
    phase: 1,
    traitClock: 0,
  };
  c.enemies.push(e);
  assignWord(c, run, e, ctx);
  return e;
}

function minionSpec(like: Enemy): EnemySpec {
  const hp = Math.max(4, Math.round(like.maxHp * MINION.hp * (like.kind === 'boss' ? 0.3 : 1)));
  return {
    kind: 'minion',
    name: MINION.name,
    glyph: MINION.glyph,
    hp,
    maxHp: hp,
    atk: Math.max(1, Math.round(like.atk * MINION.atk)),
    intentMs: Math.round(like.intentMs * MINION.speed),
    minLen: 3,
    maxLen: 4,
    traits: [...MINION.traits],
  };
}

function spawnWave(c: Combat, run: Run, specs: EnemySpec[], ctx: CombatCtx, ev: CombatEvent[] | null): void {
  specs.forEach((s, i) => {
    const e = spawn(c, run, s, ctx);
    // Stagger so enemies don't all swing at once.
    e.intent = -i * STAGGER_MS;
    ev?.push({ t: 'spawn', enemyId: e.id });
  });
}

/**
 * Start a fight. `waves[0]` appears at once; later waves arrive when the field is cleared.
 * Carries in combo and shield from the run, and applies start-of-fight blessings.
 */
export function createCombat(waves: EnemySpec[][], ctx: CombatCtx, run?: Run): Combat {
  const c: Combat = {
    time: 0,
    enemies: [],
    waves: waves.slice(1),
    wave: 1,
    targetId: null,
    typed: '',
    combo: run?.carryCombo ?? 0,
    maxCombo: 0,
    shield: run?.carryShield ?? 0,
    correct: 0,
    errors: 0,
    words: 0,
    streak: 0,
    coinsEarned: 0,
    firstWordDone: false,
    burnClock: 0,
    nextId: 1,
    lastCorrectAt: null,
    lastKeyAt: 0,
    stats: emptyStats(),
    over: null,
  };
  if (run && has(run, 'golden-aegis')) c.shield += Math.floor(run.coins / 10);
  c.maxCombo = c.combo;
  spawnWave(c, run ?? DUMMY_RUN, waves[0] ?? [], ctx, null);
  return c;
}

/** For callers that build a fight without a run (tests, tutorials). */
const DUMMY_RUN = { oaths: {}, blessings: [], relics: [] } as unknown as Run;

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

// ---------- damage ----------

type Source = 'word' | 'spark' | 'burn' | 'thorns' | 'zap' | 'riposte' | 'steam';

/** Apply damage after armor, Brittle, Overcharge and enemy shields. Returns damage dealt to health. */
function dealDamage(
  c: Combat,
  run: Run,
  e: Enemy,
  amount: number,
  source: Source,
  ctx: CombatCtx,
  ev: CombatEvent[],
  wordLen = 0,
): number {
  if (!c.enemies.includes(e) || amount <= 0) return 0;
  let dmg = amount;
  if (source === 'word' && e.traits.includes('armored') && wordLen < 6) dmg = Math.ceil(dmg / 2);
  if (source !== 'burn' && has(run, 'brittle') && e.intent / e.intentMs < 0.3) dmg = Math.round(dmg * 1.25);
  if (source === 'spark' && has(run, 'overcharge') && e.hp > e.maxHp / 2) dmg *= 2;
  if (e.shield > 0) {
    const absorbed = Math.min(e.shield, dmg);
    e.shield -= absorbed;
    dmg -= absorbed;
    if (e.shield === 0) ev.push({ t: 'enemy-shield-break', enemyId: e.id });
  }
  e.hp -= dmg;
  if (e.hp > 0) {
    // A finished word gets a fresh word anyway; other damage refreshes it here so the new phase shows.
    checkPhase(c, run, e, ctx, ev, source !== 'word');
    return dmg;
  }
  kill(c, run, e, ctx, ev);
  return dmg;
}

function kill(c: Combat, run: Run, e: Enemy, ctx: CombatCtx, ev: CombatEvent[]): void {
  e.hp = 0;
  c.enemies = c.enemies.filter((o) => o !== e);
  if (c.targetId === e.id) cancelTarget(c);
  ev.push({ t: 'kill', enemyId: e.id });
  if (has(run, 'windfall')) addCoins(c, run, 3, ev);
  if (has(run, 'wildfire') && e.burn > 0 && c.enemies.length) {
    const to = pick(ctx.rng, c.enemies);
    to.burn += e.burn;
  }
  if (e.traits.includes('splitter') && e.kind !== 'minion') {
    for (let i = 0; i < 2; i++) {
      const m = spawn(c, run, minionSpec(e), ctx);
      m.intent = -i * 600;
      ev.push({ t: 'spawn', enemyId: m.id });
    }
  }
}

function checkPhase(c: Combat, run: Run, e: Enemy, ctx: CombatCtx, ev: CombatEvent[], refresh: boolean): void {
  if (!e.rule) return;
  const thresholds = BOSSES[e.rule].phases;
  while (e.phase - 1 < thresholds.length && e.hp / e.maxHp <= thresholds[e.phase - 1]) {
    e.phase++;
    ev.push({ t: 'phase', enemyId: e.id, phase: e.phase });
    if (e.rule === 'mirror') e.intentMs = Math.round(e.intentMs * 0.8);
    if (e.rule === 'mirror') {
      e.minLen += 2;
      e.maxLen += 2;
    }
    if (e.rule === 'wyrm' && !e.traits.includes('summoner')) e.traits.push('summoner');
    // A fresh word shows the new rule straight away (unless you're mid-word).
    if (refresh && c.targetId !== e.id) {
      assignWord(c, run, e, ctx);
      ev.push({ t: 'new-word', enemyId: e.id });
    }
  }
}

function addCoins(c: Combat, run: Run, amount: number, ev: CombatEvent[]): void {
  run.coins += amount;
  c.coinsEarned += amount;
  ev.push({ t: 'coins', amount });
}

function heal(run: Run, amount: number, ev: CombatEvent[]): void {
  const actual = Math.min(amount, run.maxHp - run.hp);
  if (actual <= 0) return;
  run.hp += actual;
  ev.push({ t: 'heal', amount: actual });
}

function zapRandom(c: Combat, run: Run, dmg: number, ctx: CombatCtx, ev: CombatEvent[]): void {
  if (!c.enemies.length) return;
  const to = pick(ctx.rng, c.enemies);
  ev.push({ t: 'zap', enemyId: to.id, dmg });
  dealDamage(c, run, to, dmg, 'zap', ctx, ev);
}

function checkEnd(c: Combat, run: Run, ctx: CombatCtx, ev: CombatEvent[]): void {
  if (c.over) return;
  if (run.hp <= 0) {
    if (run.secondWindLeft && run.bonuses.secondWind > 0) {
      run.secondWindLeft = false;
      run.hp = Math.max(1, Math.round(run.maxHp * run.bonuses.secondWind));
      ev.push({ t: 'second-wind', hp: run.hp });
      return;
    }
    run.hp = 0;
    c.over = 'lose';
    ev.push({ t: 'lose' });
  } else if (c.enemies.length === 0) {
    const next = c.waves.shift();
    if (next) {
      c.wave++;
      cancelTarget(c);
      spawnWave(c, run, next, ctx, ev);
      ev.push({ t: 'wave', wave: c.wave });
    } else {
      c.over = 'win';
      ev.push({ t: 'win' });
    }
  }
}

// ---------- typing ----------

function breakCombo(c: Combat, run: Run, ev: CombatEvent[]): void {
  const before = c.combo;
  c.combo = run.relics.includes('steady-hands') ? Math.floor(c.combo / 2) : 0;
  if (before >= 5) ev.push({ t: 'combo-break', lost: before - c.combo });
}

function miss(
  c: Combat,
  run: Run,
  key: string,
  e: Enemy | undefined,
  expected: string | null,
  ctx: CombatCtx,
  ev: CombatEvent[],
): void {
  c.errors++;
  c.streak = 0;
  if (expected) recordError(c.stats, lower(expected));
  breakCombo(c, run, ev);
  const k = expected ? lower(expected) : null;
  if (k && run.keyMods[k]?.some((b) => b.mod === 'glass')) {
    run.keyMods = removeMod(run.keyMods, k, 'glass');
    ev.push({ t: 'glass-shatter', key: k });
  }
  // Blackout words flash back after a mistake so it stays fair.
  if (e?.rule === 'blackout') e.shownAt = c.time;
  ev.push({ t: 'key-miss', key, expected });
  if (oath(run.oaths, 'fragile')) {
    run.hp -= 1;
    ev.push({ t: 'typo-hurt', dmg: 1 });
    checkEnd(c, run, ctx, ev);
  }
}

function completeWord(c: Combat, run: Run, e: Enemy, ctx: CombatCtx, ev: CombatEvent[]): void {
  const res = resolveWord(e.word, {
    keyMods: run.keyMods,
    relics: run.relics,
    blessings: run.blessings,
    combo: c.combo,
    firstWord: !c.firstWordDone,
    coins: run.coins,
    streak: c.streak,
  });
  c.firstWordDone = true;
  c.words++;
  c.streak++;
  cancelTarget(c);

  const armored = e.traits.includes('armored') && e.word.length < 6;
  ev.push({ t: 'hit', enemyId: e.id, dmg: armored ? Math.ceil(res.dmg / 2) : res.dmg, crit: res.crit, armored });
  e.burn += res.burn;
  if (res.frostMs) {
    if (has(run, 'steam') && e.burn > 0) dealDamage(c, run, e, e.burn, 'steam', ctx, ev);
    e.intent = Math.max(0, e.intent - res.frostMs);
    ev.push({ t: 'frost', enemyId: e.id, ms: res.frostMs });
    if (has(run, 'permafrost'))
      for (const o of c.enemies) if (o !== e) o.intent = Math.max(0, o.intent - res.frostMs / 2);
  }
  dealDamage(c, run, e, res.dmg, 'word', ctx, ev, e.word.length);

  for (const dmg of res.sparks) {
    const jumps = has(run, 'arc') ? 2 : 1;
    for (let j = 0; j < jumps; j++) {
      const others = c.enemies.filter((o) => o !== e);
      if (!others.length) break;
      const to = pick(ctx.rng, others);
      ev.push({ t: 'spark', fromId: e.id, toId: to.id, dmg });
      if (has(run, 'plasma')) to.burn += 2;
      dealDamage(c, run, to, dmg, 'spark', ctx, ev);
      if (has(run, 'currency')) addCoins(c, run, 1, ev);
    }
  }
  if (res.crit && has(run, 'thunderclap'))
    for (const o of [...c.enemies]) {
      ev.push({ t: 'zap', enemyId: o.id, dmg: 5 });
      dealDamage(c, run, o, 5, 'zap', ctx, ev);
    }
  if (res.coins) addCoins(c, run, res.coins, ev);
  if (res.shield) {
    c.shield += res.shield;
    ev.push({ t: 'shield', amount: res.shield });
  }
  if (res.heal) heal(run, res.heal, ev);

  if (c.enemies.includes(e)) {
    if (e.rule === 'hydra') {
      const heads = c.enemies.filter((o) => o.kind === 'minion').length;
      if (heads < (e.phase >= 2 ? 3 : 2)) {
        const spec = minionSpec(e);
        const head = spawn(c, run, { ...spec, name: 'Head', glyph: '&', intentMs: e.phase >= 2 ? 4200 : 5600 }, ctx);
        ev.push({ t: 'spawn', enemyId: head.id });
      }
    }
    assignWord(c, run, e, ctx);
    ev.push({ t: 'new-word', enemyId: e.id });
  }
  checkEnd(c, run, ctx, ev);
}

/** Handle one typed character at combat time `now` (ms). */
export function pressKey(c: Combat, run: Run, key: string, ctx: CombatCtx, now: number): CombatEvent[] {
  const ev: CombatEvent[] = [];
  if (c.over) return ev;
  c.lastKeyAt = now;

  let e = target(c);
  if (!e) {
    const candidates = c.enemies.filter((o) => keyMatches(run, key, o.word[0]));
    if (!candidates.length) {
      miss(c, run, key, undefined, null, ctx, ev);
      return ev;
    }
    // Most urgent enemy first.
    e = candidates.reduce((a, b) => (b.intent / b.intentMs > a.intent / a.intentMs ? b : a));
    c.targetId = e.id;
    c.typed = '';
    ev.push({ t: 'target', enemyId: e.id });
  }

  const expected = e.word[c.typed.length];
  if (!keyMatches(run, key, expected)) {
    miss(c, run, key, e, expected ?? null, ctx, ev);
    return ev;
  }

  const prev = c.typed.length > 0 ? lower(c.typed[c.typed.length - 1]) : null;
  const latency = prev && c.lastCorrectAt !== null ? now - c.lastCorrectAt : null;
  if (/[a-z]/i.test(expected)) recordCorrect(c.stats, lower(expected), prev, latency);
  c.lastCorrectAt = now;

  const tierBefore = comboTier(c.combo).tier;
  c.typed += expected;
  c.combo++;
  c.correct++;
  c.maxCombo = Math.max(c.maxCombo, c.combo);
  ev.push({ t: 'key-ok', enemyId: e.id, key: lower(expected) });
  const tierAfter = comboTier(c.combo).tier;
  if (tierAfter > tierBefore) ev.push({ t: 'combo-tier', tier: tierAfter });
  if (run.relics.includes('vampire') && c.combo % VAMPIRE_EVERY === 0) heal(run, VAMPIRE_HEAL, ev);
  if (has(run, 'cold-snap') && c.combo % COLD_SNAP_EVERY === 0) {
    for (const o of c.enemies) o.intent = Math.max(0, o.intent - COLD_SNAP_MS);
    ev.push({ t: 'cold-snap' });
  }
  if (has(run, 'static') && c.typed.length === 1) zapRandom(c, run, 2, ctx, ev);

  const t = target(c);
  if (t && c.typed === t.word) completeWord(c, run, t, ctx, ev);
  // A zap (Static) can kill the last enemy before the word is done.
  checkEnd(c, run, ctx, ev);
  return ev;
}

// ---------- time ----------

function attack(c: Combat, run: Run, e: Enemy, ctx: CombatCtx, ev: CombatEvent[]): void {
  const blocked = Math.min(c.shield, e.atk);
  c.shield -= blocked;
  run.hp -= e.atk - blocked;
  ev.push({ t: 'player-hit', enemyId: e.id, dmg: e.atk - blocked, blocked });
  if (blocked && has(run, 'riposte')) dealDamage(c, run, e, blocked, 'riposte', ctx, ev);
  if (e.traits.includes('thief') && c.combo > 0) {
    const lost = Math.min(10, c.combo);
    c.combo -= lost;
    ev.push({ t: 'combo-drain', enemyId: e.id, lost });
  }
  if (e.traits.includes('enrage')) e.intentMs = Math.max(MIN_INTENT_MS, Math.round(e.intentMs * 0.9));
  if (run.relics.includes('thorns')) {
    ev.push({ t: 'thorns', enemyId: e.id, dmg: THORNS_DMG });
    dealDamage(c, run, e, THORNS_DMG, 'thorns', ctx, ev);
  }
}

/** Enemy behaviors that run on timers: shifting words, healing, warding and summoning. */
function traitActions(c: Combat, run: Run, e: Enemy, dt: number, ctx: CombatCtx, ev: CombatEvent[]): void {
  const t = e.traits;
  if (t.includes('shifter') && c.time - e.shownAt >= TRAIT_EVERY.shifter!) {
    if (c.targetId === e.id) cancelTarget(c);
    assignWord(c, run, e, ctx);
    ev.push({ t: 'word-shift', enemyId: e.id });
  }
  const crossed = (every: number) => Math.floor(e.traitClock / every) > Math.floor((e.traitClock - dt) / every);
  if (t.includes('healer') && crossed(TRAIT_EVERY.healer!)) {
    const hurt = c.enemies.filter((o) => o.hp < o.maxHp).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (hurt) {
      const amount = Math.min(hurt.maxHp - hurt.hp, Math.round(e.maxHp * 0.3));
      hurt.hp += amount;
      ev.push({ t: 'enemy-heal', enemyId: hurt.id, amount });
    }
  }
  if (t.includes('warden') && crossed(TRAIT_EVERY.warden!)) {
    const amount = Math.round(e.maxHp * 0.25);
    for (const o of c.enemies) {
      o.shield += amount;
      ev.push({ t: 'enemy-shield', enemyId: o.id, amount });
    }
  }
  if (t.includes('summoner') && crossed(TRAIT_EVERY.summoner!)) {
    if (c.enemies.filter((o) => o.kind === 'minion').length < MAX_MINIONS) {
      const m = spawn(c, run, minionSpec(e), ctx);
      ev.push({ t: 'spawn', enemyId: m.id });
    }
  }
}

/** How fast enemy attack timers fill, after relics and oaths. */
export const intentRate = (run: Run): number =>
  (run.relics.includes('hourglass') ? 0.85 : 1) *
  (1 + 0.12 * oath(run.oaths, 'swift')) *
  (run.gentle ? GENTLE_SPEED : 1);

/** Advance time: enemy attacks, behaviors and burn. */
export function tick(c: Combat, run: Run, dt: number, ctx: CombatCtx): CombatEvent[] {
  const ev: CombatEvent[] = [];
  if (c.over) return ev;
  c.time += dt;
  const rate = intentRate(run);

  for (const e of [...c.enemies]) {
    if (!c.enemies.includes(e)) continue;
    e.intent += dt * rate;
    e.traitClock += dt;
    traitActions(c, run, e, dt, ctx, ev);
    if (e.intent >= e.intentMs) {
      e.intent = 0;
      attack(c, run, e, ctx, ev);
      if (run.hp <= 0) break;
    }
  }

  if (oath(run.oaths, 'brittle') && c.combo > 0 && c.time - c.lastKeyAt > FLOW_BREAK_MS) {
    breakCombo(c, run, ev);
    c.lastKeyAt = c.time;
  }

  const burnEvery = has(run, 'kindling') ? 500 : 1000;
  c.burnClock += dt;
  while (c.burnClock >= burnEvery) {
    c.burnClock -= burnEvery;
    for (const e of [...c.enemies]) {
      if (e.burn <= 0 || !c.enemies.includes(e)) continue;
      ev.push({ t: 'burn', enemyId: e.id, dmg: e.burn });
      const b = e.burn;
      e.burn--;
      dealDamage(c, run, e, b, 'burn', ctx, ev);
    }
  }

  checkEnd(c, run, ctx, ev);
  return ev;
}

export const wpm = (c: Combat): number => (c.time > 0 ? c.correct / 5 / (c.time / 60000) : 0);
