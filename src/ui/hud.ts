import { RELICS } from '../engine/mods';
import { ACT_LAYOUT } from '../engine/run';
import type { NodeKind, Run } from '../engine/state';
import { el } from './keyboard';

const NODE_GLYPH: Record<NodeKind, string> = { fight: '⚔', elite: '◆', shop: '$', boss: '☠' };

export class Hud {
  readonly root = el('header', 'hud');
  private hpFill = el('i');
  private hpText = el('span', 'hp-text');
  private shield = el('span', 'shield-badge');
  private coins = el('span', 'coins');
  private map = el('div', 'map');
  private relics = el('div', 'relics');
  private layoutKey = '';

  constructor() {
    const hp = el('div', 'hp-bar');
    hp.append(this.hpFill, this.hpText);
    const left = el('div', 'hud-left');
    left.append(hp, this.shield, this.coins);
    this.root.append(left, this.map, this.relics);
  }

  update(run: Run, shield = 0): void {
    this.hpFill.style.width = `${(run.hp / run.maxHp) * 100}%`;
    this.hpText.textContent = `${run.hp} / ${run.maxHp}`;
    this.root.classList.toggle('low-hp', run.hp / run.maxHp < 0.3);
    this.shield.textContent = shield > 0 ? `■ ${shield}` : '';
    this.shield.hidden = shield <= 0;
    this.coins.textContent = `● ${run.coins}`;

    // Map and relics only change between fights; don't rebuild them every frame.
    const layoutKey = `${run.act}|${run.node}|${run.relics.join()}`;
    if (layoutKey === this.layoutKey) return;
    this.layoutKey = layoutKey;

    const act = el('span', 'act-label', `ACT ${['I', 'II', 'III'][run.act - 1] ?? run.act}`);
    const pips = ACT_LAYOUT.map((k, i) => {
      const p = el('span', `pip pip-${k}`, NODE_GLYPH[k]);
      if (i < run.node) p.classList.add('done');
      if (i === run.node) p.classList.add('here');
      p.title = k;
      return p;
    });
    this.map.replaceChildren(act, ...pips);

    this.relics.replaceChildren(
      ...run.relics.map((r) => {
        const d = el('span', 'relic', RELICS[r].glyph);
        d.dataset.tip = `${RELICS[r].name}: ${RELICS[r].desc}`;
        return d;
      }),
    );
  }

  pulseCoins(): void {
    this.coins.classList.remove('pulse');
    void this.coins.offsetWidth;
    this.coins.classList.add('pulse');
  }
}
