/**
 * The live game: wraps the deterministic RunMachine with a real-time clock,
 * autosave, and an event feed that effects and screens subscribe to.
 */
import {
  keyWeakness,
  newRunConfig,
  RunMachine,
  type Action,
  type Award,
  type MachineEvent,
  type OathLevels,
  type Run,
  type RunBonuses,
  type RunConfig,
  type RunMode,
  type StarterId,
  type View,
} from '@lettermancer/engine';
import { account, type SubmitResult } from '../cloud/account.svelte';
import { profile, readStore, writeStore } from '../stores/profile.svelte';
import { combatSnapshot, type CombatSnap } from './snapshot';

const SAVE_KEY = 'lettermancer.run.v1';
/** Autosave cadence while a clock is running. */
const SAVE_EVERY_MS = 2000;
const RECENT_WORDS = 40;

interface SavedRun {
  config: RunConfig | null;
  actions: Action[];
}

export type Intro = { kind: 'act'; act: number } | { kind: 'boss'; act: number } | null;
export type Listener = (ev: MachineEvent) => void;

export interface StartOptions {
  starter: StarterId;
  oaths?: OathLevels;
  bonuses?: RunBonuses;
  gentle?: boolean;
  mode?: RunMode;
  seed?: number;
}

export class Session {
  machine: RunMachine;
  /** re-assigned after every change so Svelte re-renders */
  view = $state.raw<View>(null!);
  snap = $state.raw<CombatSnap | null>(null);
  /** a fresh shallow copy of the run after every change, so screens re-render */
  run = $state.raw<Run>(null!);
  /** true while the window is unfocused or the pause menu is open */
  paused = $state(false);
  /** an act/boss title card; the clock holds until it is dismissed */
  intro = $state<Intro>(null);
  /** starters unlocked during this run */
  unlocked = $state<StarterId[]>([]);
  /** the leaderboard verdict for a finished run, when signed in */
  submission = $state.raw<SubmitResult | 'sending' | null>(null);
  /** what the finished run earned (set when the run ends) */
  award = $state.raw<Award | null>(null);
  /** the last words enemies carried — the install screen reads letter use from these */
  recentWords: string[] = [];

  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- a plain registry, never rendered
  private listeners = new Set<Listener>();
  private clockStart = 0;
  private pausedAt: number | null = null;
  private lastSave = 0;
  private raf = 0;

  constructor(machine: RunMachine, fresh: boolean) {
    this.machine = machine;
    this.sync();
    if (fresh) this.intro = { kind: 'act', act: 1 };
  }

  static start(o: StartOptions): Session {
    const cfg = newRunConfig(o.starter, o.seed ?? (Math.random() * 2 ** 32) >>> 0, keyWeakness(profile.stats), {
      oaths: o.oaths,
      bonuses: o.bonuses,
      gentle: o.gentle,
      mode: o.mode,
    });
    return Session.fromConfig(cfg);
  }

  /** Start a run from a ready-made config (daily and weekly runs build theirs in the engine). */
  static fromConfig(cfg: RunConfig): Session {
    const s = new Session(new RunMachine(cfg), true);
    s.persist();
    return s;
  }

  /** Resume the saved run, if any. A corrupt or outdated save is discarded. */
  static resume(): Session | null {
    const saved = readStore<SavedRun>(SAVE_KEY, () => ({ config: null, actions: [] }));
    if (!saved.config) return null;
    try {
      const m = RunMachine.replay(saved.config, saved.actions);
      if (m.view.kind === 'over') return null;
      const s = new Session(m, false);
      // Mid-fight or mid-challenge: start paused so the player isn't hit while getting ready.
      if (m.clock !== null) {
        s.startClock();
        s.pause();
      }
      return s;
    } catch {
      clearSave();
      return null;
    }
  }

  static hasSave(): boolean {
    return readStore<SavedRun>(SAVE_KEY, () => ({ config: null, actions: [] })).config !== null;
  }

