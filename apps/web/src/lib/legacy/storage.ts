import { defaultMeta, type Meta } from '@keycraft/engine';
import { emptyStats, type Stats } from '@keycraft/engine';

const META_KEY = 'keycraft.meta.v1';
const STATS_KEY = 'keycraft.stats.v1';

function read<T>(key: string, fallback: () => T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback(), ...JSON.parse(raw) } : fallback();
  } catch {
    return fallback();
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable (private mode etc.) — the game still works, it just forgets.
  }
}

export const loadMeta = (): Meta => read(META_KEY, defaultMeta);
export const saveMeta = (m: Meta) => write(META_KEY, m);
export const loadStats = (): Stats => read(STATS_KEY, emptyStats);
export const saveStats = (s: Stats) => write(STATS_KEY, s);
