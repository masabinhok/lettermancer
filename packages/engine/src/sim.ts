/**
 * A bot that plays whole runs through the RunMachine. Used for balance tests and for
 * generating realistic action logs to test replays and run verification.
 */
import { RunMachine, type RunConfig } from './machine';
import type { Rng } from './rng';
import type { Run } from './state';

export interface BotOptions {
  wpm: number;
  /** chance each keystroke is correct */
  accuracy: number;
  rng: Rng;
  /** time to read a new word before the first keystroke (default 350ms) */
  reactMs?: number;
}

/** Letters by how often they appear in the word list — the bot installs mods on common keys. */
const BY_FREQUENCY = 'eisntraolcdgupmhybfvwkxqjz';

function installKey(run: Run): string {
  for (const k of BY_FREQUENCY) if ((run.keyMods[k]?.length ?? 0) < 2) return k;
  return 'e';
}

function wrongKey(rng: Rng, expected: string): string {
  let k = expected;
  while (k === expected) k = String.fromCharCode(97 + Math.floor(rng() * 26));
  return k;
}

export function playRun(config: RunConfig, o: BotOptions): RunMachine {
  const m = new RunMachine(config);
  const msPerKey = 60000 / (o.wpm * 5);
  let guard = 0;
  while (m.view.kind !== 'over' && guard++ < 100000) {
    const v = m.view;
    if (v.kind === 'combat') {
      const c = v.combat;
      const t = c.enemies.find((e) => e.id === c.targetId);
      const react = t ? 0 : (o.reactMs ?? 350);
      const at = Math.round(c.time + react + msPerKey * (0.6 + o.rng() * 0.8));
      const e = t ?? c.enemies.reduce((a, b) => (b.intent / b.intentMs > a.intent / a.intentMs ? b : a));
      const expected = e.word[t ? c.typed.length : 0];
      m.dispatch({ t: 'key', k: o.rng() < o.accuracy ? expected : wrongKey(o.rng, expected), at });
    } else if (v.kind === 'reward') {
      m.dispatch({ t: 'pick', i: 0 });
    } else if (v.kind === 'install') {
      m.dispatch({ t: 'install', k: installKey(m.run) });
    } else if (v.kind === 'shop') {
      const run = m.run;
      const i = v.items.findIndex(
        (it) => !it.sold && it.cost <= run.coins && (it.kind !== 'heal' || run.hp < run.maxHp * 0.6),
      );
      if (i >= 0) m.dispatch({ t: 'buy', i });
      else m.dispatch({ t: 'leave' });
    }
  }
  return m;
}

