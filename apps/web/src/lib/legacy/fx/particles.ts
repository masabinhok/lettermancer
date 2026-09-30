/** Full-screen canvas for hit sparks. Only animates while particles are alive. */
interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

const canvas = document.getElementById('fx') as HTMLCanvasElement;
const g = canvas.getContext('2d')!;
let parts: P[] = [];
let running = false;

function resize() {
  canvas.width = innerWidth * devicePixelRatio;
  canvas.height = innerHeight * devicePixelRatio;
  g.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}
resize();
addEventListener('resize', resize);

let last = 0;
function frame(now: number) {
  const dt = Math.min(50, now - last) / 1000;
  last = now;
  g.clearRect(0, 0, innerWidth, innerHeight);
  parts = parts.filter((p) => (p.life -= dt) > 0);
  for (const p of parts) {
    p.vy += 600 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    g.globalAlpha = p.life / p.max;
    g.fillStyle = p.color;
    g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  g.globalAlpha = 1;
  if (parts.length) requestAnimationFrame(frame);
  else running = false;
}

export function burst(x: number, y: number, color: string, count = 14, speed = 260): void {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random());
    const max = 0.4 + Math.random() * 0.5;
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, life: max, max, color, size: 2 + Math.random() * 4 });
  }
  if (!running) {
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }
}

export function burstAt(el: Element | null | undefined, color: string, count?: number, speed?: number): void {
  if (!el) return;
  const r = el.getBoundingClientRect();
  burst(r.left + r.width / 2, r.top + r.height / 2, color, count, speed);
}

/** Floating damage/label text anchored to an element. */
export function floatText(el: Element | null | undefined, text: string, cls = ''): void {
  if (!el) return;
  const r = el.getBoundingClientRect();
  const d = document.createElement('div');
  d.className = `float-text ${cls}`;
  d.textContent = text;
  d.style.left = `${r.left + r.width / 2 + (Math.random() * 40 - 20)}px`;
  d.style.top = `${r.top + r.height * 0.3}px`;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 1000);
}

export function shake(strength: 'small' | 'big' = 'small'): void {
  const app = document.getElementById('app')!;
  app.classList.remove('shake-small', 'shake-big');
  void app.offsetWidth;
  app.classList.add(`shake-${strength}`);
}
