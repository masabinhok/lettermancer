/**
 * Prophecies: achievements. Each is checked after a run or a practice test and pays out Seals.
 */
import type { RunConfig, RunReport } from '../machine';
import type { Meta } from '../meta';
import { BLESSINGS, isDuo, MODS, type BlessingId, type ModId } from '../mods';
import type { Run } from '../state';
import type { MasteryRank } from '../stats';
import { ROSTER, ELITES } from './enemies';
import { EVENT_IDS } from './events';
import { heat } from './oaths';

export interface PracticeSummary {
  mode: 'time' | 'words' | 'quote' | 'lesson';
  /** test length in seconds */
  seconds: number;
  wpm: number;
  accuracy: number;
}

export interface ProphecyCtx {
  meta: Meta;
  mastery: Record<string, MasteryRank>;
  totalKeys: number;
  run?: { report: RunReport; run: Run; config: RunConfig };
  practice?: PracticeSummary;
}

export type ProphecyCategory =
  | 'Speed'
  | 'Accuracy'
  | 'Combo'
  | 'Progress'
  | 'Bosses'
  | 'Heat'
  | 'Builds'
  | 'Wealth'
  | 'Explorer'
  | 'Mastery'
  | 'Practice'
  | 'Dedication';

export interface ProphecyDef {
  id: string;
  name: string;
  desc: string;
  category: ProphecyCategory;
  seals: number;
  check(x: ProphecyCtx): boolean;
}

const won = (x: ProphecyCtx) => x.run?.report.result === 'won';
const acc = (x: ProphecyCtx) => {
  const t = x.run?.run.totals;
  return t && t.correct + t.errors ? t.correct / (t.correct + t.errors) : 0;
};
const picked = (x: ProphecyCtx, kind: string) =>
  x.run?.report.picks.filter((p) => p.kind === kind).map((p) => p.id) ?? [];
const ranked = (x: ProphecyCtx, rank: number, keys = 'abcdefghijklmnopqrstuvwxyz') =>
  [...keys].filter((k) => x.mastery[k] >= rank).length;
const ALL_ENEMIES = [...ROSTER.flat(), ...ELITES].map((m) => m.name);
const ALL_BOSSES = ['hydra', 'mirror', 'blackout', 'redactor', 'grammarian', 'wyrm'];

const p = (
  id: string,
  category: ProphecyCategory,
  name: string,
  desc: string,
  seals: number,
  check: (x: ProphecyCtx) => boolean,
): ProphecyDef => ({ id, category, name, desc, seals, check });

