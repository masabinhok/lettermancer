/**
 * Hit effects: ink/gold sparks on a full-screen canvas, floating numbers, and screen shake.
 * All of it steps back when the player prefers reduced motion.
 */
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  kind: 'spark' | 'mote';
}

let g: CanvasRenderingContext2D | null = null;
let parts: Particle[] = [];
let running = false;
let last = 0;
let reduced = false;

export function setReducedMotion(on: boolean): void {
  reduced = on;
}

export function attachCanvas(el: HTMLCanvasElement): () => void {
  g = el.getContext('2d');
  const resize = () => {
    el.width = innerWidth * devicePixelRatio;
    el.height = innerHeight * devicePixelRatio;
    g?.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  };
  resize();
  addEventListener('resize', resize);
  return () => {
    removeEventListener('resize', resize);
    g = null;
  };
}

function frame(now: number): void {
  if (!g) {
    running = false;
    return;
  }
  const dt = Math.min(50, now - last) / 1000;
  last = now;
  g.clearRect(0, 0, innerWidth, innerHeight);
  parts = parts.filter((p) => (p.life -= dt) > 0);
  for (const p of parts) {
    if (p.kind === 'spark') p.vy += 700 * dt;
    else {
      p.vy -= 20 * dt;
      p.vx *= 0.98;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const a = p.life / p.max;
    g.globalAlpha = a;
    g.fillStyle = p.color;
    if (p.kind === 'spark') {
      // Short streaks along the velocity, like flicked ink.
      g.save();
      g.translate(p.x, p.y);
      g.rotate(Math.atan2(p.vy, p.vx));
      g.fillRect(-p.size * 1.8, -p.size / 3, p.size * 3.6, (p.size * 2) / 3);
      g.restore();
    } else {
      g.beginPath();
      g.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.globalAlpha = 1;
  if (parts.length) requestAnimationFrame(frame);
  else running = false;
}

function kick(): void {
  if (!running && g) {
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }
}

export function burst(x: number, y: number, color: string, count = 14, speed = 260): void {
  const n = reduced ? Math.ceil(count / 4) : count;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.35 + Math.random());
    const max = 0.35 + Math.random() * 0.45;
    parts.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 140,
      life: max,
      max,
      color,
      size: 1.5 + Math.random() * 2.5,
      kind: 'spark',
    });
  }
  kick();
}

/** Slow rising motes — used for boons, heals and gold. */
export function motes(x: number, y: number, color: string, count = 12): void {
  const n = reduced ? Math.ceil(count / 4) : count;
  for (let i = 0; i < n; i++) {
    const max = 0.8 + Math.random() * 0.8;
    parts.push({
      x: x + (Math.random() - 0.5) * 60,
      y: y + (Math.random() - 0.5) * 20,
      vx: (Math.random() - 0.5) * 40,
      vy: -30 - Math.random() * 50,
      life: max,
      max,
      color,
      size: 2 + Math.random() * 2,
      kind: 'mote',
    });
  }
  kick();
}

const center = (el: Element) => {
  const r = el.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2] as const;
};

export function burstAt(el: Element | null | undefined, color: string, count?: number, speed?: number): void {
  if (el) burst(...center(el), color, count, speed);
}

export function motesAt(el: Element | null | undefined, color: string, count?: number): void {
  if (el) motes(...center(el), color, count);
}

/** Floating damage/label text anchored to an element. Styled by `.float-text.<cls>` in the layout. */
export function floatText(el: Element | null | undefined, text: string, cls = ''): void {
  if (!el) return;
  const r = el.getBoundingClientRect();
  const d = document.createElement('div');
  d.className = `float-text ${cls}`;
  d.textContent = text;
  d.setAttribute('aria-hidden', 'true');
  d.style.left = `${r.left + r.width / 2 + (Math.random() * 36 - 18)}px`;
  d.style.top = `${r.top + r.height * 0.25}px`;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 1100);
}

export function shake(el: HTMLElement | null, strength: 'small' | 'big' = 'small'): void {
  if (!el || reduced) return;
  el.classList.remove('shake-small', 'shake-big');
  void el.offsetWidth;
  el.classList.add(`shake-${strength}`);
}
