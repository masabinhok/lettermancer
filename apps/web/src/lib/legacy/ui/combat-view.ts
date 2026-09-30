import { backspace, cancelTarget, createCombat, pressKey, target, tick, type Combat, type CombatCtx, type CombatEvent } from '@keycraft/engine';
import type { KeyboardMode } from '@keycraft/engine';
import { comboTier, COMBO_TIERS, MODS } from '@keycraft/engine';
import type { Enemy, EnemySpec, Run } from '@keycraft/engine';
import * as sfx from '../fx/audio';
import { burstAt, floatText, shake } from '../fx/particles';
import { Hud } from './hud';
import { el, Keyboard } from './keyboard';
import type { Screen } from './screen';

/** Blackout words vanish this long after appearing. */
const BLACKOUT_VISIBLE_MS = 1400;
/** How long before an attack lands the enemy visibly winds up. */
const WINDUP_MS = 1000;

interface EnemyView {
  root: HTMLElement;
  hpFill: HTMLElement;
  hpText: HTMLElement;
  word: HTMLElement;
  intentFill: HTMLElement;
  intentText: HTMLElement;
  status: HTMLElement;
  wordKey: string;
}

export interface CombatOptions {
  run: Run;
  specs: EnemySpec[];
  ctx: CombatCtx;
  fingerHints: boolean;
  keyboard: KeyboardMode;
  onEnd(c: Combat): void;
}

export class CombatScreen implements Screen {
  readonly root = el('div', 'screen combat');
  private hud = new Hud();
  private kb = new Keyboard();
  private field = el('div', 'field');
  private comboEl = el('div', 'combo');
  private pauseEl = el('div', 'pause-overlay', 'paused — click here to resume');
  private views = new Map<number, EnemyView>();
  private c: Combat;
  private raf = 0;
  private last = 0;
  private ended = false;

  constructor(private o: CombatOptions) {
    this.c = createCombat(o.specs, o.ctx);
    this.kb.setMods(o.run.keyMods);
    this.kb.setFingerHints(o.fingerHints);
    this.kb.root.classList.toggle('compact', o.keyboard === 'compact');
    this.kb.root.hidden = o.keyboard === 'hidden';
    this.kb.setDark(o.specs.some((s) => s.rule === 'blackout'));
    const hint = el('div', 'combat-hint', 'type a word to strike · tab or esc to switch target · backspace deletes a letter');
    this.root.append(this.hud.root, this.field, this.comboEl, this.kb.root, hint, this.pauseEl);
    this.pauseEl.hidden = true;
    for (const e of this.c.enemies) this.addEnemy(e);
    this.hud.update(o.run, this.c.shield);
    this.renderCombo();
  }

