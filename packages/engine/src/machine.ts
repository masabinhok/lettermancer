/**
 * The whole run as a deterministic state machine.
 *
 * A run is fully described by its `RunConfig` plus the list of `Action`s the player took.
 * Replaying the same actions against the same config always produces the same state —
 * that is what save/resume, ghosts, and server-side run verification are built on.
 *
 * Time only moves in fixed `STEP_MS` increments, so a replay that jumps straight to the
 * next key press lands in exactly the same state as a live game that ran frame by frame.
 */
import { backspace, cancelTarget, createCombat, pressKey, tick, wpm, type Combat, type CombatCtx, type CombatEvent } from './combat';
import WORDS from './content/words.json';
import { installMod, type ModId, type RelicId } from './mods';
import { deriveSeed, makeRng, type Rng } from './rng';
import { advance, currentNode, makeEncounter, newRun, REROLL_BASE, rollReward, rollShop, type FightReward, type ShopItem } from './run';
import type { NodeKind, Run, StarterId } from './state';
import { mergeStats, type Stats } from './stats';
import { WordBank } from './words';

/** Simulation step. Every combat timestamp is advanced to in multiples of this. */
export const STEP_MS = 5;
/** Bump when rules change in a way that would alter old replays. */
export const RULES_VERSION = 1;

export interface RunConfig {
  rules: number;
  seed: number;
  starter: StarterId;
  /** Snapshot of the player's key weakness at run start — drives adaptive word picks. */
  weak: Record<string, number>;
}

export type Action =
  /** a typed character at combat time `at` (ms) */
  | { t: 'key'; k: string; at: number }
  /** backspace at combat time `at` */
  | { t: 'bs'; at: number }
  /** drop the current target */
  | { t: 'untarget'; at: number }
  /** let combat time pass to `at` (only recorded when it changes the outcome, or on save) */
  | { t: 'time'; at: number }
  /** choose offer `i` on a reward screen, or -1 to skip */
  | { t: 'pick'; i: number }
  /** put the pending mod on key `k`, or discard it with null */
  | { t: 'install'; k: string | null }
  | { t: 'buy'; i: number }
  | { t: 'reroll' }
  /** leave the shop */
  | { t: 'leave' };

export interface FightSummary {
  node: NodeKind;
  words: number;
  wpm: number;
  maxCombo: number;
  errors: number;
  coins: number;
  interest: number;
  healed: number;
  perfect: boolean;
  /** typing stats from this fight only */
  stats: Stats;
}

export type View =
  | { kind: 'combat'; node: NodeKind; combat: Combat }
  | { kind: 'reward'; stage: 'relic' | 'mod'; reward: FightReward; summary: FightSummary }
  | { kind: 'install'; mod: ModId; from: 'reward' | 'shop' }
  | { kind: 'shop'; items: ShopItem[]; rerolls: number }
  | { kind: 'over'; result: 'won' | 'lost'; summary: FightSummary | null };

export type MachineEvent =
  | CombatEvent
  | { t: 'fight-start'; node: NodeKind }
  | { t: 'fight-end'; result: 'win' | 'lose'; summary: FightSummary }
  | { t: 'node'; node: NodeKind; act: number }
  | { t: 'new-act'; act: number }
  | { t: 'installed'; key: string; mod: ModId }
  | { t: 'bought'; item: ShopItem }
  | { t: 'relic'; relic: RelicId }
  | { t: 'run-end'; result: 'won' | 'lost' };

export class InvalidAction extends Error {}

/** What happened in a run, for local analytics and balance work. Derived purely from the replay. */
export interface RunReport {
  starter: StarterId;
  result: 'won' | 'lost' | null;
  act: number;
  node: number;
  killedBy: string | null;
  fights: { node: NodeKind; act: number; ms: number; words: number; wpm: number; errors: number; hpLost: number }[];
  picks: { kind: 'mod' | 'relic' | 'buy' | 'skip' | 'install'; id: string }[];
  /** slowest words by time per letter */
  slowWords: { word: string; ms: number }[];
}