export const PROPHECIES: ProphecyDef[] = [
  // Speed
  ...([40, 60, 80, 100, 120] as const).map((w, i) =>
    p(
      `speed-${w}`,
      'Speed',
      ['Quick Quill', 'Swift Scribe', 'Racing Nib', 'Storm of Ink', 'Lightning Hand'][i],
      `Win a fight at ${w} wpm or more.`,
      1 + i,
      (x) => (x.run?.run.totals.peakWpm ?? 0) >= w,
    ),
  ),
  // Accuracy
  p(
    'clean-fight',
    'Accuracy',
    'Clean Page',
    'Win a fight of 5+ words without a typo.',
    1,
    (x) => (x.run?.run.totals.perfectFights ?? 0) > 0,
  ),
  p(
    'clean-run-97',
    'Accuracy',
    'Careful Hand',
    'Finish a run with 97% accuracy or better.',
    2,
    (x) => !!x.run && x.run.report.fights.length >= 5 && acc(x) >= 0.97,
  ),
  p(
    'clean-run-99',
    'Accuracy',
    'Flawless Copy',
    'Finish a run with 99% accuracy or better.',
    4,
    (x) => !!x.run && x.run.report.fights.length >= 5 && acc(x) >= 0.99,
  ),
  p(
    'clean-boss',
    'Accuracy',
    'Untouchable Ink',
    'Beat a boss without a single typo.',
    3,
    (x) => !!x.run?.report.fights.some((f) => f.node === 'boss' && f.errors === 0),
  ),
  p(
    'clean-elite',
    'Accuracy',
    'Sure Stroke',
    'Beat an elite without a single typo.',
    2,
    (x) => !!x.run?.report.fights.some((f) => f.node === 'elite' && f.errors === 0),
  ),
  // Combo
  ...([50, 100, 200] as const).map((c, i) =>
    p(
      `combo-${c}`,
      'Combo',
      ['Unbroken Line', 'Hundred Strokes', 'Endless Thread'][i],
      `Reach a ${c} combo.`,
      1 + i * 2,
      (x) => (x.run?.run.totals.maxCombo ?? 0) >= c,
    ),
  ),
  // Progress
  p('act-1', 'Progress', 'Past the Home Row', 'Clear Act I.', 1, (x) => (x.run?.report.bossesBeaten.length ?? 0) >= 1),
  p('act-2', 'Progress', 'Across the Wastes', 'Clear Act II.', 2, (x) => (x.run?.report.bossesBeaten.length ?? 0) >= 2),
  p('win', 'Progress', 'The Last Word', 'Win a run.', 3, won),
  p('win-5', 'Progress', 'Well Read', 'Win 5 runs.', 3, (x) => x.meta.wins >= 5),
  p('win-20', 'Progress', 'Legend of the Scriptorium', 'Win 20 runs.', 6, (x) => x.meta.wins >= 20),
  ...(['apprentice', 'glassblower', 'cryomancer', 'tycoon'] as const).map((s) =>
    p(
      `win-${s}`,
      'Progress',
      `${s[0].toUpperCase()}${s.slice(1)}'s Triumph`,
      `Win a run with the ${s[0].toUpperCase()}${s.slice(1)} keyboard.`,
      2,
      (x) => (x.meta.winsByStarter[s] ?? 0) > 0,
    ),
  ),
  p('gentle-win', 'Progress', 'Slow and Sure', 'Win a run at Gentle pace.', 1, (x) => won(x) && !!x.run?.config.gentle),
  // Bosses
  ...ALL_BOSSES.map((b) =>
    p(
      `boss-${b}`,
      'Bosses',
      `Fell the ${b[0].toUpperCase()}${b.slice(1)}`,
      `Defeat ${{ hydra: 'the Hydra of Ands', mirror: 'the Mirror Scribe', blackout: 'Blackout', redactor: 'The Redactor', grammarian: 'The Grammarian', wyrm: 'the Lexicon Wyrm' }[b]}.`,
      2,
      (x) => (x.meta.codex.bosses[b] ?? 0) > 0,
    ),
  ),
  p('all-bosses', 'Bosses', 'Nothing Left Unwritten', 'Defeat all six bosses.', 5, (x) =>
    ALL_BOSSES.every((b) => (x.meta.codex.bosses[b] ?? 0) > 0),
  ),
  // Heat
  ...([1, 3, 6, 10] as const).map((h, i) =>
    p(
      `heat-${h}`,
      'Heat',
      ['Sworn', 'Oathbound', 'Pyre-Walker', 'Burning Page'][i],
      `Win a run at Heat ${h} or higher.`,
      2 + i * 2,
      (x) => won(x) && heat(x.run!.config.oaths) >= h,
    ),
  ),
  // Builds
  p('duo', 'Builds', 'Two Voices', 'Take a duo boon.', 2, (x) =>
    picked(x, 'blessing').some((id) => isDuo(id as BlessingId)),
  ),
  p(
    'all-duos',
    'Builds',
    'Choir of Muses',
    'Take every duo boon across your runs.',
    6,
    (x) => x.meta.codex.boons.filter((id) => id in BLESSINGS && isDuo(id as BlessingId)).length >= 7,
  ),
  p(
    'heroic',
    'Builds',
    'Heroic Ink',
    'Bind a Heroic key power.',
    2,
    (x) => !!x.run && Object.values(x.run.run.keyMods).some((l) => l.some((b) => b.rarity === 3)),
  ),
  p(
    'ten-keys',
    'Builds',
    'Full Keyboard',
    'Have powers on 10 different keys at once.',
    3,
    (x) => !!x.run && Object.values(x.run.run.keyMods).filter((l) => l.length).length >= 10,
  ),
  p('devotee', 'Builds', 'Devotee', 'Hold all three blessings of one muse.', 3, (x) => {
    const b = x.run?.run.blessings ?? [];
    return ['ignis', 'glacia', 'volta', 'aurum', 'resona', 'aegis'].some(
      (m) => b.filter((id) => !isDuo(id) && BLESSINGS[id].muses[0] === m).length >= 3,
    );
  }),
  p('relics-5', 'Builds', 'Reliquary', 'Hold 5 relics in one run.', 2, (x) => (x.run?.run.relics.length ?? 0) >= 5),
  p(
    'glass-intact',
    'Builds',
    'Steady Glass',
    'Win a run with every Glass key still whole.',
    4,
    (x) =>
      won(x) &&
      x.run!.run.starter === 'glassblower' &&
      Object.values(x.run!.run.keyMods).filter((l) => l.some((b) => b.mod === 'glass')).length >= 3,
  ),
  // Wealth
  p(
    'coins-100',
    'Wealth',
    'Heavy Purse',
    'Hold 100 coins at once.',
    1,
    (x) => (x.run?.run.totals.maxCoins ?? 0) >= 100,
  ),
  p(
    'spend-150',
    'Wealth',
    'Patron of the Foundry',
    'Spend 150 coins in one run.',
    2,
    (x) => (x.run?.run.totals.coinsSpent ?? 0) >= 150,
  ),
  p('leaf-10', 'Wealth', 'Gilded', 'Hold 10 Gold Leaf.', 2, (x) => x.meta.leaf >= 10),
  // Explorer
  p('all-enemies', 'Explorer', 'Bestiary', 'Meet every kind of enemy.', 3, (x) =>
    ALL_ENEMIES.every((n) => (x.meta.codex.enemies[n] ?? 0) > 0),
  ),
  p('all-events', 'Explorer', 'Curious', 'Find every kind of event.', 2, (x) =>
    EVENT_IDS.every((e) => x.meta.codex.events.includes(e)),
  ),
  p('all-powers', 'Explorer', 'Every Ink', 'Bind every kind of key power across your runs.', 3, (x) =>
    (Object.keys(MODS) as ModId[]).every((m) => x.meta.codex.boons.includes(m)),
  ),
  // Mastery
  p('bronze-1', 'Mastery', 'First Bronze', 'Raise any key to Bronze mastery.', 1, (x) => ranked(x, 1) >= 1),
  p('silver-5', 'Mastery', 'Silvered', 'Raise 5 keys to Silver mastery.', 2, (x) => ranked(x, 2) >= 5),
  p('gold-e', 'Mastery', 'Golden E', 'Raise E to Gold mastery.', 2, (x) => x.mastery.e >= 3),
  p(
    'home-gold',
    'Mastery',
    'Home Row of Gold',
    'Raise every home-row letter to Gold.',
    4,
    (x) => ranked(x, 3, 'asdfghjkl') === 9,
  ),
  p('all-bronze', 'Mastery', 'Bronze Alphabet', 'Raise every letter to Bronze.', 3, (x) => ranked(x, 1) === 26),
  p('all-silver', 'Mastery', 'Silver Alphabet', 'Raise every letter to Silver.', 5, (x) => ranked(x, 2) === 26),
  p('all-gold', 'Mastery', 'Golden Alphabet', 'Raise every letter to Gold.', 8, (x) => ranked(x, 3) === 26),
  // Practice
  p(
    'practice-60s',
    'Practice',
    'Warm Hands',
    'Finish a 60-second practice test.',
    1,
    (x) => x.practice?.mode === 'time' && x.practice.seconds >= 60,
  ),
  p(
    'practice-60wpm',
    'Practice',
    'Sixty',
    'Reach 60 wpm in a practice test of 30 seconds or more.',
    2,
    (x) => !!x.practice && x.practice.seconds >= 30 && x.practice.wpm >= 60,
  ),
  p(
    'practice-100wpm',
    'Practice',
    'Hundred',
    'Reach 100 wpm in a practice test of 30 seconds or more.',
    4,
    (x) => !!x.practice && x.practice.seconds >= 30 && x.practice.wpm >= 100,
  ),
  p(
    'practice-perfect',
    'Practice',
    'Without Blemish',
    'Finish a practice test of 30 seconds or more at 100% accuracy.',
    2,
    (x) => !!x.practice && x.practice.seconds >= 30 && x.practice.accuracy >= 1,
  ),
  p('streak-7', 'Practice', 'Seven Days', 'Practice seven days in a row.', 3, (x) => x.meta.practice.streak >= 7),
  p(
    'lesson-all',
    'Practice',
    'All Letters Learned',
    'Unlock every letter in the adaptive lessons.',
    4,
    (x) => x.meta.practice.lessonLetters >= 26,
  ),
  // Dedication
  p('tutorial', 'Dedication', 'First Lesson', 'Finish the tutorial.', 1, (x) => x.meta.prologueDone),
  p('runs-10', 'Dedication', 'Regular', 'Play 10 runs.', 2, (x) => x.meta.runs >= 10),
  p('runs-50', 'Dedication', 'Resident Scribe', 'Play 50 runs.', 4, (x) => x.meta.runs >= 50),
  p('keys-10k', 'Dedication', 'Ten Thousand Strokes', 'Type 10,000 correct keys.', 2, (x) => x.totalKeys >= 10_000),
  p('keys-100k', 'Dedication', 'A Hundred Thousand', 'Type 100,000 correct keys.', 5, (x) => x.totalKeys >= 100_000),
  p('keys-1m', 'Dedication', 'A Million Letters', 'Type 1,000,000 correct keys.', 10, (x) => x.totalKeys >= 1_000_000),
];

export const PROPHECY_BY_ID = Object.fromEntries(PROPHECIES.map((q) => [q.id, q]));
