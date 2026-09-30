/** Tiny synthesized sound kit — no audio assets. */
let ctx: AudioContext | null = null;
let enabled = true;

export function setSound(on: boolean): void {
  enabled = on;
}

function ac(): AudioContext | null {
  if (!enabled) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, slideTo?: number): void {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, gain: number, hp = 1000): void {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = hp;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

// Pentatonic ladder — the key clicks climb as your combo grows.
const SCALE = [0, 2, 4, 7, 9];
export function keyClick(combo: number): void {
  const step = Math.min(combo, 40);
  const semis = SCALE[step % 5] + 12 * Math.floor(step / 5 / 2);
  tone(330 * 2 ** (semis / 12), 0.06, 'triangle', 0.08);
  noise(0.02, 0.05, 3000);
}

export const miss = () => tone(140, 0.12, 'square', 0.06, 90);
export const hit = (crit: boolean) => {
  noise(0.12, crit ? 0.3 : 0.18, 400);
  tone(crit ? 220 : 160, 0.15, 'sawtooth', 0.08, 60);
};
export const kill = () => {
  noise(0.3, 0.25, 200);
  tone(520, 0.25, 'triangle', 0.1, 1040);
};
export const hurt = () => {
  noise(0.25, 0.35, 100);
  tone(90, 0.3, 'sawtooth', 0.12, 40);
};
export const coin = () => {
  tone(988, 0.06, 'square', 0.04);
  setTimeout(() => tone(1319, 0.1, 'square', 0.04), 60);
};
export const shatter = () => noise(0.35, 0.3, 4000);
export const tierUp = (tier: number) => tone(440 * 2 ** (tier / 4), 0.25, 'triangle', 0.1, 880 * 2 ** (tier / 4));
export const zap = () => tone(1800, 0.08, 'sawtooth', 0.04, 600);
export const buy = () => {
  tone(660, 0.08, 'triangle', 0.08);
  setTimeout(() => tone(990, 0.12, 'triangle', 0.08), 70);
};