const SLOW_WORDS_KEPT = 10;

const PERFECT_MIN_WORDS = 5;
const BOSS_HEAL = 0.4;

let sharedBank: WordBank | null = null;
const bank = () => (sharedBank ??= new WordBank(WORDS));

export class RunMachine {
  readonly run: Run;
  readonly actions: Action[] = [];
  readonly report: RunReport;
  view: View;
  private fightStartHp = 0;
  private lastHitBy: string | null = null;
  private wordStart: { word: string; at: number } | null = null;
  private rngWords: Rng;
  private rngEncounters: Rng;
  private rngRewards: Rng;
  private rngShop: Rng;
  private rngCombat: Rng;
  private ctx: CombatCtx;

  constructor(readonly config: RunConfig) {
    const s = config.seed;
    this.run = newRun(config.starter, s, makeRng(deriveSeed(s, 0)));
    this.report = { starter: config.starter, result: null, act: 1, node: 0, killedBy: null, fights: [], picks: [], slowWords: [] };
    this.rngWords = makeRng(deriveSeed(s, 1));
    this.rngEncounters = makeRng(deriveSeed(s, 2));
    this.rngRewards = makeRng(deriveSeed(s, 3));
    this.rngShop = makeRng(deriveSeed(s, 4));
    this.rngCombat = makeRng(deriveSeed(s, 5));
    this.ctx = {
      rng: this.rngCombat,
      nextWord: (enemy, excludeFirst) =>
        bank().pick(
          {
            min: enemy.minLen,
            max: enemy.maxLen,
            excludeFirst,
            weak: config.weak,
            modded: new Set(Object.keys(this.run.keyMods)),
          },
          this.rngWords,
        ).word,
    };
    this.view = this.enterNode([]);
  }

  /** Rebuild a machine from a saved or submitted action log. Throws `InvalidAction` on a bad log. */
  static replay(config: RunConfig, actions: readonly Action[]): RunMachine {
    if (config.rules !== RULES_VERSION) throw new InvalidAction(`rules version ${config.rules} != ${RULES_VERSION}`);
    const m = new RunMachine(config);
    for (const a of actions) m.dispatch(a);
    return m;
  }

  get combat(): Combat | null {
    return this.view.kind === 'combat' ? this.view.combat : null;
  }

  /** Everything needed to resume or verify this run. Pass the current combat time when mid-fight. */
  save(now?: number): { config: RunConfig; actions: Action[] } {
    const c = this.combat;
    if (c && now !== undefined && now > c.time) {
      const before = this.actions.length;
      this.dispatch({ t: 'time', at: now });
      // Always keep the save point, even when nothing happened in that stretch.
      if (this.actions.length === before) this.actions.push({ t: 'time', at: now });
    }
    return { config: this.config, actions: [...this.actions] };
  }

