/**
 * The prologue: a short scripted fight sequence that teaches one idea at a time.
 * It uses the real combat rules with fixed words, so what you learn is exactly how runs play.
 */
import {
  backspace,
  cancelTarget,
  createCombat,
  makeRng,
  newRun,
  pressKey,
  tick,
  type Combat,
  type CombatCtx,
  type CombatEvent,
  type EnemySpec,
  type ModId,
  type Run,
} from '@keycraft/engine';

export interface PrologueStep {
  id: string;
  title: string;
  /** what to do, shown while the step is active */
  coach: string;
  /** shown for a moment once the step is done */
  praise: string;
  enemies?: EnemySpec[];
  words?: string[];
  goal: 'kill' | 'combo' | 'install';
  /** mod handed out on an install step */
  mod?: ModId;
}

const foe = (name: string, glyph: string, hp: number, over: Partial<EnemySpec> = {}): EnemySpec => ({
  kind: 'normal',
  name,
  glyph,
  hp,
  maxHp: hp,
  atk: 0,
  intentMs: 1e9,
  minLen: 3,
  maxLen: 6,
  ...over,
});

export const STEPS: PrologueStep[] = [
  {
    id: 'strike',
    title: 'Strike',
    coach: 'A Typo Imp blocks the page. Type the word under it to strike. Each letter you finish is a point of damage.',
    praise: 'Clean hits.',
    enemies: [foe('Typo Imp', '¿', 9)],
    words: ['ink', 'quill', 'page', 'nib'],
    goal: 'kill',
  },
  {
    id: 'target',
    title: 'Choose a target',
    coach:
      'Two foes. The first letter you type locks onto that word. Changed your mind? Press Tab to let go. Backspace deletes a letter.',
    praise: 'You pick your fights.',
    enemies: [foe('Serif Slime', '§', 7), foe('Pilcrow', '¶', 7)],
    words: ['scroll', 'vellum', 'seal', 'wax', 'script', 'verse'],
    goal: 'kill',
  },
  {
    id: 'threat',
    title: 'Watch the bar',
    coach:
      'Enemies strike when the bar under them fills. The card glows red one second before the hit. Finish the word first.',
    praise: 'That bar is your clock. Beat it.',
    enemies: [foe('Caret Bat', '^', 14, { atk: 2, intentMs: 6500 })],
    words: ['candle', 'margin', 'binding', 'folio', 'chapter'],
    goal: 'kill',
  },
  {
    id: 'combo',
    title: 'Build combo',
    coach:
      'Every clean letter adds to your combo. Reach 10 in a row without a typo to deal ×1.5 damage. A typo resets it.',
    praise: 'Combo climbs to ×4. Accuracy beats speed.',
    enemies: [foe('Glyph Golem', 'Ω', 60)],
    words: ['letter', 'rhythm', 'steady', 'lantern', 'harbor', 'mellow'],
    goal: 'combo',
  },
  {
    id: 'install',
    title: 'Bind a power',
    coach:
      'Winning fights earns powers for your keys. Press E to bind Ember to it. From now on every E you type sets its target burning.',
    praise: 'Your E is alight.',
    goal: 'install',
    mod: 'ember',
  },
  {
    id: 'burn',
    title: 'Use your build',
    coach: 'Letters that carry a power glow in enemy words. The more E’s in a word, the more it burns.',
    praise: 'That is the whole craft. The rest is practice.',
    enemies: [foe('Ampersand', '&', 30)],
    words: ['eerie', 'breeze', 'geese', 'melee', 'cheese', 'needle'],
    goal: 'kill',
  },
];

const STEP_MS = 5;

/** Runs one prologue step's combat with a fixed word queue. */
export class PrologueFight {
  readonly run: Run;
  combat: Combat | null = null;
  private ctx: CombatCtx;
  private queue: string[] = [];

  constructor() {
    this.run = newRun('apprentice', 1, makeRng(1));
    this.run.keyMods = {};
    this.run.coins = 0;
    this.ctx = { rng: makeRng(2), nextWord: (_e, exclude) => this.nextWord(exclude) };
  }

  private nextWord(exclude: ReadonlySet<string>): string {
    const i = this.queue.findIndex((w) => !exclude.has(w[0]));
    const w = i >= 0 ? this.queue.splice(i, 1)[0] : 'ink';
    this.queue.push(w); // cycle, so the step never runs dry
    return w;
  }

  start(step: PrologueStep): void {
    this.queue = [...(step.words ?? [])];
    this.run.hp = this.run.maxHp;
    this.combat = step.enemies ? createCombat(structuredClone(step.enemies), this.ctx) : null;
  }

  advance(to: number): CombatEvent[] {
    const c = this.combat;
    const ev: CombatEvent[] = [];
    if (!c) return ev;
    while (!c.over && c.time + STEP_MS <= to) ev.push(...tick(c, this.run, STEP_MS));
    return ev;
  }

  key(k: string, at: number): CombatEvent[] {
    const c = this.combat;
    if (!c || c.over) return [];
    return [...this.advance(at), ...pressKey(c, this.run, k, this.ctx, at)];
  }

  backspace(): void {
    if (this.combat) backspace(this.combat);
  }

  untarget(): void {
    if (this.combat) cancelTarget(this.combat);
  }
}
