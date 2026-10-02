/**
 * Combat impact: the visual weight of a hit. Everything here is cosmetic. The game clock keeps running,
 * so typing, timing and replays are untouched; only what you see pauses or flares for a moment.
 */
import { isReduced } from './particles';

/** Freeze the field's animations for a beat and nudge it, so a big hit lands. */
export function hitStop(stage: HTMLElement | null | undefined, ms: number): void {
  if (!stage || isReduced()) return;
  stage.classList.add('hitstop');
  setTimeout(() => stage.classList.remove('hitstop'), ms);
  stage
    .querySelector('.field')
    ?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.012)' }, { transform: 'scale(1)' }], {
      duration: ms + 120,
      easing: 'cubic-bezier(.2,.8,.2,1)',
    });
}

/** The struck card flashes bright and jolts back. */
export function punch(el: Element | null | undefined, strong: boolean): void {
  if (!el || isReduced()) return;
  el.animate(
    [
      {
        filter: `brightness(${strong ? 2.4 : 1.7}) saturate(1.3)`,
        transform: `scale(${strong ? 1.08 : 1.04}) translateX(6px)`,
      },
      { filter: 'brightness(1)', transform: 'scale(1) translateX(0)' },
    ],
    { duration: strong ? 320 : 220, easing: 'cubic-bezier(.2,.8,.2,1)' },
  );
}

/** A streak of light across the word, in the color of the power that struck. */
export function slash(el: Element | null | undefined, color: string, strong: boolean): void {
  if (!el || isReduced()) return;
  const r = el.getBoundingClientRect();
  const s = document.createElement('div');
  s.className = 'fx-slash';
  s.setAttribute('aria-hidden', 'true');
  const w = Math.max(r.width * 1.3, 160);
  Object.assign(s.style, {
    left: `${r.left + r.width / 2 - w / 2}px`,
    top: `${r.top + r.height / 2}px`,
    width: `${w}px`,
    height: strong ? '6px' : '4px',
  });
  s.style.setProperty('--c', color);
  s.style.setProperty('--tilt', `${-14 + Math.random() * 8}deg`);
  document.body.appendChild(s);
  setTimeout(() => s.remove(), 420);
}

/** A defeated foe's card bursts apart: a bright copy swells and fades, and a ring of light spreads out. */
export function shatter(el: Element | null | undefined, color: string, big: boolean): void {
  if (!el || isReduced()) return;
  const r = el.getBoundingClientRect();
  const ghost = el.cloneNode(true) as HTMLElement;
  // Only a picture of the card: strip the markers that say which foe and letter are live.
  ghost.removeAttribute('data-enemy');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.inert = true;
  ghost.classList.remove('targeted');
  ghost.classList.add('fx-ghost');
  for (const n of ghost.querySelectorAll('.next')) n.classList.remove('next');
  Object.assign(ghost.style, {
    position: 'fixed',
    left: `${r.left}px`,
    top: `${r.top}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
    margin: '0',
    zIndex: '80',
    pointerEvents: 'none',
  });
  document.body.appendChild(ghost);
  ghost
    .animate(
      [
        { opacity: 1, transform: 'scale(1)', filter: 'brightness(2.5)' },
        {
          opacity: 0,
          transform: `scale(${big ? 1.35 : 1.18}) rotate(${Math.random() > 0.5 ? 3 : -3}deg)`,
          filter: 'brightness(1.4) blur(6px)',
        },
      ],
      { duration: big ? 700 : 480, easing: 'cubic-bezier(.2,.7,.3,1)' },
    )
    .finished.then(
      () => ghost.remove(),
      () => ghost.remove(),
    );

  const ring = document.createElement('div');
  ring.className = 'fx-ring';
  ring.setAttribute('aria-hidden', 'true');
  const size = Math.max(r.width, r.height);
  Object.assign(ring.style, {
    left: `${r.left + r.width / 2 - size / 2}px`,
    top: `${r.top + r.height / 2 - size / 2}px`,
    width: `${size}px`,
    height: `${size}px`,
  });
  ring.style.setProperty('--c', color);
  document.body.appendChild(ring);
  setTimeout(() => ring.remove(), 700);
}

/** A banner that sweeps across the field: combo tiers, waves, a boss changing. */
export function banner(stage: HTMLElement | null | undefined, text: string, sub: string, color: string): void {
  if (!stage) return;
  const b = document.createElement('div');
  b.className = 'fx-banner';
  b.setAttribute('aria-hidden', 'true');
  b.style.setProperty('--c', color);
  const big = document.createElement('strong');
  big.textContent = text;
  b.appendChild(big);
  if (sub) {
    const small = document.createElement('span');
    small.textContent = sub;
    b.appendChild(small);
  }
  // Never cover a word you're typing: sit in the widest empty band, above or below the foes.
  const st = stage.getBoundingClientRect();
  const foes = [...stage.querySelectorAll('.enemy')].map((e) => e.getBoundingClientRect());
  const hud = stage.querySelector('.hud')?.getBoundingClientRect();
  const combo = stage.querySelector('.combo')?.getBoundingClientRect();
  if (foes.length && combo) {
    const top = Math.min(...foes.map((r) => r.top));
    const bottom = Math.max(...foes.map((r) => r.bottom));
    const above = [hud?.bottom ?? st.top, top];
    const below = [bottom, combo.top];
    const [a, z] = below[1] - below[0] >= above[1] - above[0] ? below : above;
    b.style.top = `${(a + z) / 2 - st.top}px`;
    stage.appendChild(b);
    // Shrink to fit a tight gap (small windows).
    const room = z - a - 6;
    const h = b.getBoundingClientRect().height;
    if (h > room) b.style.scale = String(Math.max(0.65, room / h));
  } else stage.appendChild(b);
  setTimeout(() => b.remove(), isReduced() ? 900 : 1300);
}