  dispatch(a: Action): MachineEvent[] {
    const ev: MachineEvent[] = [];
    const v = this.view;
    switch (a.t) {
      case 'key':
      case 'bs':
      case 'untarget':
      case 'time': {
        if (v.kind !== 'combat') throw new InvalidAction(`${a.t} outside combat`);
        const c = v.combat;
        if (!Number.isFinite(a.at) || a.at < c.time) throw new InvalidAction(`time went backwards (${a.at} < ${c.time})`);
        const endedByTime = this.advanceTo(c, a.at, ev);
        if (a.t === 'time') {
          // Idle time only matters for the record when it decides the fight.
          if (endedByTime) this.actions.push(a);
        } else {
          this.actions.push(a);
          if (!c.over) {
            if (a.t === 'key') {
              if (a.k.length !== 1) throw new InvalidAction('key must be one character');
              const kev = pressKey(c, this.run, a.k, this.ctx, a.at);
              this.trackWords(c, kev, a.at);
              ev.push(...kev);
            } else if (a.t === 'bs') backspace(c);
            else cancelTarget(c);
          }
        }
        if (c.over) this.endFight(v.node, c, ev);
        return ev;
      }
      case 'pick': {
        if (v.kind !== 'reward') throw new InvalidAction('pick outside reward');
        this.actions.push(a);
        if (v.stage === 'relic') {
          const relic = v.reward.relics[a.i];
          if (a.i !== -1 && !relic) throw new InvalidAction('no such relic');
          if (relic) {
            this.run.relics.push(relic);
            ev.push({ t: 'relic', relic });
          }
          this.report.picks.push(relic ? { kind: 'relic', id: relic } : { kind: 'skip', id: 'relic' });
          this.view = { ...v, stage: 'mod' };
        } else {
          const mod = v.reward.mods[a.i];
          if (a.i !== -1 && !mod) throw new InvalidAction('no such mod');
          this.report.picks.push(mod ? { kind: 'mod', id: mod } : { kind: 'skip', id: 'mod' });
          if (mod) this.view = { kind: 'install', mod, from: 'reward' };
          else this.view = this.next(ev);
        }
        return ev;
      }
      case 'install': {
        if (v.kind !== 'install') throw new InvalidAction('install outside install');
        if (a.k !== null && !/^[a-z]$/.test(a.k)) throw new InvalidAction('install needs a letter');
        this.actions.push(a);
        if (a.k) {
          this.run.keyMods = installMod(this.run.keyMods, a.k, v.mod).keyMods;
          ev.push({ t: 'installed', key: a.k, mod: v.mod });
          this.report.picks.push({ kind: 'install', id: `${v.mod}:${a.k}` });
        }
        this.view = v.from === 'shop' && this.shopView ? this.shopView : this.next(ev);
        return ev;
      }
      case 'buy': {
        if (v.kind !== 'shop') throw new InvalidAction('buy outside shop');
        const it = v.items[a.i];
        if (!it || it.sold) throw new InvalidAction('nothing to buy there');
        if (it.cost > this.run.coins) throw new InvalidAction('not enough coins');
        this.actions.push(a);
        this.run.coins -= it.cost;
        it.sold = true;
        ev.push({ t: 'bought', item: it });
        this.report.picks.push({ kind: 'buy', id: it.kind === 'mod' ? it.mod : it.kind === 'relic' ? it.relic : 'heal' });
        if (it.kind === 'relic') this.run.relics.push(it.relic);
        else if (it.kind === 'heal') this.run.hp = Math.min(this.run.maxHp, this.run.hp + it.amount);
        else {
          this.shopView = v;
          this.view = { kind: 'install', mod: it.mod, from: 'shop' };
        }
        return ev;
      }
      case 'reroll': {
        if (v.kind !== 'shop') throw new InvalidAction('reroll outside shop');
        const cost = REROLL_BASE + v.rerolls;
        if (cost > this.run.coins) throw new InvalidAction('not enough coins');
        this.actions.push(a);
        this.run.coins -= cost;
        this.view = { kind: 'shop', items: rollShop(this.run, this.rngShop), rerolls: v.rerolls + 1 };
        return ev;
      }
      case 'leave': {
        if (v.kind !== 'shop') throw new InvalidAction('leave outside shop');
        this.actions.push(a);
        this.view = this.next(ev);
        return ev;
      }
    }
  }

  private shopView: Extract<View, { kind: 'shop' }> | null = null;

  /** Step combat time forward to `at`. Returns true if the fight ended on the way. */
  private advanceTo(c: Combat, at: number, ev: MachineEvent[]): boolean {
    while (!c.over && c.time + STEP_MS <= at) {
      const tev = tick(c, this.run, STEP_MS);
      for (const e of tev) if (e.t === 'player-hit') this.lastHitBy = c.enemies.find((x) => x.id === e.enemyId)?.name ?? this.lastHitBy;
      ev.push(...tev);
    }
    return c.over !== null;
  }

