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
import {
  backspace,
  cancelTarget,
  createCombat,
  keyMatches,
  pressKey,
  tick,
  wpm,
  type Combat,
  type CombatCtx,
  type CombatEvent,
} from './combat';
import { CURSES, EVENT_IDS, FOLIO_TYPO_HP, TRIAL_MS, type EventId } from './content/events';
import { type OathLevels } from './content/oaths';
import WORDS from './content/words.json';
import { BOSS_RELIC, installMod, MUSE_IDS, MUSES, type Rarity, type RelicId } from './mods';
import { deriveSeed, makeRng, pick, sample, type Rng } from './rng';
import {
  ACTS,
  fightCoins,
  makeEncounter,
  museOffers,
  newRun,
  relicOffers,
  REROLL_BASE,
  rollDoors,
  rollShop,
  ROOMS_PER_ACT,
  type Offer,
  type ShopItem,
} from './run';
import {
  NO_BONUSES,
  type Door,
  type DoorReward,
  type MuseId,
  type NodeKind,
  type Run,
  type RunBonuses,
  type StarterId,
} from './state';
import { mergeStats, type Stats } from './stats';
import { WordBank } from './words';

/** Simulation step. Every combat timestamp is advanced to in multiples of this. */
export const STEP_MS = 5;
/** Bump when rules change in a way that would alter old replays. */
export const RULES_VERSION = 4;

export type RunMode = 'standard' | 'daily' | 'weekly';

export interface RunConfig {
  rules: number;
  seed: number;
  starter: StarterId;
  /** Snapshot of the player's key weakness at run start — drives adaptive word picks. */
  weak: Record<string, number>;
  oaths: OathLevels;
  bonuses: RunBonuses;
  mode: RunMode;
  /** Gentle pace assist (not eligible for leaderboards) */
  gentle: boolean;
}

export type Action =
  /** a typed character at combat/challenge time `at` (ms) */
  | { t: 'key'; k: string; at: number }
  | { t: 'bs'; at: number }
  | { t: 'untarget'; at: number }
  /** let time pass to `at` (only recorded when it changes the outcome, or on save) */
  | { t: 'time'; at: number }
  /** walk through door `i` */
  | { t: 'door'; i: number }
  /** take offer `i` on a reward screen, or -1 to move on */
  | { t: 'pick'; i: number }
  /** put the pending key power on key `k`, or discard it with null */
  | { t: 'install'; k: string | null }
  | { t: 'buy'; i: number }
  /** restock the shop, or re-roll a reward screen */
  | { t: 'reroll' }
  /** choose event option `i` */
  | { t: 'option'; i: number }
  /** leave the shop, or continue past an event's outcome */
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

export interface EventOption {
  label: string;
  detail: string;
  enabled: boolean;
}

export type View =
  | { kind: 'doors'; doors: Door[] }
  | { kind: 'combat'; node: NodeKind; reward: DoorReward | null; combat: Combat }
  | {
      kind: 'reward';
      title: string;
      /** muse the offers come from, if any */
      muse: MuseId | null;
      offers: Offer[];
      summary: FightSummary | null;
      canReroll: boolean;
    }
  | { kind: 'install'; mod: Extract<Offer, { kind: 'power' }>; from: 'reward' | 'shop' }
  | { kind: 'shop'; items: ShopItem[]; rerolls: number }
  | { kind: 'event'; id: EventId; muse: MuseId | null; options: EventOption[]; outcome: string | null }
  | {
      kind: 'challenge';
      purpose: 'folio' | 'trial';
      text: string;
      typed: string;
      errors: number;
      /** challenge clock (ms since it began) */
      time: number;
      /** clock time of the first keystroke, when the limit starts counting */
      startedAt: number | null;
      limitMs: number | null;
    }
  | { kind: 'over'; result: 'won' | 'lost'; summary: FightSummary | null };

