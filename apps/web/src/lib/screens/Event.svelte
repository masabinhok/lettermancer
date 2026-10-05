<script lang="ts">
  import { EVENTS, MODS, MUSES } from '@lettermancer/engine';
  import { onMount } from 'svelte';
  import * as sfx from '../fx/audio';
  import { burstAt } from '../fx/particles';
  import type { Session } from '../game/session.svelte';
  import Button from '../ui/Button.svelte';
  import Frame from '../ui/Frame.svelte';
  import Emblem from '../ui/Emblem.svelte';
  import Hud from '../ui/Hud.svelte';

  let { session, onbuild }: { session: Session; onbuild?: () => void } = $props();
  const v = $derived(session.view.kind === 'event' ? session.view : null);
  const run = $derived(session.run);
  const def = $derived(v ? EVENTS[v.id] : null);

  /** Each event's medallion: what you'd see on the table when you walk in. */
  const LOOK: Record<string, { glyph: string; color: string }> = {
    'cursed-folio': { glyph: '✒', color: '#e24b6e' },
    inkwell: { glyph: '◉', color: '#4fc3c7' },
    gambler: { glyph: '⚄', color: '#e9c46a' },
    rest: { glyph: '☾', color: '#7fe0b0' },
    trial: { glyph: '⧗', color: '#f4dc6b' },
  };
  const look = $derived.by(() => {
    if (v?.id === 'shrine' && v.muse) return { glyph: MODS[MUSES[v.muse].mod].glyph, color: MUSES[v.muse].color };
    return LOOK[v?.id ?? ''] ?? { glyph: '?', color: '#b79cf2' };
  });

  let emblemEl = $state<HTMLElement>();

  onMount(() => {
    sfx.doorReveal(1);
    const n = v?.options.length ?? 0;
    const timers = Array.from({ length: n }, (_, i) => setTimeout(() => sfx.cardIn(i), 350 + i * 140));
    return () => timers.forEach(clearTimeout);
  });

  function choose(i: number) {
    if (session.option(i)) {
      sfx.take(1);
      burstAt(emblemEl, look.color, 40, 360);
    } else sfx.miss();
  }

  export function onKey(k: string): boolean {
    if (!v) return false;
    if (v.outcome !== null) {
      if (k === 'Enter') {
        session.leave();
        return true;
      }
      return false;
    }
    const i = Number(k) - 1;
    if (i >= 0 && i < v.options.length) {
      choose(i);
      return true;
    }
    return false;
  }
</script>

{#if v && def}
  <div class="screen" data-screen="event">
    <Hud hp={run.hp} maxHp={run.maxHp} coins={run.coins} act={run.act} room={run.room} relics={run.relics} {onbuild} />
    <div class="body">
      <Frame ornate>
        <div class="inner" style:--c={look.color}>
          <span class="emblem-wrap" bind:this={emblemEl}>
            <Emblem glyph={look.glyph} color={look.color} tier={2} size="7.5rem" bob />
          </span>
          <h1>{def.title}</h1>
          <p class="text">
            {def.text.replace('{muse}', v.muse ? `${MUSES[v.muse].name}, ${MUSES[v.muse].title}` : 'a muse')}
          </p>
          {#if v.outcome !== null}
            <p class="outcome">{v.outcome}</p>
            <Button hotkey="Enter" onclick={() => session.leave()}>Continue</Button>
          {:else}
            <div class="options">
              {#each v.options as o, i (i)}
                <button
                  class="option"
                  style:--i={i}
                  disabled={!o.enabled}
                  onclick={() => choose(i)}
                  onmouseenter={() => o.enabled && sfx.chime(i)}
                  type="button"
                >
                  <kbd>{i + 1}</kbd>
                  <span class="label">{o.label}</span>
                  <span class="detail">{o.detail}{o.enabled ? '' : ' (you can’t right now)'}</span>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </Frame>
    </div>
  </div>
{/if}

<style>
  .screen {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-4) var(--space-5);
  }
  .body {
    flex: 1;
    display: grid;
    place-items: center;
  }
  .inner {
    width: min(42rem, 90vw);
    padding: var(--space-5) var(--space-6) var(--space-6);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
    text-align: center;
  }
  .emblem-wrap {
    margin-top: calc(-1 * var(--space-2));
    animation: arrive 0.6s var(--ease-out);
  }
  h1 {
    font-size: var(--t-3xl);
    line-height: 1.05;
    color: var(--c);
    text-shadow: 0 0 30px color-mix(in oklab, var(--c) 45%, transparent);
  }
  .text {
    color: var(--moon);
    font-size: var(--t-lg);
    line-height: 1.5;
  }
  .outcome {
    color: var(--witchfire);
    font-size: var(--t-xl);
    font-style: italic;
    animation: arrive 0.5s var(--ease-out);
  }
  .options {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .option {
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-rows: auto auto;
    column-gap: var(--space-3);
    text-align: left;
    padding: var(--space-3) var(--space-4);
    background: var(--ink);
    border: 1px solid var(--rule);
    border-left: 3px solid color-mix(in oklab, var(--c) 70%, var(--rule));
    cursor: pointer;
    transition:
      border-color var(--dur),
      transform var(--dur) var(--ease-out),
      box-shadow var(--dur);
    animation: slide 0.45s var(--ease-out) both;
    animation-delay: calc(350ms + var(--i) * 140ms);
  }
  .option:hover:not(:disabled),
  .option:focus-visible {
    border-color: var(--c);
    transform: translateX(6px);
    box-shadow: 0 10px 40px -14px color-mix(in oklab, var(--c) 70%, transparent);
  }
  .option:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .option kbd {
    grid-row: span 2;
    align-self: center;
  }
  .label {
    font-family: var(--f-display);
    text-transform: var(--ui-case);
    letter-spacing: var(--ui-tracking);
    font-weight: 700;
    font-size: var(--t-lg);
    color: var(--moon);
  }
  .detail {
    font-size: var(--t-md);
    color: var(--moon-dim);
  }
  @keyframes slide {
    from {
      opacity: 0;
      transform: translateX(40px);
    }
  }
  @keyframes arrive {
    from {
      opacity: 0;
      transform: scale(0.85);
      filter: blur(6px);
    }
  }
</style>
