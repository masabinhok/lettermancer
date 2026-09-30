import { MODS, type ModId } from '@keycraft/engine';

/** Field color behind each enemy's illuminated initial, by enemy kind. */
export const FIELD = {
  normal: '#35244f',
  head: '#2f3350',
  elite: '#4a2a1f',
  boss: '#4a1830',
} as const;

/** Color used to paint a letter carrying these mods (the newest mod wins, the older one underlines). */
export function letterColors(mods: ModId[]): { fill: string | null; under: string | null } {
  if (!mods.length) return { fill: null, under: null };
  const fill = MODS[mods[mods.length - 1]].color;
  const under = mods.length > 1 ? MODS[mods[0]].color : fill;
  return { fill, under };
}
