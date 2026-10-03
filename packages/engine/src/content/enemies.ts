/**
 * Every foe in the game. Stats are multipliers on the act's baseline, so acts scale together.
 */
import type { BossRule, Trait } from '../state';

export interface ActBase {
  name: string;
  len: [number, number];
  hp: number;
  atk: number;
  intentMs: number;
}

export const ACT_BASE: ActBase[] = [
  // Tuned with the balance bot (tests/sim.test.ts): ~45% wins at 40 wpm with no permanent upgrades.
  { name: 'The Home Row', len: [3, 5], hp: 23, atk: 4, intentMs: 6850 },
  { name: 'The Glyph Wastes', len: [4, 7], hp: 36, atk: 7, intentMs: 6350 },
  { name: 'The Unicode Abyss', len: [5, 8], hp: 49, atk: 10, intentMs: 5850 },
];

export interface MonsterDef {
  name: string;
  glyph: string;
  traits: Trait[];
  hp: number;
  atk: number;
  /** attack interval multiplier (below 1 is faster) */
  speed: number;
  /** extra letters on top of the act's word length */
  len?: number;
}

const m = (name: string, glyph: string, traits: Trait[], hp = 1, atk = 1, speed = 1, len = 0): MonsterDef => ({
  name,
  glyph,
  traits,
  hp,
  atk,
  speed,
  len,
});

export const ROSTER: MonsterDef[][] = [
  [
    m('Typo Imp', '¿', []),
    m('Serif Slime', '§', ['splitter'], 1.1),
    m('Pilcrow', '¶', [], 1.4, 1, 1.15),
    m('Tilde Worm', '~', ['quick'], 0.8, 0.6, 0.55),
    m('Ampersand', '&', ['healer'], 1, 0.8),
  ],
  [
    m('Glyph Golem', 'Ω', ['armored'], 1.4, 1, 1.2, 2),
    m('Ligature Leech', 'æ', ['thief'], 0.9),
    m('Dagger', '‡', ['enrage'], 1),
    m('Psi Shade', 'Ψ', ['shifter'], 0.9),
    m('Theta Warden', 'Θ', ['warden'], 1.1, 0.8),
  ],
  [
    m('Sigma Beast', 'Σ', ['armored', 'enrage'], 1.3, 1, 1.1, 1),
    m('Lambda Lurker', 'λ', ['shifter', 'quick'], 0.8, 0.6, 0.6),
    m('Null Knight', 'Ø', ['warden', 'armored'], 1.2, 0.9, 1.1, 1),
    m('Phi Siren', 'Φ', ['summoner'], 1),
    m('Xi Swarm', 'Ξ', ['splitter', 'quick'], 0.9, 0.7, 0.7),
  ],
];

export const ELITES: MonsterDef[] = [
  m('Octothorpe', '#', ['armored', 'summoner'], 2.6, 1.4, 1, 2),
  m('The Asterisk', '*', ['thief', 'enrage'], 2.4, 1.4, 0.9, 2),
  m('At-Lord', '@', ['shifter', 'warden'], 2.5, 1.3, 1, 2),
];

export const MINION = m('Comma', ',', ['quick'], 0.35, 0.5, 0.7);

/** Seconds between trait actions. */
export const TRAIT_EVERY: Partial<Record<Trait, number>> = {
  shifter: 5000,
  healer: 6000,
  warden: 7000,
  summoner: 8000,
};

/** Warning shown before a shifter changes its word. */
export const SHIFT_WARN_MS = 1200;
export const MAX_MINIONS = 2;

export interface BossDef {
  rule: BossRule;
  name: string;
  glyph: string;
  /** shown on the boss title card */
  desc: string;
  /** health fractions at which the next phase begins */
  phases: number[];
  /** what changes in each phase after the first */
  phaseDesc: string[];
  len: [number, number];
  /** multiplier on the act's boss health */
  hp: number;
}

export const BOSSES: Record<BossRule, BossDef> = {
  hydra: {
    rule: 'hydra',
    name: 'Hydra of Ands',
    glyph: '&',
    desc: 'Every hit grows a new head.',
    phases: [0.5],
    phaseDesc: ['It grows a third head, and heads come faster.'],
    len: [7, 10],
    hp: 1,
  },
  mirror: {
    rule: 'mirror',
    name: 'Mirror Scribe',
    glyph: 'Ǝ',
    desc: 'Its words are written backwards. Type exactly what you see.',
    phases: [0.5],
    phaseDesc: ['The mirror cracks: it strikes faster and its words grow longer.'],
    len: [4, 6],
    hp: 0.9,
  },
  blackout: {
    rule: 'blackout',
    name: 'Blackout',
    glyph: '●',
    desc: 'Its words fade after a moment. Type from memory.',
    phases: [0.5],
    phaseDesc: ['The dark deepens: words vanish faster.'],
    // Short enough to hold in memory: it's a memory test, not a reading-speed spike (issue #19).
    len: [4, 7],
    hp: 1,
  },
  redactor: {
    rule: 'redactor',
    name: 'The Redactor',
    glyph: 'Ʀ',
    desc: 'It blots out a letter in every word. Work out the word and type all of it.',
    phases: [0.5],
    phaseDesc: ['Two letters are blotted out now.'],
    len: [5, 7],
    hp: 1,
  },
  grammarian: {
    rule: 'grammarian',
    name: 'The Grammarian',
    glyph: 'Γ',
    desc: 'It speaks in long words, then punctuation, then whole phrases.',
    phases: [0.66, 0.33],
    phaseDesc: ['Its words now end in punctuation.', 'It speaks in two-word phrases. Type the space.'],
    len: [7, 10],
    hp: 1.1,
  },
  wyrm: {
    rule: 'wyrm',
    name: 'Lexicon Wyrm',
    glyph: 'W',
    desc: 'A vast, slow beast of very long words.',
    phases: [0.5],
    phaseDesc: ['It sheds commas: small foes join the fight.'],
    len: [9, 12],
    hp: 1.3,
  },
};

/** Which bosses can appear in each act. */
export const BOSS_POOLS: BossRule[][] = [
  ['hydra', 'mirror'],
  ['blackout', 'redactor'],
  ['grammarian', 'wyrm'],
];

export const BOSS_BASE = [
  { hp: 146, atk: 9, intentMs: 6350 },
  { hp: 243, atk: 13, intentMs: 5850 },
  { hp: 356, atk: 18, intentMs: 5510 },
];

/** How long a Blackout word stays visible, per phase. Long enough to read a word once, calmly. */
export const BLACKOUT_VISIBLE_MS = [2000, 1300];
export const PUNCTUATION = ',.;:!?';