  mounted(): void {
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  unmount(): void {
    cancelAnimationFrame(this.raf);
  }

  private frame = (now: number) => {
    const dt = Math.min(now - this.last, 50);
    this.last = now;
    const paused = !document.hasFocus();
    this.pauseEl.hidden = !paused;
    if (!paused) this.handle(tick(this.c, this.o.run, dt));
    this.render();
    if (!this.ended) this.raf = requestAnimationFrame(this.frame);
  };

  onKey(key: string): void {
    if (this.c.over) return;
    if (key === 'Escape' || key === 'Tab') {
      cancelTarget(this.c);
      this.render();
      return;
    }
    if (key === 'Backspace') {
      backspace(this.c);
      this.render();
      return;
    }
    if (!/^[a-z]$/.test(key)) return;
    const ev = pressKey(this.c, this.o.run, key, this.o.ctx, performance.now());
    const ok = ev.some((e) => e.t === 'key-ok');
    this.kb.flash(key, ok);
    if (ok) sfx.keyClick(this.c.combo);
    this.handle(ev);
    this.render();
  }

  private addEnemy(e: Enemy): void {
    const root = el('div', `enemy enemy-${e.kind}`);
    if (e.rule) root.classList.add(`rule-${e.rule}`);
    const glyph = el('div', 'glyph', e.glyph);
    const name = el('div', 'enemy-name', e.name);
    const hp = el('div', 'enemy-hp');
    const hpFill = el('i');
    const hpText = el('span');
    hp.append(hpFill, hpText);
    const status = el('div', 'enemy-status');
    const word = el('div', 'word');
    const intent = el('div', 'intent');
    const intentFill = el('i');
    const intentText = el('span');
    intent.append(intentFill, intentText);
    root.append(glyph, name, hp, status, word, intent);
    this.field.append(root);
    this.views.set(e.id, { root, hpFill, hpText, word, intentFill, intentText, status, wordKey: '' });
  }

  private enemyEl(id: number): HTMLElement | undefined {
    return this.views.get(id)?.root;
  }

  private handle(events: CombatEvent[]): void {
    const run = this.o.run;
    for (const ev of events) {
      switch (ev.t) {
        case 'key-miss':
          sfx.miss();
          this.root.classList.remove('miss-flash');
          void this.root.offsetWidth;
          this.root.classList.add('miss-flash');
          if (ev.key) this.kb.flash(ev.key, false);
          break;
        case 'combo-break':
          floatText(this.comboEl, `combo lost −${ev.lost}`, 'ft-bad');
          break;
        case 'combo-tier':
          sfx.tierUp(ev.tier);
          floatText(this.comboEl, `×${COMBO_TIERS[ev.tier].mult}!`, 'ft-combo');
          burstAt(this.comboEl, '#ffe14d', 24);
          break;
        case 'hit': {
          const node = this.enemyEl(ev.enemyId);
          sfx.hit(ev.crit);
          floatText(node, `${ev.dmg}${ev.crit ? '!' : ''}`, ev.crit ? 'ft-crit' : 'ft-dmg');
          burstAt(node?.querySelector('.glyph'), ev.crit ? '#ff3860' : '#f4efe6', ev.crit ? 30 : 16);
          node?.classList.remove('hurt');
          void node?.offsetWidth;
          node?.classList.add('hurt');
          if (ev.crit) shake('small');
          break;
        }
        case 'burn':
          floatText(this.enemyEl(ev.enemyId), `${ev.dmg}`, 'ft-burn');
          burstAt(this.enemyEl(ev.enemyId)?.querySelector('.glyph'), MODS.ember.color, 6, 120);
          break;
        case 'spark': {
          sfx.zap();
          const to = this.enemyEl(ev.toId);
          floatText(to, `ϟ${ev.dmg}`, 'ft-spark');
          burstAt(to?.querySelector('.glyph'), MODS.spark.color, 12);
          break;
        }
        case 'thorns':
          floatText(this.enemyEl(ev.enemyId), `✱${ev.dmg}`, 'ft-dmg');
          break;
        case 'frost':
          floatText(this.enemyEl(ev.enemyId), `+${(ev.ms / 1000).toFixed(1)}s`, 'ft-frost');
          burstAt(this.enemyEl(ev.enemyId)?.querySelector('.intent'), MODS.frost.color, 10, 120);
          break;
        case 'kill': {
          sfx.kill();
          const v = this.views.get(ev.enemyId);
          if (v) {
            burstAt(v.root.querySelector('.glyph'), '#f4efe6', 40, 380);
            v.root.classList.add('dying');
            setTimeout(() => v.root.remove(), 450);
            this.views.delete(ev.enemyId);
          }
          shake('small');
          break;
        }
        case 'spawn': {
          const e = this.c.enemies.find((x) => x.id === ev.enemyId);
          if (e) this.addEnemy(e);
          break;
        }
        case 'player-hit':
          sfx.hurt();
          shake('big');
          floatText(this.hud.root.querySelector('.hp-bar'), ev.blocked ? `−${ev.dmg} (■${ev.blocked})` : `−${ev.dmg}`, 'ft-hurt');
          this.enemyEl(ev.enemyId)?.classList.add('attacking');
          setTimeout(() => this.enemyEl(ev.enemyId)?.classList.remove('attacking'), 300);
          this.root.classList.remove('hurt-flash');
          void this.root.offsetWidth;
          this.root.classList.add('hurt-flash');
          break;
        case 'shield':
          floatText(this.hud.root.querySelector('.shield-badge'), `+■${ev.amount}`, 'ft-shield');
          break;
        case 'heal':
          floatText(this.hud.root.querySelector('.hp-bar'), `+${ev.amount}`, 'ft-heal');
          break;
        case 'coins':
          sfx.coin();
          this.hud.pulseCoins();
          floatText(this.hud.root.querySelector('.coins'), `+${ev.amount}`, 'ft-coin');
          break;
        case 'glass-shatter':
          sfx.shatter();
          burstAt(this.kb.key(ev.key), MODS.glass.color, 40, 300);
          floatText(this.kb.key(ev.key), 'SHATTERED', 'ft-bad');
          this.kb.setMods(run.keyMods);
          break;
        case 'win':
        case 'lose':
          this.finish();
          break;
      }
    }
  }

  private finish(): void {
    if (this.ended) return;
    this.ended = true;
    this.kb.setNext(null);
    this.root.classList.add(this.c.over === 'win' ? 'won' : 'lost');
    setTimeout(() => this.o.onEnd(this.c), this.c.over === 'win' ? 700 : 1400);
  }

  private render(): void {
    const c = this.c;
    const run = this.o.run;
    const t = target(c);
    const rate = run.relics.includes('hourglass') ? 0.85 : 1;
    for (const e of c.enemies) {
      const v = this.views.get(e.id);
      if (!v) continue;
      v.hpFill.style.width = `${(e.hp / e.maxHp) * 100}%`;
      v.hpText.textContent = `${e.hp}`;
      const frac = Math.max(0, e.intent / e.intentMs);
      v.intentFill.style.width = `${frac * 100}%`;
      v.root.classList.toggle('danger', frac > 0.75);
      // Wind-up: the last second before a hit gets an unmistakable tell.
      const msLeft = (e.intentMs - e.intent) / rate;
      v.root.classList.toggle('windup', e.intent > 0 && msLeft <= WINDUP_MS);
      v.intentText.textContent = `⚔ ${e.atk}`;
      v.status.textContent = e.burn > 0 ? `▲ burn ${e.burn}` : '';
      v.root.classList.toggle('targeted', e === t);

      const typed = e === t ? c.typed.length : 0;
      const hidden = e.rule === 'blackout' && c.time - e.shownAt > BLACKOUT_VISIBLE_MS;
      const key = `${e.word}|${typed}|${hidden}`;
      if (key !== v.wordKey) {
        v.wordKey = key;
        v.word.replaceChildren(
          ...[...e.word].map((ch, i) => {
            const s = el('span', i < typed ? 'l done' : i === typed && e === t ? 'l next' : 'l');
            const mods = run.keyMods[ch];
            if (mods?.length) {
              s.classList.add('l-mod');
              s.style.setProperty('--mc', MODS[mods[mods.length - 1]].color);
            }
            s.textContent = hidden && i >= typed ? '_' : ch;
            return s;
          }),
        );
        v.word.classList.toggle('blacked', hidden);
      }
    }
    this.kb.setNext(t ? t.word[c.typed.length] ?? null : null);
    this.hud.update(run, c.shield);
    this.renderCombo();
  }

  private lastCombo = -1;
  private renderCombo(): void {
    if (this.c.combo === this.lastCombo) return;
    this.lastCombo = this.c.combo;
    const { tier, mult } = comboTier(this.c.combo);
    const nextAt = COMBO_TIERS[tier + 1]?.at;
    const prevAt = COMBO_TIERS[tier].at;
    const prog = nextAt ? (this.c.combo - prevAt) / (nextAt - prevAt) : 1;
    this.comboEl.className = `combo tier-${tier}`;
    this.comboEl.innerHTML = '';
    const bar = el('div', 'combo-bar');
    const fill = el('i');
    fill.style.width = `${prog * 100}%`;
    bar.append(fill);
    this.comboEl.append(el('span', 'combo-mult', `×${mult}`), el('span', 'combo-count', `${this.c.combo} combo`), bar);
  }
}
