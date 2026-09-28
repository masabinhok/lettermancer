import { MODS, type KeyMods } from '../engine/mods';

export const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

/** Touch-typing finger for each key: 0-3 left pinky→index, 4-7 right index→pinky. */
const FINGER: Record<string, number> = {};
[
  'qaz',
  'wsx',
  'edc',
  'rfvtgb',
  'yhnujm',
  'ik',
  'ol',
  'p',
].forEach((keys, f) => {
  for (const k of keys) FINGER[k] = f;
});

export const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

export class Keyboard {
  readonly root = el('div', 'keyboard');
  private keys = new Map<string, HTMLElement>();
  private next: string | null = null;

  constructor() {
    for (const row of ROWS) {
      const r = el('div', 'kb-row');
      for (const k of row) {
        const key = el('div', `key finger-${FINGER[k]}`);
        key.dataset.key = k;
        key.append(el('span', 'key-cap', k), el('span', 'key-mods'));
        if (k === 'f' || k === 'j') key.classList.add('home-bump');
        this.keys.set(k, key);
        r.append(key);
      }
      this.root.append(r);
    }
  }

  key(k: string): HTMLElement | undefined {
    return this.keys.get(k);
  }

  setMods(keyMods: KeyMods): void {
    for (const [k, node] of this.keys) {
      const mods = keyMods[k] ?? [];
      const box = node.querySelector('.key-mods')!;
      box.replaceChildren(
        ...mods.map((m) => {
          const chip = el('span', `mod-chip mod-${m}`, MODS[m].glyph);
          chip.title = MODS[m].name;
          return chip;
        }),
      );
      node.classList.toggle('modded', mods.length > 0);
      node.style.setProperty('--glow', mods.length ? MODS[mods[mods.length - 1]].color : 'transparent');
    }
  }

  setNext(k: string | null): void {
    if (this.next) this.keys.get(this.next)?.classList.remove('next');
    this.next = k;
    if (k) this.keys.get(k)?.classList.add('next');
  }

  flash(k: string, ok: boolean): void {
    const node = this.keys.get(k);
    if (!node) return;
    const cls = ok ? 'press-ok' : 'press-bad';
    node.classList.remove('press-ok', 'press-bad');
    void node.offsetWidth;
    node.classList.add(cls);
  }

  setFingerHints(on: boolean): void {
    this.root.classList.toggle('finger-hints', on);
  }

  setDark(on: boolean): void {
    this.root.classList.toggle('dark', on);
  }

  /** Heatmap mode: 0 = comfortable, 1 = weakest key. */
  setHeat(heat: Record<string, number>): void {
    this.root.classList.add('heat');
    for (const [k, node] of this.keys) {
      const v = heat[k];
      node.style.setProperty('--heat', v === undefined ? '0' : String(v));
      node.classList.toggle('no-data', v === undefined);
    }
  }
}
