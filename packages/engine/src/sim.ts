/**
 * A bot that plays whole runs through the RunMachine. Used for balance tests and for
 * generating realistic action logs to test replays and run verification.
 */
import { MUSES, musesHeld, type ModId } from './mods';
import { RunMachine, type RunConfig, type View } from './machine';
import type { Rng } from './rng';
import type { Door, Run } from './state';

export interface BotOptions {
  wpm: number;
  /** chance each keystroke is correct */
  accuracy: number;
  rng: Rng;
  /** time to read a new word before the first keystroke (default 350ms) */
  reactMs?: number;
}

/** Letters by how often they appear in the word list — the bot binds powers to common keys. */
const BY_FREQUENCY = 'eisntraolcdgupmhybfvwkxqjz';

function installKey(run: Run, mod: ModId): string {
  // Upgrade an existing copy of this power first, then take the most common free key.
  for (const k of BY_FREQUENCY) if (run.keyMods[k]?.some((b) => b.mod === mod)) return k;
  for (const k of BY_FREQUENCY) if ((run.keyMods[k]?.length ?? 0) < 2) return k;
  return 'e';
}

function wrongKey(rng: Rng, expected: string): string {
  let k = expected;
  while (k === expected) k = String.fromCharCode(97 + Math.floor(rng() * 26));
  return k;
}

function chooseDoor(run: Run, doors: Door[], rng: Rng): number {
  const held = musesHeld(run.keyMods, run.blessings);
  const low = run.hp < run.maxHp * 0.45;
  const score = (d: Door) => {
    let s = rng() * 0.5;
    if (d.node === 'fight' && d.reward?.kind === 'muse') s += held.has(d.reward.muse) ? 3 : 2;
    if (d.node === 'fight' && d.reward?.kind === 'heal') s += low ? 4 : 0.5;
    if (d.node === 'fight' && d.reward?.kind === 'coins') s += 1;
    if (d.node === 'shop') s += low && run.coins >= 6 ? 3.5 : run.coins >= 20 ? 2 : 0;
    if (d.node === 'elite') s += low ? -3 : 1.5;
    if (d.node === 'event') s += 1.2;
    return s;
  };
  let best = 0;
  doors.forEach((d, i) => {
    if (score(d) > score(doors[best])) best = i;
  });
  return best;
}

function chooseOffer(run: Run, v: Extract<View, { kind: 'reward' }>): number {
  if (!v.offers.length) return -1;
  const held = musesHeld(run.keyMods, run.blessings);
  let best = 0;
  let bestScore = -1;
  v.offers.forEach((o, i) => {
    let s = 1;
    if (o.kind === 'power') s = 2 + o.rarity;
    if (o.kind === 'blessing') s = 2.5 + (held.size > 0 ? 0.5 : 0);
    if (s > bestScore) {
      best = i;
      bestScore = s;
    }
  });
  return best;
}

export function playRun(config: RunConfig, o: BotOptions): RunMachine {
  const m = new RunMachine(config);
  const msPerKey = 60000 / (o.wpm * 5);
  const gap = () => msPerKey * (0.6 + o.rng() * 0.8);
  let guard = 0;
  while (m.view.kind !== 'over' && guard++ < 200000) {
    const v = m.view;
    const run = m.run;
    if (v.kind === 'combat') {
      const c = v.combat;
      const t = c.enemies.find((e) => e.id === c.targetId);
      const react = t ? 0 : (o.reactMs ?? 350);
      const at = Math.round(c.time + react + gap());
      const e = t ?? c.enemies.reduce((a, b) => (b.intent / b.intentMs > a.intent / a.intentMs ? b : a));
      const expected = e.word[t ? c.typed.length : 0];
      m.dispatch({ t: 'key', k: o.rng() < o.accuracy ? expected : wrongKey(o.rng, expected.toLowerCase()), at });
    } else if (v.kind === 'challenge') {
      const expected = v.text[v.typed.length];
      const at = Math.round(v.time + (v.typed.length ? gap() : (o.reactMs ?? 350)));
      m.dispatch({ t: 'key', k: o.rng() < o.accuracy ? expected : wrongKey(o.rng, expected), at });
    } else if (v.kind === 'doors') {
      m.dispatch({ t: 'door', i: chooseDoor(run, v.doors, o.rng) });
    } else if (v.kind === 'reward') {
      m.dispatch({ t: 'pick', i: chooseOffer(run, v) });
    } else if (v.kind === 'install') {
      m.dispatch({ t: 'install', k: installKey(run, v.mod.mod) });
    } else if (v.kind === 'shop') {
      const i = v.items.findIndex(
        (it) => !it.sold && it.cost <= run.coins && (it.kind !== 'heal' || run.hp < run.maxHp * 0.6),
      );
      if (i >= 0) m.dispatch({ t: 'buy', i });
      else m.dispatch({ t: 'leave' });
    } else if (v.kind === 'event') {
      if (v.outcome !== null) m.dispatch({ t: 'leave' });
      else {
        const risky = v.id === 'shrine' && run.hp < 25;
        const i = !risky && v.options[0].enabled ? 0 : v.options.length - 1;
        m.dispatch({ t: 'option', i });
      }
    }
  }
  return m;
}

/** Name of a muse for bot logs. */
export const museName = (id: keyof typeof MUSES) => MUSES[id].name;
