import words from '../data/words.json';
import { installMod, MODS, type ModId } from '../engine/mods';
import { letterShare } from '../engine/words';
import type { Run } from '../engine/state';
import * as sfx from '../fx/audio';
import { burstAt } from '../fx/particles';
import { el, Keyboard } from './keyboard';

let shareLabels: Record<string, string> | null = null;
/** "11%" per key: how often each letter shows up in enemy words. */
function frequencyLabels(): Record<string, string> {
  if (!shareLabels) {
    shareLabels = {};
    for (const [k, v] of Object.entries(letterShare(words))) shareLabels[k] = v < 0.01 ? '<1%' : `${Math.round(v * 100)}%`;
  }
  return shareLabels;
}

/** "Press a key to install <mod>" — the player physically picks which key gets the power. */
export class Installer {
  readonly root = el('div', 'installer');
  private kb = new Keyboard();

  constructor(
    private run: Run,
    private mod: ModId,
    private done: (installed: boolean) => void,
  ) {
    const m = MODS[mod];
    const title = el('h2', 'install-title');
    title.append('Press a key to install ', Object.assign(el('span', `mod-name mod-${mod}`, `${m.glyph} ${m.name}`)));
    this.kb.setMods(run.keyMods);
    this.kb.setLabels(frequencyLabels());
    this.kb.root.classList.add('picking');
    this.kb.root.style.setProperty('--glow', m.color);
    this.root.append(
      title,
      el('p', 'install-desc', m.desc),
      el('p', 'install-tip', 'The % on each key is how often that letter shows up in enemy words. Each key holds 2 mods — a 3rd pushes out the oldest.'),
      this.kb.root,
      el('p', 'install-skip', 'esc — discard'),
    );
  }

  onKey(key: string): void {
    if (key === 'Escape') {
      this.done(false);
      return;
    }
    if (!/^[a-z]$/.test(key)) return;
    this.run.keyMods = installMod(this.run.keyMods, key, this.mod).keyMods;
    this.kb.setMods(this.run.keyMods);
    burstAt(this.kb.key(key), MODS[this.mod].color, 40, 320);
    sfx.buy();
    setTimeout(() => this.done(true), 450);
    this.onKey = () => {};
  }
}

export function modCard(mod: ModId, hotkey: string, extra?: string): HTMLElement {
  const m = MODS[mod];
  const card = el('div', `card mod-card mod-${mod}`);
  card.style.setProperty('--mc', m.color);
  card.append(el('span', 'hotkey', hotkey), el('div', 'card-glyph', m.glyph), el('div', 'card-name', m.name), el('div', 'card-desc', m.desc));
  if (extra) card.append(el('div', 'card-cost', extra));
  return card;
}
