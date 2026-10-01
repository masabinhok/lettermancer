<script lang="ts">
  import { EVENTS, MUSES } from '@lettermancer/engine';
  import * as sfx from '../fx/audio';
  import type { Session } from '../game/session.svelte';
  import Button from '../ui/Button.svelte';
  import Frame from '../ui/Frame.svelte';
  import Hud from '../ui/Hud.svelte';

  let { session, onbuild }: { session: Session; onbuild?: () => void } = $props();
  const v = $derived(session.view.kind === 'event' ? session.view : null);
  const run = $derived(session.run);
  const def = $derived(v ? EVENTS[v.id] : null);

  function choose(i: number) {
    if (session.option(i)) sfx.select();
    else sfx.miss();
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
        <div class="inner">
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
                <button class="option" disabled={!o.enabled} onclick={() => choose(i)} type="button">
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
    width: min(620px, 90vw);
    padding: var(--space-6);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
    text-align: center;
  }
  h1 {
    font-size: var(--t-2xl);
    color: var(--gold-bright);
  }
  .text {
    color: var(--moon);
    font-size: var(--t-lg);
    line-height: 1.5;
  }
  .outcome {
    color: var(--witchfire);
    font-size: var(--t-lg);
    font-style: italic;
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
    cursor: pointer;
    transition: border-color var(--dur);
  }
  .option:hover:not(:disabled),
  .option:focus-visible {
    border-color: var(--gold);
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
    font-weight: 700;
    color: var(--moon);
  }
  .detail {
    font-size: var(--t-sm);
    color: var(--moon-dim);
  }
</style>
