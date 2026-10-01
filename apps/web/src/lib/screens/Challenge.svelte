<!-- A typing challenge inside an event: copy the text exactly, sometimes against the clock. -->
<script lang="ts">
  import type { MachineEvent } from '@lettermancer/engine';
  import { onMount } from 'svelte';
  import * as sfx from '../fx/audio';
  import { shake } from '../fx/particles';
  import type { Session } from '../game/session.svelte';
  import Bar from '../ui/Bar.svelte';
  import Hud from '../ui/Hud.svelte';

  let { session }: { session: Session } = $props();
  const v = $derived(session.view.kind === 'challenge' ? session.view : null);
  const run = $derived(session.run);
  let root = $state<HTMLElement>();

  const left = $derived(
    v?.limitMs != null ? Math.max(0, v.limitMs - (v.startedAt === null ? 0 : v.time - v.startedAt)) : null,
  );

  onMount(() =>
    session.on((ev: MachineEvent) => {
      if (ev.t === 'challenge-key') {
        if (ev.ok) sfx.keyClick(v?.typed.length ?? 0);
        else {
          sfx.miss();
          if (v?.purpose === 'folio') shake(root ?? null, 'small');
        }
      } else if (ev.t === 'challenge-end') {
        if (ev.won) sfx.boon();
        else sfx.hurt();
      }
    }),
  );
</script>

{#if v}
  <div class="screen" data-screen="challenge" bind:this={root}>
    <Hud hp={run.hp} maxHp={run.maxHp} coins={run.coins} act={run.act} room={run.room} relics={run.relics} />
    <div class="body">
      <h1>{v.purpose === 'folio' ? 'Transcribe the curse' : 'Beat the sand'}</h1>
      <p class="how">
        {#if v.purpose === 'folio'}Every typo costs 2 health. Take your time.{:else}The glass turns when you type the
          first letter.{/if}
      </p>
      <p class="text" aria-label={v.text}>
        {#each [...v.text] as ch, i (i)}<span
            class:done={i < v.typed.length}
            class:next={i === v.typed.length}
            class:space={ch === ' '}>{ch === ' ' ? '␣' : ch}</span
          >{/each}
      </p>
      {#if left !== null}
        <div class="timer">
          <Bar value={left} max={v.limitMs!} tone={left < 2000 ? 'danger' : 'threat'} height={8} />
          <span>{(left / 1000).toFixed(1)}s</span>
        </div>
      {/if}
      <p class="errors">{v.errors} typo{v.errors === 1 ? '' : 's'}</p>
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
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-4);
    max-width: 1000px;
  }
  h1 {
    font-size: var(--t-2xl);
    color: var(--gold-bright);
  }
  .how {
    color: var(--moon-dim);
  }
  .text {
    font-family: var(--f-type);
    font-size: 2.1rem;
    line-height: 1.5;
    text-align: center;
    margin: var(--space-4) 0;
    color: var(--moon);
  }
  .text span {
    position: relative;
  }
  .done {
    opacity: 0.45;
  }
  .space {
    color: var(--moon-faint);
  }
  .next {
    border-bottom: 3px solid var(--gold-bright);
  }
  .timer {
    width: 360px;
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  .timer span {
    width: 3.5em;
    font-weight: 700;
  }
  .errors {
    color: var(--moon-faint);
    font-size: var(--t-sm);
  }
</style>
