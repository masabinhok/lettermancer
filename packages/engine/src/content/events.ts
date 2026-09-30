/**
 * Events: rooms without a fight. Each offers a choice; some ask you to type your way through.
 */
export type EventId = 'cursed-folio' | 'inkwell' | 'shrine' | 'gambler' | 'rest' | 'trial';

export interface EventDef {
  id: EventId;
  title: string;
  /** scene-setting line; `{muse}` is replaced with the shrine's muse */
  text: string;
}

export const EVENTS: Record<EventId, EventDef> = {
  'cursed-folio': {
    id: 'cursed-folio',
    title: 'The Cursed Folio',
    text: 'A folio bound in black thread lies open. Its curse can be copied out — and copying a curse is how you steal its power.',
  },
  inkwell: {
    id: 'inkwell',
    title: 'The Wishing Inkwell',
    text: 'An inkwell as deep as a well. Coins glint at the bottom. The ink smells faintly of medicine.',
  },
  shrine: {
    id: 'shrine',
    title: 'A Forgotten Shrine',
    text: 'A small shrine to {muse}, dusty but warm. A muse remembers those who remember her.',
  },
  gambler: {
    id: 'gambler',
    title: "The Gambler's Quill",
    text: 'A quill that writes by itself offers a wager. It wins a little more often than it loses.',
  },
  rest: {
    id: 'rest',
    title: "A Scribe's Desk",
    text: 'A quiet desk, a candle still burning. You could rest your hands, or practice.',
  },
  trial: {
    id: 'trial',
    title: 'The Speed Trial',
    text: 'A sand-glass and three words on a slate. Beat the sand, and the purse on the desk is yours.',
  },
};

export const EVENT_IDS = Object.keys(EVENTS) as EventId[];

/** Lines to transcribe for the Cursed Folio. */
export const CURSES = [
  'the ink remembers every hand that held the quill',
  'no page stays blank for long in the dark',
  'speak the letters and the letters will answer',
  'what is written in haste is read in regret',
  'a steady hand outlasts a quick one',
  'every word you keep will keep you',
];

export const TRIAL_MS = 6000;
export const FOLIO_TYPO_HP = 2;
