import type { Meta } from '../engine/meta';
import { MODS } from '../engine/mods';
import { STARTER_IDS, STARTERS } from '../engine/run';
import type { StarterId } from '../engine/state';
import { accuracy, keyWeakness, nemesisBigram, topWeakKeys, type Stats } from '../engine/stats';
import { el, heatLegend, Keyboard } from './keyboard';
import type { Screen } from './screen';

export interface MenuOptions {
  meta: Meta;
  lifetime: Stats;
  onStart(starter: StarterId): void;
  onToggle(setting: 'sound' | 'fingerHints' | 'keyboard'): void;
}

export class MenuScreen implements Screen {
  readonly root = el('div', 'screen menu');
  private selected: StarterId;

  constructor(private o: MenuOptions) {
    this.selected = o.meta.unlocked.includes(o.meta.lastStarter) ? o.meta.lastStarter : 'apprentice';
    this.draw();
  }

  private draw(): void {
    const { meta, lifetime } = this.o;
    const title = el('h1', 'title');
    for (const ch of 'KEYCRAFT') title.append(el('span', '', ch));
    const tagline = el('p', 'tagline', 'A roguelike where your keyboard is the deck.');

    const how = el('ol', 'how');
    for (const line of [
      'Type an enemy’s word to strike it. Longer words hit harder.',
      'Clean streaks build combo — up to ×4 damage. One typo breaks it.',
      'Win fights to earn mods, then press a key to install them. Your E can burn. Your T can turn to gold.',
      'The game quietly feeds you words with your slowest keys.',
    ])
      how.append(el('li', '', line));

    const starters = el('div', 'cards starters');
    STARTER_IDS.forEach((id, i) => {
      const s = STARTERS[id];
      const locked = !meta.unlocked.includes(id);
      const card = el('div', `card starter-card${id === this.selected ? ' selected' : ''}${locked ? ' locked' : ''}`);
      card.append(el('span', 'hotkey', String(i + 1)), el('div', 'card-name', s.name));
      if (locked) card.append(el('div', 'card-desc', `🔒 ${s.unlock}`));
      else {
        card.append(el('div', 'card-desc', s.desc));
        const chips = el('div', 'starter-mods');
        for (const [k, mods] of Object.entries(s.keyMods))
          for (const m of mods) {
            const chip = el('span', `starter-chip mod-${m}`, `${k.toUpperCase()} ${MODS[m].glyph}`);
            chip.style.setProperty('--mc', MODS[m].color);
            chips.append(chip);
          }
        card.append(chips);
      }
      card.addEventListener('click', () => this.onKey(String(i + 1)));
      starters.append(card);
    });

    const start = el('button', 'start-btn', 'press ENTER to begin');
    start.addEventListener('click', () => this.onKey('Enter'));

    const side = el('aside', 'menu-side');
    const kb = new Keyboard();
    kb.setHeat(keyWeakness(lifetime));
    kb.root.classList.add('mini');
    const weak = topWeakKeys(lifetime, 3);
    const nem = nemesisBigram(lifetime);
    const stats = el('div', 'lifetime');
    stats.append(
      el('div', '', `Runs ${meta.runs} · Wins ${meta.wins} · Best ${meta.bestAct > 3 ? 'cleared!' : meta.bestAct ? `act ${meta.bestAct}` : '—'}`),
      el('div', '', `Lifetime accuracy ${(accuracy(lifetime) * 100).toFixed(1)}%`),
      el('div', '', weak.length ? `Weakest keys: ${weak.map((k) => k.toUpperCase()).join(' ')}` : 'Play a run to map your weak keys.'),
    );
    if (nem) stats.append(el('div', '', `Nemesis pair: “${nem.bigram}” (${Math.round(nem.ms)}ms)`));
    const toggles = el('div', 'toggles');
    const t1 = el('button', 'toggle', `sound: ${meta.sound ? 'on' : 'off'}`);
    t1.addEventListener('click', () => {
      this.o.onToggle('sound');
      this.draw();
    });
    const t2 = el('button', 'toggle', `finger colors: ${meta.fingerHints ? 'on' : 'off'}`);
    t2.addEventListener('click', () => {
      this.o.onToggle('fingerHints');
      this.draw();
    });
    const t3 = el('button', 'toggle', `combat keyboard: ${meta.keyboard}`);
    t3.addEventListener('click', () => {
      this.o.onToggle('keyboard');
      this.draw();
    });
    toggles.append(t1, t2, t3);
    side.append(el('h3', '', 'Your keyboard'), kb.root, heatLegend(), stats, toggles);

    const main = el('div', 'menu-main');
    main.append(title, tagline, how, el('h3', '', 'Choose your keyboard'), starters, start);
    this.root.replaceChildren(main, side);
  }

  onKey(key: string): void {
    if (key === 'Enter') {
      this.o.onStart(this.selected);
      return;
    }
    const id = STARTER_IDS[Number(key) - 1];
    if (id && this.o.meta.unlocked.includes(id)) {
      this.selected = id;
      this.draw();
    }
  }
}
