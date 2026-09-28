import { RELICS, type RelicId } from '../engine/mods';
import type { FightReward } from '../engine/run';
import type { Run } from '../engine/state';
import * as sfx from '../fx/audio';
import { Hud } from './hud';
import { Installer, modCard } from './install';
import { el } from './keyboard';
import type { Screen } from './screen';

export function relicCard(relic: RelicId, hotkey: string, extra?: string): HTMLElement {
  const r = RELICS[relic];
  const card = el('div', 'card relic-card');
  card.append(el('span', 'hotkey', hotkey), el('div', 'card-glyph', r.glyph), el('div', 'card-name', r.name), el('div', 'card-desc', r.desc));
  if (extra) card.append(el('div', 'card-cost', extra));
  return card;
}

export interface RewardSummary {
  title: string;
  lines: string[];
}

/** After a fight: pick a relic (elite/boss), then pick a key mod and install it. */
export class RewardScreen implements Screen {
  readonly root = el('div', 'screen reward');
  private hud = new Hud();
  private body = el('div', 'reward-body');
  private stage: 'relic' | 'mod' | 'install' = 'mod';
  private installer: Installer | null = null;

  constructor(
    private run: Run,
    private reward: FightReward,
    private summary: RewardSummary,
    private done: () => void,
  ) {
    this.root.append(this.hud.root, this.body);
    this.stage = reward.relics.length ? 'relic' : 'mod';
    this.draw();
  }

  private header(): HTMLElement {
    const h = el('div', 'reward-head');
    h.append(el('h1', 'reward-title', this.summary.title), el('div', 'reward-lines', this.summary.lines.join('  ·  ')));
    return h;
  }

  private draw(): void {
    this.hud.update(this.run);
    if (this.stage === 'install') return;
    const cards = el('div', 'cards');
    let prompt: string;
    if (this.stage === 'relic') {
      prompt = 'Choose a relic';
      this.reward.relics.forEach((r, i) => cards.append(relicCard(r, String(i + 1))));
    } else {
      prompt = 'Choose a key mod';
      this.reward.mods.forEach((m, i) => cards.append(modCard(m, String(i + 1))));
    }
    cards.querySelectorAll('.card').forEach((c, i) => c.addEventListener('click', () => this.onKey(String(i + 1))));
    this.body.replaceChildren(this.header(), el('h2', 'prompt', prompt), cards, el('p', 'skip', 'enter — skip'));
  }

  onKey(key: string): void {
    if (this.installer) {
      this.installer.onKey(key);
      return;
    }
    if (key === 'Enter') {
      if (this.stage === 'relic') {
        this.stage = 'mod';
        this.draw();
      } else this.done();
      return;
    }
    const i = Number(key) - 1;
    if (this.stage === 'relic' && this.reward.relics[i]) {
      this.run.relics.push(this.reward.relics[i]);
      sfx.buy();
      this.stage = 'mod';
      this.draw();
    } else if (this.stage === 'mod' && this.reward.mods[i]) {
      this.stage = 'install';
      this.installer = new Installer(this.run, this.reward.mods[i], () => this.done());
      this.body.replaceChildren(this.installer.root);
    }
  }
}