export type MachineEvent =
  | CombatEvent
  | { t: 'fight-start'; node: NodeKind }
  | { t: 'fight-end'; result: 'win' | 'lose'; summary: FightSummary }
  | { t: 'room'; node: NodeKind; act: number; room: number }
  | { t: 'new-act'; act: number }
  | { t: 'installed'; key: string; mod: string; upgraded: boolean }
  | { t: 'bought'; item: ShopItem }
  | { t: 'relic'; relic: RelicId }
  | { t: 'blessing'; id: string }
  | { t: 'challenge-key'; ok: boolean }
  | { t: 'challenge-end'; won: boolean }
  | { t: 'run-end'; result: 'won' | 'lost' };

export class InvalidAction extends Error {}

/** What happened in a run, for local analytics and balance work. Derived purely from the replay. */
export interface RunReport {
  starter: StarterId;
  result: 'won' | 'lost' | null;
  act: number;
  room: number;
  killedBy: string | null;
  fights: { node: NodeKind; act: number; ms: number; words: number; wpm: number; errors: number; hpLost: number }[];
  picks: {
    kind: 'power' | 'blessing' | 'relic' | 'buy' | 'skip' | 'install' | 'door' | 'event';
    id: string;
  }[];
  /** slowest words by time per letter */
  slowWords: { word: string; ms: number }[];
  bossesBeaten: string[];
  enemiesSeen: string[];
}

const SLOW_WORDS_KEPT = 10;
const PERFECT_MIN_WORDS = 5;
const BOSS_HEAL = 0.4;
const HEAL_DOOR = 0.35;
const COMBO_CARRY = 0.5;
const BULWARK_MAX = 10;

let sharedBank: WordBank | null = null;
const bank = () => (sharedBank ??= new WordBank(WORDS));

type RewardView = Extract<View, { kind: 'reward' }>;

export class RunMachine {
  readonly run: Run;
  readonly actions: Action[] = [];
  readonly report: RunReport;
  view: View;
  private rng: Record<'words' | 'encounters' | 'rewards' | 'shop' | 'combat' | 'doors' | 'events', Rng>;
  private ctx: CombatCtx;
  private history: NodeKind[] = [];
  private fightStartHp = 0;
  private lastHitBy: string | null = null;
  private wordStart: { word: string; at: number } | null = null;
  private shopView: Extract<View, { kind: 'shop' }> | null = null;
  private firstBoonGiven = false;

