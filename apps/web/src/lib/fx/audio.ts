/**
 * Synthesized sound — no audio files, so everything stays open-source clean.
 * Three buses (master → sfx, music) with player-controlled volumes.
 * The music is a quiet generative drone + arpeggio that climbs with your combo tier.
 */
let ctx: AudioContext | null = null;
let master: GainNode;
let sfxBus: GainNode;
let musicBus: GainNode;
const volumes = { volume: 0.8, sfx: 1, music: 0.6 };

function ac(): AudioContext | null {
  try {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      sfxBus = ctx.createGain();
      musicBus = ctx.createGain();
      sfxBus.connect(master);
      musicBus.connect(master);
      master.connect(ctx.destination);
      applyVolumes();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function applyVolumes(): void {
  if (!ctx) return;
  master.gain.value = volumes.volume;
  sfxBus.gain.value = volumes.sfx;
  musicBus.gain.value = volumes.music * 0.35;
}

export function setVolumes(v: { volume: number; sfx: number; music: number }): void {
  Object.assign(volumes, v);
  applyVolumes();
}

function tone(
  freq: number,
  dur: number,
  type: OscillatorType,
  gain: number,
  opts: { slideTo?: number; delay?: number; attack?: number; bus?: AudioNode } = {},
): void {
  const a = ac();
  if (!a || volumes.volume === 0) return;
  const t = a.currentTime + (opts.delay ?? 0);
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (opts.slideTo) o.frequency.exponentialRampToValueAtTime(opts.slideTo, t + dur);
  const attack = opts.attack ?? 0.004;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(opts.bus ?? sfxBus);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur: number, gain: number, filter: BiquadFilterType, freq: number, q = 0.7): void {
  const a = ac();
  if (!a || volumes.volume === 0) return;
  const t = a.currentTime;
  const len = Math.ceil(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = filter;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(sfxBus);
  src.start(t);
}

// D dorian-ish pentatonic — slightly modal, fits the night-scriptorium mood.
const SCALE = [0, 2, 3, 7, 9];
const note = (base: number, step: number) => base * 2 ** ((SCALE[step % 5] + 12 * Math.floor(step / 5)) / 12);

/** Quill-on-vellum tick; pitch climbs with combo. */
export function keyClick(combo: number): void {
  noise(0.025, 0.12, 'highpass', 4200);
  tone(note(294, Math.min(combo, 24) % 15), 0.07, 'triangle', 0.045);
}

export const miss = () => {
  tone(155, 0.14, 'square', 0.04, { slideTo: 110 });
  noise(0.06, 0.08, 'lowpass', 600);
};

export const hit = (crit: boolean) => {
  noise(0.16, crit ? 0.38 : 0.22, 'bandpass', crit ? 900 : 600, 1.2);
  tone(crit ? 196 : 147, 0.2, 'sawtooth', 0.06, { slideTo: 55 });
  if (crit) tone(587, 0.35, 'triangle', 0.06, { delay: 0.03 });
};

export const kill = () => {
  noise(0.35, 0.25, 'lowpass', 1800);
  [0, 2, 4].forEach((s, i) => tone(note(392, s), 0.4, 'triangle', 0.07, { delay: i * 0.05 }));
};

export const hurt = () => {
  noise(0.3, 0.4, 'lowpass', 300);
  tone(82, 0.35, 'sawtooth', 0.12, { slideTo: 41 });
};

export const coin = () => {
  tone(1175, 0.08, 'sine', 0.05);
  tone(1568, 0.14, 'sine', 0.05, { delay: 0.06 });
};

export const shatter = () => {
  noise(0.4, 0.35, 'highpass', 5000);
  [2637, 3136, 3520].forEach((f, i) => tone(f, 0.18, 'sine', 0.03, { delay: i * 0.03 }));
};

export const tierUp = (tier: number) => {
  [0, 1, 2, 3].forEach((s, i) =>
    tone(note(294 * 2 ** (tier / 3), s + tier), 0.3, 'triangle', 0.06, { delay: i * 0.045 }),
  );
};

export const zap = () => tone(2200, 0.09, 'sawtooth', 0.035, { slideTo: 500 });

export const boon = () => {
  [0, 2, 4, 5, 7].forEach((s, i) => tone(note(392, s), 0.5, 'sine', 0.05, { delay: i * 0.06, attack: 0.02 }));
};

export const select = () => tone(660, 0.06, 'triangle', 0.04);

export const windup = () => tone(220, 0.25, 'sine', 0.035, { slideTo: 330, attack: 0.08 });

// ---------- music ----------

let musicTimer: ReturnType<typeof setInterval> | null = null;
let drone: { stop(): void } | null = null;
let intensity = 0;
let step = 0;

/** 0 (calm) .. 4 (max combo) — the arpeggio thickens and quickens. */
export function setIntensity(level: number): void {
  intensity = Math.max(0, Math.min(4, level));
}

export function startMusic(): void {
  const a = ac();
  if (!a || musicTimer) return;
  const oscs = [73.4, 110, 146.8].map((f, i) => {
    const o = a.createOscillator();
    o.type = i === 0 ? 'sine' : 'sawtooth';
    o.frequency.value = f;
    o.detune.value = (i - 1) * 7;
    return o;
  });
  const lp = a.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 420;
  const g = a.createGain();
  g.gain.value = 0.0001;
  g.gain.exponentialRampToValueAtTime(0.18, a.currentTime + 3);
  oscs.forEach((o) => o.connect(lp));
  lp.connect(g).connect(musicBus);
  oscs.forEach((o) => o.start());
  drone = {
    stop() {
      g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 1.2);
      oscs.forEach((o) => o.stop(a.currentTime + 1.3));
    },
  };
  const pattern = [0, 2, 4, 3, 5, 4, 2, 1];
  musicTimer = setInterval(() => {
    step++;
    const every = [4, 3, 2, 1, 1][intensity];
    if (step % every !== 0) return;
    const s = pattern[step % pattern.length] + (intensity >= 3 ? 5 : 0);
    tone(note(293.7, s), 0.9, 'triangle', 0.05 + intensity * 0.012, { bus: musicBus, attack: 0.03 });
    if (intensity >= 2 && step % 4 === 0) tone(note(146.8, s), 1.2, 'sine', 0.05, { bus: musicBus, attack: 0.05 });
  }, 150);
}

export function stopMusic(): void {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
  drone?.stop();
  drone = null;
}