  private trackWords(c: Combat, kev: CombatEvent[], at: number): void {
    for (const e of kev) {
      if (e.t === 'target') {
        const word = c.enemies.find((x) => x.id === e.enemyId)?.word;
        this.wordStart = word ? { word, at } : null;
      } else if (e.t === 'hit' && this.wordStart) {
        const { word, at: start } = this.wordStart;
        const slow = this.report.slowWords;
        slow.push({ word, ms: at - start });
        slow.sort((x, y) => y.ms / y.word.length - x.ms / x.word.length);
        slow.length = Math.min(slow.length, SLOW_WORDS_KEPT);
        this.wordStart = null;
      }
    }
  }

  private endFight(node: NodeKind, c: Combat, ev: MachineEvent[]): void {
    const run = this.run;
    const t = run.totals;
    t.correct += c.correct;
    t.errors += c.errors;
    t.activeMs += c.time;
    t.maxCombo = Math.max(t.maxCombo, c.maxCombo);
    t.words += c.words;
    if (c.words >= 3) t.peakWpm = Math.max(t.peakWpm, wpm(c));
    mergeStats(run.stats, c.stats);

    this.report.fights.push({
      node,
      act: run.act,
      ms: c.time,
      words: c.words,
      wpm: Math.round(wpm(c)),
      errors: c.errors,
      hpLost: Math.max(0, this.fightStartHp - run.hp),
    });
    const summary: FightSummary = {
      node,
      words: c.words,
      wpm: wpm(c),
      maxCombo: c.maxCombo,
      errors: c.errors,
      coins: c.coinsEarned,
      interest: 0,
      healed: 0,
      perfect: c.errors === 0 && c.words >= PERFECT_MIN_WORDS,
      stats: c.stats,
    };

    if (c.over === 'lose') {
      run.result = 'lost';
      Object.assign(this.report, { result: 'lost', act: run.act, node: run.node, killedBy: this.lastHitBy });
      ev.push({ t: 'fight-end', result: 'lose', summary }, { t: 'run-end', result: 'lost' });
      this.view = { kind: 'over', result: 'lost', summary };
      return;
    }

    t.fights++;
    if (summary.perfect) t.perfectFights++;
    const reward = rollReward(run, node, this.rngRewards);
    run.coins += reward.coins;
    summary.coins += reward.coins;
    if (run.relics.includes('interest')) {
      summary.interest = Math.min(5, Math.floor(run.coins / 5));
      run.coins += summary.interest;
    }
    if (node === 'boss') {
      summary.healed = Math.min(run.maxHp - run.hp, Math.round(run.maxHp * BOSS_HEAL));
      run.hp += summary.healed;
    }
    ev.push({ t: 'fight-end', result: 'win', summary });
    this.view = { kind: 'reward', stage: reward.relics.length ? 'relic' : 'mod', reward, summary };
  }

  /** Leave the current node and enter the next one. */
  private next(ev: MachineEvent[]): View {
    const r = advance(this.run);
    if (r === 'victory') {
      Object.assign(this.report, { result: 'won', act: 3, node: this.run.node });
      ev.push({ t: 'run-end', result: 'won' });
      return { kind: 'over', result: 'won', summary: null };
    }
    if (r === 'new-act') ev.push({ t: 'new-act', act: this.run.act });
    return this.enterNode(ev);
  }

  private enterNode(ev: MachineEvent[]): View {
    const node = currentNode(this.run);
    ev.push({ t: 'node', node, act: this.run.act });
    if (node === 'shop') {
      this.shopView = { kind: 'shop', items: rollShop(this.run, this.rngShop), rerolls: 0 };
      return this.shopView;
    }
    const combat = createCombat(makeEncounter(this.run, node, this.rngEncounters), this.ctx);
    this.fightStartHp = this.run.hp;
    this.wordStart = null;
    ev.push({ t: 'fight-start', node });
    return { kind: 'combat', node, combat };
  }
}

/** Build a config for a fresh run. */
export function newRunConfig(starter: StarterId, seed: number, weak: Record<string, number> = {}): RunConfig {
  return { rules: RULES_VERSION, seed: seed >>> 0, starter, weak };
}
