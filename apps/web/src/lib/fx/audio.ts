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

/** Filtered noise whose pitch sweeps from one frequency to another: whooshes and swishes. */
function sweep(dur: number, gain: number, from: number, to: number, q = 1.4, delay = 0): void {
  const a = ac();
  if (!a || volumes.volume === 0) return;
  const t = a.currentTime + delay;
  const len = Math.ceil(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = q;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.35);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(sfxBus);
  src.start(t);
  src.stop(t + dur + 0.05);
}

// ---------- doors and boons (the big choice moments) ----------

/** A door rises out of the dark: a deep thump and a rising shimmer, higher for each door. */
export const doorReveal = (i: number) => {
  tone(70, 0.45, 'sine', 0.16, { slideTo: 42 });
  noise(0.25, 0.12, 'lowpass', 380);
  tone(note(294, 5 + i * 2), 0.6, 'triangle', 0.035, { delay: 0.08, attack: 0.12 });
};

/** Hovering a door or plaque: a soft bell, pitched by position. */
export const chime = (i: number) => {
  tone(note(587, i * 2), 0.5, 'sine', 0.045, { attack: 0.01 });
  tone(note(587, i * 2) * 2, 0.3, 'sine', 0.015, { attack: 0.01 });
};

/** Stepping through a door: a rushing whoosh under a rising chord. */
export const portal = () => {
  sweep(0.75, 0.32, 180, 3200);
  tone(55, 0.8, 'sawtooth', 0.05, { slideTo: 110, attack: 0.1 });
  [0, 2, 4, 7].forEach((s, i) => tone(note(294, s), 0.9, 'triangle', 0.045, { delay: 0.18 + i * 0.05, attack: 0.05 }));
};

/** A muse arrives: a slow choir-like pad, each muse on her own root. */
export const museArrive = (root: number) => {
  const base = note(147, root);
  for (const [ratio, detune] of [
    [1, 0],
    [1.5, 0.003],
    [2, -0.004],
    [2.52, 0.002],
  ])
    for (const d of [1 - detune, 1 + detune])
      tone(base * ratio * d, 1.9, 'triangle', 0.022, { attack: 0.45, bus: sfxBus });
  sweep(1.2, 0.08, 6000, 1200, 0.8);
};

/** A plaque slides in: a paper swish and a plucked note. */
export const cardIn = (i: number) => {
  sweep(0.22, 0.12, 1800, 5200, 0.9);
  tone(note(392, i * 2), 0.35, 'triangle', 0.04, { delay: 0.05 });
};

/** Taking a boon: a chord that grows with rarity, then a sparkle. */
export const take = (rarity: number) => {
  noise(0.3, 0.18, 'bandpass', 1400, 0.9);
  const steps = [0, 2, 4, 5, 7, 9, 10].slice(0, 3 + rarity);
  steps.forEach((s, i) => tone(note(294, s), 0.9, 'sine', 0.05, { delay: i * 0.05, attack: 0.02 }));
  [12, 14, 16].forEach((s, i) => tone(note(294, s), 0.25, 'sine', 0.025, { delay: 0.25 + i * 0.06 }));
  if (rarity >= 2) tone(note(147, 0), 1.1, 'sawtooth', 0.035, { attack: 0.05 });
};

// ---------- act and boss title cards ----------

/** A new act: a deep gong under a slow, rising chord. */
export const actCard = (act: number) => {
  tone(55 * 2 ** (((act - 1) * 2) / 12), 2.4, 'sine', 0.2, { attack: 0.01 });
  tone(110 * 2 ** (((act - 1) * 2) / 12) * 1.01, 1.8, 'triangle', 0.05, { attack: 0.01 });
  noise(0.5, 0.1, 'lowpass', 900);
  [0, 2, 4].forEach((s, i) => tone(note(147, s + act), 2.2, 'triangle', 0.03, { delay: 0.4 + i * 0.25, attack: 0.5 }));
};

/** One letter of a title being set down: a soft quill tap. */
export const titleTap = (i: number) => {
  noise(0.03, 0.08, 'highpass', 3600);
  tone(note(587, i % 5), 0.12, 'triangle', 0.02);
};

/** A boss arrives: a low brass hit, then a slow heartbeat. */
export const bossCard = () => {
  tone(41, 1.4, 'sawtooth', 0.12, { slideTo: 33 });
  tone(82, 1.0, 'square', 0.04, { slideTo: 65 });
  noise(0.8, 0.3, 'lowpass', 500);
  for (const at of [0.9, 1.15, 1.9, 2.15]) tone(55, 0.18, 'sine', 0.22, { delay: at, slideTo: 40 });
};

/** A boss title letter slamming down. */
export const stamp = () => {
  noise(0.08, 0.2, 'lowpass', 700);
  tone(70, 0.12, 'sine', 0.12, { slideTo: 45 });
};

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