  on(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  // ---------- clock ----------

  /** Time on the current fight or challenge clock, derived from the wall clock minus paused time. */
  private now(): number {
    const clock = this.machine.clock;
    if (clock === null) return 0;
    const t = this.pausedAt ?? performance.now();
    return Math.max(clock, Math.round(t - this.clockStart));
  }

  private clockRunning(): boolean {
    return this.machine.clock !== null && !this.intro && !this.paused;
  }

  mount(): void {
    const frame = (t: number) => {
      if (this.clockRunning()) {
        this.dispatch({ t: 'time', at: this.now() });
        if (t - this.lastSave > SAVE_EVERY_MS) this.persist();
      }
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  unmount(): void {
    cancelAnimationFrame(this.raf);
    this.persist();
  }

  pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.pausedAt = performance.now();
    this.persist();
  }

  unpause(): void {
    if (!this.paused) return;
    this.paused = false;
    if (this.pausedAt !== null) this.clockStart += performance.now() - this.pausedAt;
    this.pausedAt = null;
  }

  /** Dismiss the act/boss title card. */
  dismissIntro(): void {
    if (!this.intro) return;
    this.intro = null;
    this.startClock();
  }

  startClock(): void {
    this.clockStart = performance.now() - (this.machine.clock ?? 0);
    if (this.paused) this.pausedAt = performance.now();
  }

  // ---------- player actions ----------

  key(k: string): void {
    if (this.clockRunning()) this.dispatch({ t: 'key', k, at: this.now() });
  }

  backspace(): void {
    if (this.clockRunning()) this.dispatch({ t: 'bs', at: this.now() });
  }

  untarget(): void {
    if (this.clockRunning() && this.view.kind === 'combat') this.dispatch({ t: 'untarget', at: this.now() });
  }

  door(i: number): void {
    this.dispatch({ t: 'door', i });
  }

  pick(i: number): void {
    this.dispatch({ t: 'pick', i });
  }

  option(i: number): boolean {
    const v = this.view;
    if (v.kind !== 'event' || v.outcome !== null || !v.options[i]?.enabled) return false;
    this.dispatch({ t: 'option', i });
    return true;
  }

  install(k: string | null): void {
    this.dispatch({ t: 'install', k });
  }

  buy(i: number): boolean {
    const v = this.view;
    if (v.kind !== 'shop') return false;
    const it = v.items[i];
    if (!it || it.sold || it.cost > this.machine.run.coins) return false;
    this.dispatch({ t: 'buy', i });
    return true;
  }

  reroll(): boolean {
    const v = this.view;
    const run = this.machine.run;
    if (v.kind === 'shop' && run.coins >= 3 + v.rerolls) this.dispatch({ t: 'reroll' });
    else if (v.kind === 'reward' && v.canReroll && run.rerollsLeft > 0) this.dispatch({ t: 'reroll' });
    else return false;
    return true;
  }

  leave(): void {
    this.dispatch({ t: 'leave' });
  }

  /** Give up the run. It is recorded as a loss. */
  abandon(): void {
    profile.finishRun(this.machine, true);
    clearSave();
  }

  // ---------- internals ----------

  private dispatch(a: Action): void {
    const before = this.view?.kind;
    const ev = this.machine.dispatch(a);
    this.handle(ev);
    this.sync();
    const v = this.view;
    if (ev.some((e) => e.t === 'new-act')) this.intro = { kind: 'act', act: this.machine.run.act };
    else if (v.kind === 'combat' && before !== 'combat' && v.node === 'boss')
      this.intro = { kind: 'boss', act: this.machine.run.act };
    else if ((v.kind === 'combat' || v.kind === 'challenge') && before !== v.kind) this.startClock();
    if (a.t !== 'time' && a.t !== 'key' && a.t !== 'bs' && a.t !== 'untarget') this.persist();
  }

  private sync(): void {
    const m = this.machine;
    for (const e of m.combat?.enemies ?? []) {
      if (!this.recentWords.slice(-6).includes(e.word)) {
        this.recentWords.push(e.word);
        if (this.recentWords.length > RECENT_WORDS) this.recentWords.shift();
      }
    }
    this.view = m.view.kind === 'combat' || m.view.kind === 'challenge' ? { ...m.view } : m.view;
    this.run = { ...m.run };
    this.snap = m.combat ? combatSnapshot(m.combat, m.run) : null;
  }

  private handle(events: MachineEvent[]): void {
    const run = this.machine.run;
    for (const e of events) {
      if (e.t === 'fight-end') {
        profile.addStats(e.summary.stats);
        if (e.result === 'win') {
          this.gain(
            profile.unlock({
              flawlessElite: e.summary.errors === 0 && (e.summary.node === 'elite' || e.summary.node === 'boss'),
              coins: run.coins,
            }),
          );
        }
      } else if (e.t === 'new-act') {
        this.gain(profile.unlock({ act: e.act }));
      } else if (e.t === 'bought' || e.t === 'installed') {
        this.gain(profile.unlock({ coins: run.coins }));
      } else if (e.t === 'run-end') {
        this.award = profile.finishRun(this.machine);
        clearSave();
        this.submit();
      }
      for (const fn of this.listeners) fn(e);
    }
  }

  /** Post a finished run for verification and ranking (signed-in players, never gentle runs). */
  private submit(): void {
    const m = this.machine;
    if (!account.user || m.config.gentle) return;
    this.submission = 'sending';
    void account.submitRun(m.config, [...m.actions]).then((r) => (this.submission = r));
  }

  private gain(ids: StarterId[]): void {
    if (ids.length) this.unlocked = [...this.unlocked, ...ids];
  }

  private persist(): void {
    this.lastSave = performance.now();
    if (this.machine.view.kind === 'over') return;
    let at: number | undefined;
    if (this.machine.clock !== null && !this.intro) {
      at = this.now();
      // Advance through the session first so any hits on the way reach the effects.
      this.dispatch({ t: 'time', at });
      const kind = this.machine.view.kind as View['kind'];
      if (kind === 'over') return;
      if (this.machine.clock === null) at = undefined;
    }
    writeStore(SAVE_KEY, this.machine.save(at));
  }
}

export function clearSave(): void {
  writeStore(SAVE_KEY, { config: null, actions: [] });
}
