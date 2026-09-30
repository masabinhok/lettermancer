/**
 * The share card: a 1200×630 image of a finished run (result, score, speed and build) to post anywhere.
 * Drawn on a canvas with the game's own fonts and colors, so it needs no server.
 */
import { heat, MODS, RELICS, runScore, STARTERS, type RunMachine } from '@keycraft/engine';

const W = 1200;
const H = 630;
const C = {
  night: '#130f1d',
  ink: '#221b33',
  rule: '#3d3358',
  moon: '#ddd7ea',
  dim: '#a79fbd',
  faint: '#6f6788',
  gold: '#d9b45b',
  bright: '#f3d98c',
  rose: '#e24b6e',
};
const DISPLAY = "'Cinzel Variable', 'Cinzel', serif";
const TEXT = "'Alegreya Sans', system-ui, sans-serif";

export interface CardFacts {
  avgWpm: number;
  accuracy: number;
  /** "Daily rite · 2026-10-01", "Weekly challenge", or null for a standard run */
  mode: string | null;
  player: string | null;
}

export async function drawShareCard(machine: RunMachine, facts: CardFacts): Promise<HTMLCanvasElement> {
  await document.fonts?.ready;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d')!;
  const { run } = machine;
  const won = run.result === 'won';

  // Night background with a warm glow and a gilt double border.
  g.fillStyle = C.night;
  g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W / 2, H * 1.1, 50, W / 2, H * 1.1, W * 0.7);
  glow.addColorStop(0, won ? 'rgba(217,180,91,0.28)' : 'rgba(226,75,110,0.2)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = C.gold;
  g.lineWidth = 3;
  g.strokeRect(18, 18, W - 36, H - 36);
  g.strokeStyle = C.rule;
  g.lineWidth = 1;
  g.strokeRect(28, 28, W - 56, H - 56);

  // Header: the game, the mode, the player.
  g.textBaseline = 'alphabetic';
  g.fillStyle = C.gold;
  g.font = `700 30px ${DISPLAY}`;
  g.fillText('KEYCRAFT', 70, 88);
  g.fillStyle = C.dim;
  g.font = `22px ${TEXT}`;
  const sub = [facts.mode, facts.player].filter(Boolean).join(' · ');
  if (sub) {
    g.textAlign = 'right';
    g.fillText(sub, W - 70, 88);
    g.textAlign = 'left';
  }

  // The verdict and the score.
  g.fillStyle = won ? C.bright : C.rose;
  g.font = `700 96px ${DISPLAY}`;
  g.fillText(won ? 'Victory' : 'Fallen', 66, 200);
  g.fillStyle = C.dim;
  g.font = `26px ${TEXT}`;
  const runHeat = heat(run.oaths);
  const line = [
    STARTERS[machine.config.starter].name,
    won ? 'all three acts' : `fell in Act ${run.act}`,
    runHeat ? `Heat ${runHeat}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  g.fillText(line, 70, 248);

  g.fillStyle = C.faint;
  g.font = `20px ${TEXT}`;
  g.fillText('SCORE', 70, 318);
  g.fillStyle = C.bright;
  g.font = `700 72px ${DISPLAY}`;
  g.fillText(runScore(run).toLocaleString(), 66, 386);

  // Stats row.
  const t = run.totals;
  const stats: [string, string][] = [
    ['avg wpm', String(Math.round(facts.avgWpm))],
    ['peak wpm', String(Math.round(t.peakWpm))],
    ['accuracy', `${facts.accuracy.toFixed(1)}%`],
    ['best combo', String(t.maxCombo)],
    ['words', String(t.words)],
  ];
  stats.forEach(([label, value], i) => {
    const x = 70 + i * 138;
    g.fillStyle = C.moon;
    g.font = `700 36px ${DISPLAY}`;
    g.fillText(value, x, 470);
    g.fillStyle = C.faint;
    g.font = `18px ${TEXT}`;
    g.fillText(label, x, 498);
  });

  // The build: every empowered key as a tile, then relics.
  const bx = 760;
  g.fillStyle = C.gold;
  g.font = `700 22px ${DISPLAY}`;
  g.fillText('Build', bx, 170);
  const keys = Object.entries(run.keyMods)
    .filter(([, m]) => m.length)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 15);
  keys.forEach(([k, boons], i) => {
    const x = bx + (i % 5) * 72;
    const y = 190 + Math.floor(i / 5) * 82;
    g.fillStyle = C.ink;
    g.fillRect(x, y, 62, 70);
    g.strokeStyle = MODS[boons[0].mod].color;
    g.lineWidth = 2;
    g.strokeRect(x + 1, y + 1, 60, 68);
    g.fillStyle = C.moon;
    g.font = `700 28px ${DISPLAY}`;
    g.textAlign = 'center';
    g.fillText(k.toUpperCase(), x + 31, y + 36);
    g.font = `18px ${TEXT}`;
    boons.forEach((b, j) => {
      g.fillStyle = MODS[b.mod].color;
      g.fillText(MODS[b.mod].glyph, x + 31 + (j - (boons.length - 1) / 2) * 20, y + 60);
    });
    g.textAlign = 'left';
  });
  if (!keys.length) {
    g.fillStyle = C.faint;
    g.font = `20px ${TEXT}`;
    g.fillText('No powers bound.', bx, 214);
  }
  if (run.relics.length) {
    g.fillStyle = C.dim;
    g.font = `20px ${TEXT}`;
    const names = run.relics.map((r) => RELICS[r].name).join(', ');
    wrap(g, `Relics: ${names}`, bx, 470, W - 70 - bx, 26);
  }

  g.fillStyle = C.faint;
  g.font = `18px ${TEXT}`;
  g.fillText('A typing roguelike · every run verified by replay', 70, H - 62);
  return cv;
}

function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, lh: number): void {
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (g.measureText(next).width > width && line) {
      g.fillText(line, x, y);
      y += lh;
      line = word;
    } else line = next;
  }
  if (line) g.fillText(line, x, y);
}

const toBlob = (cv: HTMLCanvasElement) =>
  new Promise<Blob>((ok, fail) => cv.toBlob((b) => (b ? ok(b) : fail(new Error('no image'))), 'image/png'));

/** Copy the card to the clipboard when the browser allows it, otherwise download it. */
export async function shareCard(cv: HTMLCanvasElement, name: string): Promise<'copied' | 'saved'> {
  const blob = await toBlob(cv);
  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      return 'copied';
    }
  } catch {
    // fall through to a download
  }
  saveCard(blob, name);
  return 'saved';
}

export function saveCard(blob: Blob, name: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export { toBlob as cardBlob };