  constructor(readonly config: RunConfig) {
    const s = config.seed;
    const stream = (n: number) => makeRng(deriveSeed(s, n));
    this.rng = {
      words: stream(1),
      encounters: stream(2),
      rewards: stream(3),
      shop: stream(4),
      combat: stream(5),
      doors: stream(6),
      events: stream(7),
    };
    this.run = newRun(config.starter, s, stream(0), config.oaths, config.bonuses, config.gentle);
    this.report = {
      starter: config.starter,
      result: null,
      act: 1,
      room: 0,
      killedBy: null,
      fights: [],
      picks: [],
      slowWords: [],
      bossesBeaten: [],
      enemiesSeen: [],
    };
    this.ctx = {
      rng: this.rng.combat,
      nextWord: (enemy, excludeFirst) =>
        bank().pick(
          {
            min: enemy.minLen,
            max: enemy.maxLen,
            excludeFirst,
            weak: config.weak,
            modded: new Set(Object.keys(this.run.keyMods)),
          },
          this.rng.words,
        ).word,
    };
    this.view = { kind: 'doors', doors: rollDoors(this.run, this.rng.doors, this.history) };
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

  /** The clock of the current timed view (combat or challenge), or null. */
  get clock(): number | null {
    return this.view.kind === 'combat' ? this.view.combat.time : this.view.kind === 'challenge' ? this.view.time : null;
  }

  /** Everything needed to resume or verify this run. Pass the current clock when mid-fight or mid-challenge. */
  save(now?: number): { config: RunConfig; actions: Action[] } {
    const clock = this.clock;
    if (clock !== null && now !== undefined && now > clock) {
      const before = this.actions.length;
      this.dispatch({ t: 'time', at: now });
      // Always keep the save point, even when nothing happened in that stretch.
      if (this.actions.length === before) this.actions.push({ t: 'time', at: now });
    }
    return { config: this.config, actions: [...this.actions] };
  }

  dispatch(a: Action): MachineEvent[] {
    const ev = this.dispatchInner(a);
    const t = this.run.totals;
    t.maxCoins = Math.max(t.maxCoins, this.run.coins);
    return ev;
  }

  private dispatchInner(a: Action): MachineEvent[] {
    const ev: MachineEvent[] = [];
    const v = this.view;
    switch (a.t) {
      case 'key':
      case 'bs':
      case 'untarget':
      case 'time':
        if (v.kind === 'challenge') this.challengeInput(v, a, ev);
        else if (v.kind === 'combat') this.combatInput(v, a, ev);
        else throw new InvalidAction(`${a.t} outside combat`);
        return ev;
      case 'door': {
        if (v.kind !== 'doors') throw new InvalidAction('door outside doors');
        const d = v.doors[a.i];
        if (!d) throw new InvalidAction('no such door');
        this.actions.push(a);
        this.report.picks.push({ kind: 'door', id: `${d.node}:${d.reward?.kind ?? ''}` });
        this.enterRoom(d.node, d.reward, ev);
        return ev;
      }
      case 'pick':
        if (v.kind !== 'reward') throw new InvalidAction('pick outside reward');
        this.pick(v, a, ev);
        return ev;
      case 'install': {
        if (v.kind !== 'install') throw new InvalidAction('install outside install');
        if (a.k !== null && !/^[a-z]$/.test(a.k)) throw new InvalidAction('install needs a letter');
        this.actions.push(a);
        if (a.k) {
          const res = installMod(this.run.keyMods, a.k, v.mod.mod, v.mod.rarity);
          this.run.keyMods = res.keyMods;
          ev.push({ t: 'installed', key: a.k, mod: v.mod.mod, upgraded: res.upgraded });
          this.report.picks.push({ kind: 'install', id: `${v.mod.mod}:${a.k}` });
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
        this.run.totals.coinsSpent += it.cost;
        it.sold = true;
        ev.push({ t: 'bought', item: it });
        this.report.picks.push({
          kind: 'buy',
          id: it.kind === 'mod' ? it.mod : it.kind === 'relic' ? it.relic : 'heal',
        });
        if (it.kind === 'relic') this.run.relics.push(it.relic);
        else if (it.kind === 'heal') this.run.hp = Math.min(this.run.maxHp, this.run.hp + it.amount);
        else {
          this.shopView = v;
          this.view = { kind: 'install', mod: { kind: 'power', mod: it.mod, rarity: it.rarity }, from: 'shop' };
        }
        return ev;
      }
      case 'reroll':
        this.reroll(v, a);
        return ev;
      case 'option': {
        if (v.kind !== 'event' || v.outcome !== null) throw new InvalidAction('option outside event');
        const opt = v.options[a.i];
        if (!opt || !opt.enabled) throw new InvalidAction('option unavailable');
        this.actions.push(a);
        this.report.picks.push({ kind: 'event', id: `${v.id}:${a.i}` });
        this.resolveEvent(v, a.i, ev);
        return ev;
      }
      case 'leave':
        if (v.kind === 'shop' || (v.kind === 'event' && v.outcome !== null)) {
          this.actions.push(a);
          this.view = this.next(ev);
          return ev;
        }
        throw new InvalidAction('nothing to leave');
    }
  }

  // ---------- rewards ----------

  private pick(v: RewardView, a: { t: 'pick'; i: number }, ev: MachineEvent[]): void {
    const o = v.offers[a.i];
    if (a.i !== -1 && !o) throw new InvalidAction('no such offer');
    this.actions.push(a);
    if (!o) {
      this.report.picks.push({ kind: 'skip', id: v.muse ?? 'reward' });
      this.view = this.next(ev);
    } else if (o.kind === 'power') {
      this.report.picks.push({ kind: 'power', id: `${o.mod}:${o.rarity}` });
      this.view = { kind: 'install', mod: o, from: 'reward' };
    } else if (o.kind === 'blessing') {
      this.run.blessings.push(o.id);
      this.report.picks.push({ kind: 'blessing', id: o.id });
      ev.push({ t: 'blessing', id: o.id });
      this.view = this.next(ev);
    } else {
      this.run.relics.push(o.relic);
      this.report.picks.push({ kind: 'relic', id: o.relic });
      ev.push({ t: 'relic', relic: o.relic });
      this.view = this.next(ev);
    }
  }

  private reroll(v: View, a: Action): void {
    if (v.kind === 'shop') {
      const cost = REROLL_BASE + v.rerolls;
      if (cost > this.run.coins) throw new InvalidAction('not enough coins');
      this.actions.push(a);
      this.run.coins -= cost;
      this.run.totals.coinsSpent += cost;
      this.shopView = { kind: 'shop', items: rollShop(this.run, this.rng.shop), rerolls: v.rerolls + 1 };
      this.view = this.shopView;
    } else if (v.kind === 'reward' && v.canReroll && this.run.rerollsLeft > 0) {
      this.actions.push(a);
      this.run.rerollsLeft--;
      const offers = v.muse
        ? museOffers(this.run, v.muse, this.rng.rewards, v.offers.length)
        : relicOffers(this.run, this.rng.rewards, v.offers.length);
      this.view = { ...v, offers, canReroll: this.run.rerollsLeft > 0 };
    } else throw new InvalidAction('nothing to reroll');
  }

  // ---------- combat ----------

  private combatInput(v: Extract<View, { kind: 'combat' }>, a: Action & { at: number }, ev: MachineEvent[]): void {
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
          this.track(c, kev, a.at);
          ev.push(...kev);
        } else if (a.t === 'bs') backspace(c);
        else cancelTarget(c);
      }
    }
    if (c.over) this.endFight(v, ev);
  }

  /** Step combat time forward to `at`. Returns true if the fight ended on the way. */
  private advanceTo(c: Combat, at: number, ev: MachineEvent[]): boolean {
    while (!c.over && c.time + STEP_MS <= at) {
      const tev = tick(c, this.run, STEP_MS, this.ctx);
      this.track(c, tev, c.time);
      ev.push(...tev);
    }
    return c.over !== null;
  }

  private track(c: Combat, events: CombatEvent[], at: number): void {
    for (const e of events) {
      if (e.t === 'player-hit') this.lastHitBy = c.enemies.find((x) => x.id === e.enemyId)?.name ?? this.lastHitBy;
      else if (e.t === 'spawn') {
        const name = c.enemies.find((x) => x.id === e.enemyId)?.name;
        if (name && !this.report.enemiesSeen.includes(name)) this.report.enemiesSeen.push(name);
      } else if (e.t === 'target') {
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

  private startFight(node: NodeKind, reward: DoorReward | null, ev: MachineEvent[]): View {
    const combat = createCombat(makeEncounter(this.run, node, this.rng.encounters), this.ctx, this.run);
    for (const e of combat.enemies) if (!this.report.enemiesSeen.includes(e.name)) this.report.enemiesSeen.push(e.name);
    this.run.carryShield = 0;
    this.fightStartHp = this.run.hp;
    this.wordStart = null;
    ev.push({ t: 'fight-start', node });
    return { kind: 'combat', node, reward, combat };
  }

  private endFight(v: Extract<View, { kind: 'combat' }>, ev: MachineEvent[]): void {
    const { combat: c, node } = v;
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
      Object.assign(this.report, { result: 'lost', act: run.act, room: run.room, killedBy: this.lastHitBy });
      ev.push({ t: 'fight-end', result: 'lose', summary }, { t: 'run-end', result: 'lost' });
      this.view = { kind: 'over', result: 'lost', summary };
      return;
    }

    t.fights++;
    if (summary.perfect) t.perfectFights++;
    run.carryCombo = run.relics.includes('night-lantern') ? c.combo : Math.floor(c.combo * COMBO_CARRY);
    run.carryShield = run.blessings.includes('bulwark') ? Math.min(BULWARK_MAX, c.shield) : 0;
    const coins = fightCoins(run, node, v.reward, this.rng.rewards);
    run.coins += coins;
    summary.coins += coins;
    if (run.relics.includes('interest')) {
      summary.interest = Math.min(5, Math.floor(run.coins / 5));
      run.coins += summary.interest;
    }
    const healFrac = node === 'boss' ? BOSS_HEAL : v.reward?.kind === 'heal' ? HEAL_DOOR : 0;
    const healAmount =
      Math.round(run.maxHp * healFrac) + (run.blessings.includes('mending') ? 3 : 0) + run.bonuses.healAfterFight;
    summary.healed = Math.min(run.maxHp - run.hp, healAmount);
    run.hp += summary.healed;
    if (node === 'boss') this.report.bossesBeaten.push(run.bosses[run.act - 1]);
    ev.push({ t: 'fight-end', result: 'win', summary });

    // The final boss ends the run: no prize to choose when nothing comes after it.
    if (node === 'boss' && run.act >= ACTS) {
      this.view = this.next(ev);
      return;
    }

    const extra = run.bonuses.extraChoices;
    const title = node === 'boss' ? 'The boss falls' : node === 'elite' ? 'Elite slain' : 'Victory';
    const canReroll = run.rerollsLeft > 0;
    const signature = node === 'boss' ? BOSS_RELIC[run.bosses[run.act - 1]] : undefined;
    if (signature) {
      // Every boss drops its own relic: a known reward, not a roll.
      const offers: Offer[] = run.relics.includes(signature) ? [] : [{ kind: 'relic', relic: signature }];
      this.view = { kind: 'reward', title, muse: null, offers, summary, canReroll: false };
    } else if (node === 'boss' || node === 'elite' || v.reward?.kind === 'relic') {
      const offers = relicOffers(run, this.rng.rewards, 3 + extra);
      this.view = { kind: 'reward', title, muse: null, offers, summary, canReroll };
    } else if (v.reward?.kind === 'muse') {
      const floor = (this.firstBoonGiven ? 0 : run.bonuses.firstBoonRarity) as Rarity;
      this.firstBoonGiven = true;
      const offers = museOffers(run, v.reward.muse, this.rng.rewards, 3 + extra, floor);
      this.view = { kind: 'reward', title, muse: v.reward.muse, offers, summary, canReroll };
    } else {
      this.view = { kind: 'reward', title, muse: null, offers: [], summary, canReroll: false };
    }
  }

  // ---------- rooms ----------

  private enterRoom(node: NodeKind, reward: DoorReward | null, ev: MachineEvent[]): void {
    this.history.push(node);
    ev.push({ t: 'room', node, act: this.run.act, room: this.run.room });
    if (node === 'shop') {
      this.shopView = { kind: 'shop', items: rollShop(this.run, this.rng.shop), rerolls: 0 };
      this.view = this.shopView;
    } else if (node === 'event') {
      this.view = this.rollEvent();
    } else {
      this.view = this.startFight(node, reward, ev);
    }
  }

  /** The current room is done: go to the next doors, the boss, the next act, or victory. */
  private next(ev: MachineEvent[]): View {
    const run = this.run;
    if (run.room < ROOMS_PER_ACT) {
      run.room++;
      if (run.room === ROOMS_PER_ACT) {
        this.history.push('boss');
        ev.push({ t: 'room', node: 'boss', act: run.act, room: run.room });
        return this.startFight('boss', null, ev);
      }
      return { kind: 'doors', doors: rollDoors(run, this.rng.doors, this.history) };
    }
    if (run.act >= ACTS) {
      run.result = 'won';
      Object.assign(this.report, { result: 'won', act: ACTS, room: ROOMS_PER_ACT });
      ev.push({ t: 'run-end', result: 'won' });
      return { kind: 'over', result: 'won', summary: null };
    }
    run.act++;
    run.room = 0;
    this.history = [];
    ev.push({ t: 'new-act', act: run.act });
    return { kind: 'doors', doors: rollDoors(run, this.rng.doors, this.history) };
  }

  // ---------- events ----------

  private rollEvent(): View {
    const run = this.run;
    const rng = this.rng.events;
    const id = pick(rng, EVENT_IDS);
    const muse = id === 'shrine' ? pick(rng, MUSE_IDS) : null;
    const canImprove = Object.values(run.keyMods).some((list) => list.some((kb) => kb.rarity < 3));
    const opts: Record<EventId, EventOption[]> = {
      'cursed-folio': [
        {
          label: 'Transcribe the curse',
          detail: `Each typo costs ${FOLIO_TYPO_HP} health. Finish it to choose an Epic key power.`,
          enabled: true,
        },
        { label: 'Close the folio', detail: 'Leave it be.', enabled: true },
      ],
      inkwell: [
        { label: 'Drop in 10 coins', detail: 'Gain 8 maximum health.', enabled: run.coins >= 10 },
        { label: 'Drink the ink', detail: 'Heal 20 health.', enabled: true },
      ],
      shrine: [
        {
          label: 'Pray',
          detail: `Lose 8 health. Choose a blessing from ${muse ? MUSES[muse].name : 'the muse'}.`,
          enabled: run.hp > 8,
        },
        { label: 'Walk on', detail: 'Leave the shrine.', enabled: true },
      ],
      gambler: [
        { label: 'Wager 15 coins', detail: 'Six times in ten, the quill pays out a relic.', enabled: run.coins >= 15 },
        { label: 'Decline', detail: 'Keep your coins.', enabled: true },
      ],
      rest: [
        { label: 'Rest your hands', detail: 'Heal 30% of your health.', enabled: true },
        { label: 'Practice', detail: 'Raise your least rare key power by one rarity.', enabled: canImprove },
      ],
      trial: [
        {
          label: 'Take the trial',
          detail: `Type three words in ${TRIAL_MS / 1000} seconds. Win 25 coins, or lose 5 health.`,
          enabled: true,
        },
        { label: 'Decline', detail: 'Leave the purse where it is.', enabled: true },
      ],
    };
    return { kind: 'event', id, muse, options: opts[id], outcome: null };
  }

  private resolveEvent(v: Extract<View, { kind: 'event' }>, i: number, ev: MachineEvent[]): void {
    const run = this.run;
    const rng = this.rng.events;
    const done = (outcome: string) => {
      this.view = { ...v, outcome };
    };
    const reward = (title: string, muse: MuseId | null, offers: Offer[]) => {
      this.view = { kind: 'reward', title, muse, offers, summary: null, canReroll: false };
    };
    switch (v.id) {
      case 'cursed-folio':
        if (i === 0) return this.startChallenge('folio', pick(rng, CURSES), null);
        return done('The folio stays closed.');
      case 'inkwell':
        if (i === 0) {
          run.coins -= 10;
          run.maxHp += 8;
          run.hp += 8;
          return done('Your coins sink out of sight. You feel sturdier: +8 maximum health.');
        }
        run.hp = Math.min(run.maxHp, run.hp + 20);
        return done('Bitter, but it works. You heal 20 health.');
      case 'shrine':
        if (i === 0 && v.muse) {
          run.hp -= 8;
          const offers = museOffers(run, v.muse, this.rng.rewards, 3).filter((o) => o.kind === 'blessing');
          if (offers.length) return reward(`${MUSES[v.muse].name} answers`, v.muse, offers);
          return done(`${MUSES[v.muse].name} has nothing left to give you.`);
        }
        return done('You leave the shrine to its dust.');
      case 'gambler':
        if (i === 0) {
          run.coins -= 15;
          if (rng() < 0.6) return reward('The quill pays out', null, relicOffers(run, this.rng.rewards, 2));
          return done('The quill scratches out your name. Nothing.');
        }
        return done('You keep your coins.');
      case 'rest':
        if (i === 0) {
          const amount = Math.min(run.maxHp - run.hp, Math.round(run.maxHp * 0.3));
          run.hp += amount;
          return done(`You rest your hands and heal ${amount} health.`);
        }
        return done(this.improveWeakest(ev));
      case 'trial':
        if (i === 0) {
          const words = [0, 1, 2].map(() => bank().pick({ min: 3, max: 5 }, rng).word);
          return this.startChallenge('trial', words.join(' '), TRIAL_MS);
        }
        return done('You leave the purse where it lies.');
    }
  }

  /** Raise the least rare key power by one rarity. */
  private improveWeakest(ev: MachineEvent[]): string {
    let best: { key: string; idx: number; rarity: number } | null = null;
    for (const [key, list] of Object.entries(this.run.keyMods))
      list.forEach((kb, idx) => {
        if (kb.rarity < 3 && (best === null || kb.rarity < best.rarity)) best = { key, idx, rarity: kb.rarity };
      });
    if (!best) return 'There is nothing left to improve.';
    const { key, idx } = best as { key: string; idx: number };
    const list = this.run.keyMods[key];
    this.run.keyMods = {
      ...this.run.keyMods,
      [key]: list.map((x, j) => (j === idx ? { ...x, rarity: (x.rarity + 1) as Rarity } : x)),
    };
    ev.push({ t: 'installed', key, mod: list[idx].mod, upgraded: true });
    return `You drill the ${key.toUpperCase()} key until its power deepens.`;
  }

  // ---------- typing challenges ----------

  private startChallenge(purpose: 'folio' | 'trial', text: string, limitMs: number | null): void {
    this.view = { kind: 'challenge', purpose, text, typed: '', errors: 0, time: 0, startedAt: null, limitMs };
  }

  private challengeInput(
    v: Extract<View, { kind: 'challenge' }>,
    a: Action & { at: number },
    ev: MachineEvent[],
  ): void {
    if (!Number.isFinite(a.at) || a.at < v.time) throw new InvalidAction('time went backwards');
    const expired = (t: number) => v.limitMs !== null && v.startedAt !== null && t - v.startedAt > v.limitMs;
    if (a.t === 'time') {
      if (expired(a.at)) {
        this.actions.push(a);
        v.time = a.at;
        this.finishChallenge(v, false, ev);
      }
      return;
    }
    this.actions.push(a);
    v.time = a.at;
    if (expired(a.at)) return this.finishChallenge(v, false, ev);
    if (a.t === 'bs') {
      v.typed = v.typed.slice(0, -1);
      return;
    }
    if (a.t !== 'key') return;
    v.startedAt ??= a.at;
    const expected = v.text[v.typed.length];
    const ok = keyMatches(this.run, a.k, expected);
    ev.push({ t: 'challenge-key', ok });
    if (!ok) {
      v.errors++;
      if (v.purpose === 'folio') {
        // The curse wounds but never kills.
        this.run.hp = Math.max(1, this.run.hp - FOLIO_TYPO_HP);
        if (this.run.hp === 1) return this.finishChallenge(v, false, ev);
      }
      return;
    }
    v.typed += expected;
    if (v.typed === v.text) this.finishChallenge(v, true, ev);
  }

  private finishChallenge(v: Extract<View, { kind: 'challenge' }>, won: boolean, ev: MachineEvent[]): void {
    const run = this.run;
    ev.push({ t: 'challenge-end', won });
    const id: EventId = v.purpose === 'folio' ? 'cursed-folio' : 'trial';
    const outcome = (text: string) => {
      this.view = { kind: 'event', id, muse: null, options: [], outcome: text };
    };
    if (v.purpose === 'folio') {
      if (!won) return outcome('The curse bites and slips away, half copied.');
      const offers: Offer[] = sample(this.rng.rewards, MUSE_IDS, 3).map((m) => ({
        kind: 'power',
        mod: MUSES[m].mod,
        rarity: 2,
      }));
      this.view = { kind: 'reward', title: 'The curse is yours', muse: null, offers, summary: null, canReroll: false };
    } else if (won) {
      run.coins += 25;
      outcome('The sand still falls as you finish. You take the purse: 25 coins.');
    } else {
      run.hp = Math.max(1, run.hp - 5);
      outcome('The last grain falls first. You lose 5 health.');
    }
  }
}

/** Build a config for a fresh run. */
export function newRunConfig(
  starter: StarterId,
  seed: number,
  weak: Record<string, number> = {},
  opts: { oaths?: OathLevels; bonuses?: RunBonuses; mode?: RunMode; gentle?: boolean } = {},
): RunConfig {
  return {
    rules: RULES_VERSION,
    seed: seed >>> 0,
    starter,
    weak,
    oaths: opts.oaths ?? {},
    bonuses: opts.bonuses ?? NO_BONUSES,
    mode: opts.mode ?? 'standard',
    gentle: opts.gentle ?? false,
  };
}
