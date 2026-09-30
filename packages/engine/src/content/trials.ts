/**
 * Trials: practice tests with a bar to clear. Passing one pays Gold Leaf, and most raise
 * how much Heat you may swear — progress that only better typing can earn.
 */
export interface TrialDef {
  id: string;
  name: string;
  mode: 'time' | 'words';
  amount: number;
  punctuation: boolean;
  minWpm: number;
  minAccuracy: number;
  leaf: number;
  /** passing raises your Oath Heat limit by one */
  raisesHeat: boolean;
}

export const TRIALS: TrialDef[] = [
  {
    id: 'steady',
    name: 'Trial of the Steady Hand',
    mode: 'time',
    amount: 30,
    punctuation: false,
    minWpm: 30,
    minAccuracy: 0.97,
    leaf: 2,
    raisesHeat: true,
  },
  {
    id: 'swift',
    name: 'Trial of the Swift Quill',
    mode: 'time',
    amount: 30,
    punctuation: false,
    minWpm: 50,
    minAccuracy: 0.95,
    leaf: 3,
    raisesHeat: true,
  },
  {
    id: 'stamina',
    name: 'Trial of Stamina',
    mode: 'time',
    amount: 120,
    punctuation: false,
    minWpm: 45,
    minAccuracy: 0.95,
    leaf: 3,
    raisesHeat: true,
  },
  {
    id: 'flawless',
    name: 'Trial of the Flawless Page',
    mode: 'words',
    amount: 50,
    punctuation: false,
    minWpm: 40,
    minAccuracy: 1,
    leaf: 4,
    raisesHeat: false,
  },
  {
    id: 'grammar',
    name: 'Trial of Punctuation',
    mode: 'time',
    amount: 60,
    punctuation: true,
    minWpm: 45,
    minAccuracy: 0.95,
    leaf: 3,
    raisesHeat: true,
  },
  {
    id: 'storm',
    name: 'Trial of the Storm',
    mode: 'time',
    amount: 30,
    punctuation: false,
    minWpm: 80,
    minAccuracy: 0.96,
    leaf: 5,
    raisesHeat: true,
  },
];

export const TRIAL_BY_ID = Object.fromEntries(TRIALS.map((t) => [t.id, t]));
