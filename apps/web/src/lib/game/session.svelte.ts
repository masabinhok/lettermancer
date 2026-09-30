/**
 * The live game: wraps the deterministic RunMachine with a real-time clock,
 * autosave, and an event feed that effects and screens subscribe to.
 */
import {
  keyWeakness,
  newRunConfig,
  RunMachine,
  type Action,
  type MachineEvent,
  type RunConfig,
  type StarterId,
  type View,
} from '@keycraft/engine';
import { profile, readStore, writeStore } from '../stores/profile.svelte';
import { combatSnapshot, type CombatSnap } from './snapshot';

const SAVE_KEY = 'keycraft.run.v1';
/** Autosave cadence during combat. */
const SAVE_EVERY_MS = 2000;

interface SavedRun {
  config: RunConfig | null;
  actions: Action[];
}

export type Intro = { kind: 'act'; act: number } | { kind: 'boss'; act: number } | null;
export type Listener = (ev: MachineEvent) => void;

export class Session {
  machine: RunMachine;
  /** re-assigned after every change so Svelte re-renders */
  view = $state.raw<View>(null!);
  snap = $state.raw<CombatSnap | null>(null);
  /** true while the window is unfocused or the pause menu is open */
  paused = $state(false);
  /** an act/boss title card shown before combat starts; the clock holds until it is dismissed */
  intro = $state<Intro>(null);
  /** starters unlocked during this run */
  unlocked = $state<StarterId[]>([]);

  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- a plain registry, never rendered
  private listeners = new Set<Listener>();
  private combatStart = 0;
  private pausedAt: number | null = null;
  private lastSave = 0;
  private raf = 0;

  constructor(machine: RunMachine) {
    this.machine = machine;
    this.sync();
    if (this.view.kind === 'combat') {
      this.intro = { kind: this.isBossFight() ? 'boss' : 'act', act: machine.run.act };
    }
  }

  static start(starter: StarterId): Session {
    const cfg = newRunConfig(starter, (Math.random() * 2 ** 32) >>> 0, keyWeakness(profile.stats));
    const s = new Session(new RunMachine(cfg));
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
      const s = new Session(m);
      // Resuming mid-fight: start paused so the player isn't hit while getting ready.
      if (m.view.kind === 'combat' && m.combat!.time > 0) {
        s.intro = null;
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

  /** Combat time in ms, derived from the wall clock minus paused time. */
  private now(): number {
    const c = this.machine.combat;
    if (!c) return 0;
    const t = this.pausedAt ?? performance.now();
    return Math.max(c.time, Math.round(t - this.combatStart));
  }

  private clockRunning(): boolean {
    return this.view.kind === 'combat' && !this.intro && !this.paused;
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
    if (this.pausedAt !== null) this.combatStart += performance.now() - this.pausedAt;
    this.pausedAt = null;
  }

  /** Dismiss the act/boss title card and start the fight clock. */
  dismissIntro(): void {
    if (!this.intro) return;
    this.intro = null;
    this.startClock();
  }

  startClock(): void {
    const c = this.machine.combat;
    this.combatStart = performance.now() - (c?.time ?? 0);
    if (this.paused) this.pausedAt = performance.now();
  }

  // ---------- player actions ----------

  key(k: string): void {
    if (!this.clockRunning()) return;
    this.dispatch({ t: 'key', k, at: this.now() });
  }

  backspace(): void {
    if (this.clockRunning()) this.dispatch({ t: 'bs', at: this.now() });
  }

  untarget(): void {
    if (this.clockRunning()) this.dispatch({ t: 'untarget', at: this.now() });
  }

  pick(i: number): void {
    this.dispatch({ t: 'pick', i });
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
    if (v.kind !== 'shop' || this.machine.run.coins < 3 + v.rerolls) return false;
    this.dispatch({ t: 'reroll' });
    return true;
  }

  leave(): void {
    this.dispatch({ t: 'leave' });
  }

  /** Give up the run. It is recorded as a loss. */
  abandon(): void {
    const m = this.machine;
    profile.recordRun(
      { ...m.report, result: 'lost', act: m.run.act, node: m.run.node },
      m.config.seed,
      false,
      m.run.act,
    );
    clearSave();
  }

  // ---------- internals ----------

  private dispatch(a: Action): void {
    const before = this.view?.kind;
    const ev = this.machine.dispatch(a);
    this.handle(ev);
    this.sync();
    // Entering a new fight: show a title card for acts and bosses, otherwise start the clock.
    if (this.view.kind === 'combat' && before !== 'combat') {
      if (ev.some((e) => e.t === 'new-act')) this.intro = { kind: 'act', act: this.machine.run.act };
      else if (this.isBossFight()) this.intro = { kind: 'boss', act: this.machine.run.act };
      else this.startClock();
    }
    if (a.t !== 'time' && a.t !== 'key' && a.t !== 'bs' && a.t !== 'untarget') this.persist();
  }

  private isBossFight(): boolean {
    return this.view.kind === 'combat' && this.view.node === 'boss';
  }

  private sync(): void {
    const m = this.machine;
    this.view = m.view.kind === 'combat' ? { ...m.view } : m.view;
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
        profile.recordRun(this.machine.report, this.machine.config.seed, e.result === 'won', run.act);
        clearSave();
      }
      for (const fn of this.listeners) fn(e);
    }
  }

  private gain(ids: StarterId[]): void {
    if (ids.length) this.unlocked = [...this.unlocked, ...ids];
  }

  private persist(): void {
    this.lastSave = performance.now();
    if (this.machine.view.kind === 'over') return;
    let at: number | undefined;
    if (this.machine.combat && !this.intro) {
      at = this.now();
      // Advance through the session first so any hits on the way reach the effects.
      this.dispatch({ t: 'time', at });
      const kind = this.machine.view.kind as View['kind'];
      if (kind === 'over') return;
      if (kind !== 'combat') at = undefined;
    }
    writeStore(SAVE_KEY, this.machine.save(at));
  }
}

export function clearSave(): void {
  writeStore(SAVE_KEY, { config: null, actions: [] });
}
