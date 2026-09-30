/**
 * Oaths: difficulty you choose. Each level raises the run's Heat, and Heat raises rewards.
 */
export type OathId = 'swift' | 'iron' | 'fragile' | 'brittle' | 'caps' | 'punct' | 'scarce';

export interface OathDef {
  id: OathId;
  name: string;
  /** what one level does */
  desc: string;
  max: number;
}

export const OATHS: Record<OathId, OathDef> = {
  swift: { id: 'swift', name: 'Oath of Haste', desc: 'Enemies attack 12% faster per level.', max: 3 },
  iron: { id: 'iron', name: 'Oath of Iron', desc: 'Enemies have 20% more health per level.', max: 3 },
  fragile: { id: 'fragile', name: 'Oath of Care', desc: 'Every typo costs 1 health.', max: 1 },
  brittle: {
    id: 'brittle',
    name: 'Oath of Flow',
    desc: 'Your combo breaks if you stop typing for 2.5 seconds.',
    max: 1,
  },
  caps: { id: 'caps', name: 'Oath of Capitals', desc: 'Some words are capitalized, and case matters.', max: 1 },
  punct: { id: 'punct', name: 'Oath of Punctuation', desc: 'Some words end in punctuation you must type.', max: 1 },
  scarce: { id: 'scarce', name: 'Oath of Scarcity', desc: 'Shop prices rise 25% per level.', max: 2 },
};

export const OATH_IDS = Object.keys(OATHS) as OathId[];

export type OathLevels = Partial<Record<OathId, number>>;

export const oath = (o: OathLevels, id: OathId): number => Math.max(0, Math.min(OATHS[id].max, o[id] ?? 0));

export const heat = (o: OathLevels): number => OATH_IDS.reduce((s, id) => s + oath(o, id), 0);

export const MAX_HEAT = OATH_IDS.reduce((s, id) => s + OATHS[id].max, 0);
