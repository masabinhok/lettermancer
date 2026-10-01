import { MODS, type KeyBoon } from '@lettermancer/engine';

/** Field color behind each enemy's illuminated initial, by enemy kind. */
export const FIELD = {
  normal: '#35244f',
  minion: '#2f3350',
  elite: '#4a2a1f',
  boss: '#4a1830',
} as const;

/** Color used to paint a letter carrying these powers (the newest wins, the older one underlines). */
export function letterColors(boons: KeyBoon[]): { fill: string | null; under: string | null } {
  if (!boons.length) return { fill: null, under: null };
  const fill = MODS[boons[boons.length - 1].mod].color;
  const under = boons.length > 1 ? MODS[boons[0].mod].color : fill;
  return { fill, under };
}

/** Rarity colors, used on cards and keys. */
export const RARITY_COLOR = ['var(--moon-dim)', '#6fb6ff', '#c58bff', 'var(--gold-bright)'] as const;

export const TRAIT_INFO: Record<string, { name: string; desc: string }> = {
  armored: { name: 'Armored', desc: 'Words shorter than 6 letters deal half damage.' },
  shifter: { name: 'Shifting', desc: 'Its word changes every few seconds.' },
  splitter: { name: 'Splits', desc: 'Bursts into two small foes when it dies.' },
  thief: { name: 'Thief', desc: 'Its hits also drain 10 combo.' },
  healer: { name: 'Healer', desc: 'Heals its most wounded ally.' },
  enrage: { name: 'Enraged', desc: 'Attacks faster after every hit.' },
  warden: { name: 'Warden', desc: 'Shields its allies every few seconds.' },
  summoner: { name: 'Summoner', desc: 'Calls small foes to its side.' },
  quick: { name: 'Quick', desc: 'Fast, light attacks.' },
};
