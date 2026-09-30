import { REROLL_BASE, rollShop, type ShopItem } from '@keycraft/engine';
import type { Rng } from '@keycraft/engine';
import type { Run } from '@keycraft/engine';
import * as sfx from '../fx/audio';
import { floatText } from '../fx/particles';
import { Hud } from './hud';
import { Installer, modCard } from './install';
import { el } from './keyboard';
import { relicCard } from './reward-view';
import type { Screen } from './screen';

export class ShopScreen implements Screen {
  readonly root = el('div', 'screen shop');
  private hud = new Hud();
  private body = el('div', 'shop-body');
  private items: ShopItem[];
  private rerolls = 0;
  private installer: Installer | null = null;

  constructor(
    private run: Run,
    private rng: Rng,
    private done: (coins: number) => void,
  ) {
    this.items = rollShop(run, rng);
    this.root.append(this.hud.root, this.body);
    this.draw();
  }

  private get rerollCost() {
    return REROLL_BASE + this.rerolls;
  }

  private draw(): void {
    this.hud.update(this.run);
    const cards = el('div', 'cards shop-cards');
    this.items.forEach((it, i) => {
      const hk = String(i + 1);
      const price = it.sold ? 'sold' : `● ${it.cost}`;
      let card: HTMLElement;
      if (it.kind === 'mod') card = modCard(it.mod, hk, price);
      else if (it.kind === 'relic') card = relicCard(it.relic, hk, price);
      else {
        card = el('div', 'card heal-card');
        card.append(el('span', 'hotkey', hk), el('div', 'card-glyph', '+'), el('div', 'card-name', 'Patch Kit'), el('div', 'card-desc', `Heal ${it.amount} HP.`), el('div', 'card-cost', price));
      }
      if (it.sold) card.classList.add('sold');
      else if (it.cost > this.run.coins) card.classList.add('too-expensive');
      card.addEventListener('click', () => this.onKey(hk));
      cards.append(card);
    });
    const head = el('div', 'shop-head');
    head.append(el('h1', 'shop-title', 'The Type Foundry'), el('p', 'shop-sub', 'Spend coins on key mods and relics.'));
    const foot = el('p', 'skip', `0 — reroll (● ${this.rerollCost})   ·   enter — leave shop`);
    this.body.replaceChildren(head, cards, foot);
  }

  onKey(key: string): void {
    if (this.installer) {
      this.installer.onKey(key);
      return;
    }
    if (key === 'Enter') {
      this.done(this.run.coins);
      return;
    }
    if (key === '0') {
      if (this.run.coins < this.rerollCost) return this.deny();
      this.run.coins -= this.rerollCost;
      this.rerolls++;
      this.items = rollShop(this.run, this.rng);
      sfx.coin();
      this.draw();
      return;
    }
    const it = this.items[Number(key) - 1];
    if (!it || it.sold) return;
    if (it.cost > this.run.coins) return this.deny();
    this.run.coins -= it.cost;
    it.sold = true;
    sfx.buy();
    if (it.kind === 'relic') this.run.relics.push(it.relic);
    else if (it.kind === 'heal') this.run.hp = Math.min(this.run.maxHp, this.run.hp + it.amount);
    else {
      this.installer = new Installer(this.run, it.mod, () => {
        this.installer = null;
        this.draw();
      });
      this.body.replaceChildren(this.installer.root);
      this.hud.update(this.run);
      return;
    }
    this.draw();
  }

  private deny(): void {
    sfx.miss();
    floatText(this.hud.root.querySelector('.coins'), 'not enough', 'ft-bad');
  }
}
