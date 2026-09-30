import type { KeyboardLayout } from '../stores/profile.svelte';

/** Three letter rows per layout, including the punctuation keys that share them. */
export const LAYOUTS: Record<KeyboardLayout, [string, string, string]> = {
  qwerty: ['qwertyuiop', 'asdfghjkl;', 'zxcvbnm,./'],
  dvorak: ["',.pyfgcrl", 'aoeuidhtns', ';qjkxbmwvz'],
  colemak: ['qwfpgjluy;', 'arstdhneio', 'zxcvbkm,./'],
  azerty: ['azertyuiop', 'qsdfghjklm', 'wxcvbn,;:!'],
};

/** Touch-typing finger by column: 0–3 left pinky→index, 4–7 right index→pinky. */
export const fingerForColumn = (col: number): number => [0, 1, 2, 3, 3, 4, 4, 5, 6, 7][col] ?? 7;

export const FINGER_NAMES = [
  'left pinky',
  'left ring',
  'left middle',
  'left index',
  'right index',
  'right middle',
  'right ring',
  'right pinky',
];

/** Home-row anchor columns (F and J on QWERTY). */
export const HOME_COLUMNS = [3, 6];
