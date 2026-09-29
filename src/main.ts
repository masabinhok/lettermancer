import './styles.css';
import words from './data/words.json';
import { wpm, type Combat, type CombatCtx } from './engine/combat';
import { applyUnlocks, KEYBOARD_MODES } from './engine/meta';
import { makeRng } from './engine/rng';
import { advance, BOSSES, currentNode, makeEncounter, newRun, rollReward } from './engine/run';
import type { NodeKind, Run, StarterId } from './engine/state';
import { keyWeakness, mergeStats } from './engine/stats';
import { WordBank } from './engine/words';
import { setSound } from './fx/audio';
import { BannerScreen } from './ui/banner-view';
import { CombatScreen } from './ui/combat-view';
import { MenuScreen } from './ui/menu-view';
import { ResultsScreen } from './ui/results-view';
import { RewardScreen } from './ui/reward-view';
import type { Screen } from './ui/screen';
import { ShopScreen } from './ui/shop-view';
import { loadMeta, loadStats, saveMeta, saveStats } from './storage';

const ACT_NAMES = ['The Home Row', 'The Glyph Wastes', 'The Unicode Abyss'];
const PERFECT_FIGHT_MIN_WORDS = 5;

class Game {
  private app = document.getElementById('app')!;
  private screen: Screen | null = null;
  private meta = loadMeta();
  private lifetime = loadStats();
  private bank = new WordBank(words);
  private rng = makeRng(Date.now());
  private run: Run | null = null;
  private unlockedThisRun: StarterId[] = [];

  constructor() {
    setSound(this.meta.sound);
    addEventListener('keydown', (e) => this.keydown(e));
    this.menu();
  }

  private keydown(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    let key = e.key;
    if (key.length === 1) {
      if (/[a-zA-Z]/.test(key)) key = key.toLowerCase();
      e.preventDefault(); // stop space-scrolling and Firefox quick-find on ' and /
    } else if (key === 'Backspace' || key === 'Enter' || key === 'Escape' || key === 'Tab') {
      e.preventDefault();
    }
    if (e.repeat) return;
    this.screen?.onKey(key);
  }

  private show(s: Screen): void {
    this.screen?.unmount?.();
    this.screen = s;
    this.app.replaceChildren(s.root);
    s.mounted?.();
  }

  private menu(): void {
    this.show(
      new MenuScreen({
        meta: this.meta,
        lifetime: this.lifetime,
        onStart: (starter) => this.startRun(starter),
        onToggle: (k) => {
          if (k === 'keyboard') {
            const i = KEYBOARD_MODES.indexOf(this.meta.keyboard);
            this.meta.keyboard = KEYBOARD_MODES[(i + 1) % KEYBOARD_MODES.length];
          } else this.meta[k] = !this.meta[k];
          setSound(this.meta.sound);
          saveMeta(this.meta);
        },
      }),
    );
  }

  private startRun(starter: StarterId): void {
    this.meta.lastStarter = starter;
    saveMeta(this.meta);
    const seed = Date.now();
    this.rng = makeRng(seed);
    this.run = newRun(starter, seed, this.rng);
    this.unlockedThisRun = [];
    this.show(new BannerScreen('ACT I', ACT_NAMES[0], 'Four fights, two shops, one boss. Good luck.', () => this.enterNode()));
  }

  private ctx(run: Run): CombatCtx {
    return {
      rng: this.rng,
      nextWord: (enemy, excludeFirst) =>
        this.bank.pick(
          {
            min: enemy.minLen,
            max: enemy.maxLen,
            excludeFirst,
            weak: keyWeakness(this.lifetime),
            modded: new Set(Object.keys(run.keyMods)),
          },
          this.rng,
        ).word,
    };
  }

  private enterNode(): void {
    const run = this.run!;
    const kind = currentNode(run);
    if (kind === 'shop') {
      this.show(
        new ShopScreen(run, this.rng, (coins) => {
          this.milestone({ coins });
          this.next();
        }),
      );
      return;
    }
    const fight = () =>
      this.show(
        new CombatScreen({
          run,
          specs: makeEncounter(run, kind, this.rng),
          ctx: this.ctx(run),
          fingerHints: this.meta.fingerHints,
          keyboard: this.meta.keyboard,
          onEnd: (c) => this.fightOver(kind, c),
        }),
      );
    if (kind === 'boss') {
      const b = BOSSES[run.bosses[run.act - 1]];
      this.show(new BannerScreen('BOSS', b.name, b.desc, fight, b.glyph));
    } else fight();
  }

  private fightOver(kind: NodeKind, c: Combat): void {
    const run = this.run!;
    const t = run.totals;
    t.correct += c.correct;
    t.errors += c.errors;
    t.activeMs += c.time;
    t.maxCombo = Math.max(t.maxCombo, c.maxCombo);
    t.words += c.words;
    if (c.words >= 3) t.peakWpm = Math.max(t.peakWpm, wpm(c));
    mergeStats(run.stats, c.stats);
    mergeStats(this.lifetime, c.stats);
    saveStats(this.lifetime);

    if (c.over === 'lose') {
      run.result = 'lost';
      this.finishRun();
      return;
    }

    t.fights++;
    const perfect = c.errors === 0 && c.words >= PERFECT_FIGHT_MIN_WORDS;
    if (perfect) t.perfectFights++;

    const lines = [`${c.words} words`, `${wpm(c).toFixed(0)} wpm`, `max combo ${c.maxCombo}`];
    if (perfect) lines.push('PERFECT');
    const reward = rollReward(run, kind, this.rng);
    run.coins += reward.coins;
    lines.push(`+${reward.coins + c.coinsEarned} coins`);
    if (run.relics.includes('interest')) {
      const interest = Math.min(5, Math.floor(run.coins / 5));
      run.coins += interest;
      if (interest) lines.push(`+${interest} interest`);
    }
    if (kind === 'boss') {
      const healed = Math.min(run.maxHp - run.hp, Math.round(run.maxHp * 0.4));
      run.hp += healed;
      if (healed) lines.push(`healed ${healed}`);
    }
    this.milestone({ perfectFight: perfect, coins: run.coins });

    const title = kind === 'boss' ? 'BOSS DEFEATED' : kind === 'elite' ? 'ELITE SLAIN' : 'VICTORY';
    this.show(new RewardScreen(run, reward, { title, lines }, () => this.next()));
  }

  private milestone(check: Parameters<typeof applyUnlocks>[1]): void {
    const earned = applyUnlocks(this.meta, check);
    if (earned.length) {
      this.unlockedThisRun.push(...earned);
      saveMeta(this.meta);
    }
  }

  private next(): void {
    const run = this.run!;
    const r = advance(run);
    if (r === 'victory') {
      this.finishRun();
    } else if (r === 'new-act') {
      this.milestone({ act: run.act });
      const numeral = ['I', 'II', 'III'][run.act - 1];
      this.show(new BannerScreen(`ACT ${numeral}`, ACT_NAMES[run.act - 1], 'Longer words. Faster enemies.', () => this.enterNode()));
    } else {
      this.enterNode();
    }
  }

  private finishRun(): void {
    const run = this.run!;
    this.meta.runs++;
    if (run.result === 'won') this.meta.wins++;
    this.meta.bestAct = Math.max(this.meta.bestAct, run.result === 'won' ? 4 : run.act);
    saveMeta(this.meta);
    this.show(new ResultsScreen(run, this.unlockedThisRun, () => this.menu()));
    this.run = null;
  }
}

new Game();
