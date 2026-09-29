import { STARTERS } from '../engine/run';
import type { Run, StarterId } from '../engine/state';
import { keyWeakness, nemesisBigram, topWeakKeys } from '../engine/stats';
import { el, heatLegend, Keyboard } from './keyboard';
import type { Screen } from './screen';

export class ResultsScreen implements Screen {
  readonly root = el('div', 'screen results');

  constructor(run: Run, unlocked: StarterId[], private done: () => void) {
    const t = run.totals;
    const won = run.result === 'won';
    const wpm = t.activeMs ? t.correct / 5 / (t.activeMs / 60000) : 0;
    const acc = t.correct + t.errors ? (t.correct / (t.correct + t.errors)) * 100 : 100;

    const head = el('h1', `results-title ${won ? 'win' : 'loss'}`, won ? 'VICTORY' : 'DEFEATED');
    const sub = el('p', 'results-sub', won ? 'Every glyph bows to your keyboard.' : `Fell in Act ${run.act}. The keys remember.`);

    const grid = el('div', 'stat-grid');
    const stat = (label: string, value: string) => {
      const s = el('div', 'stat');
      s.append(el('div', 'stat-value', value), el('div', 'stat-label', label));
      grid.append(s);
    };
    stat('avg wpm', wpm.toFixed(0));
    stat('peak wpm', t.peakWpm.toFixed(0));
    stat('accuracy', `${acc.toFixed(1)}%`);
    stat('max combo', String(t.maxCombo));
    stat('words', String(t.words));
    stat('fights won', String(t.fights));

    const kb = new Keyboard();
    kb.setHeat(keyWeakness(run.stats));
    const weak = topWeakKeys(run.stats, 3);
    const nem = nemesisBigram(run.stats);
    const insight = el('div', 'insight');
    insight.append(el('h3', '', 'This run’s heatmap'), kb.root, heatLegend());
    const notes = el('p', 'insight-notes');
    notes.textContent = [
      weak.length ? `Slowest keys: ${weak.map((k) => k.toUpperCase()).join(', ')} — expect to see them more next run.` : '',
      nem ? `Nemesis pair: “${nem.bigram}” at ${Math.round(nem.ms)}ms.` : '',
    ]
      .filter(Boolean)
      .join(' ');
    insight.append(notes);

    this.root.append(head, sub, grid, insight);
    for (const id of unlocked) this.root.append(el('div', 'unlock', `Unlocked: ${STARTERS[id].name} keyboard`));
    const again = el('button', 'start-btn', 'press ENTER for another run');
    again.addEventListener('click', () => this.done());
    this.root.append(again);
  }

  onKey(key: string): void {
    if (key === 'Enter') this.done();
  }
}
