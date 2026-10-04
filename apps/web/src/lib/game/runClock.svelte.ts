/**
 * How long the current run has been played: active time only (paused or unfocused time doesn't
 * count). The session advances it; the HUD shows it. Kept apart from the engine on purpose: it is a
 * personal stopwatch, not part of the deterministic run or its verification.
 */
export const runClock = $state({ ms: 0, running: false });

/** 1:05:09 or 18:42 */
export function formatRunTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
