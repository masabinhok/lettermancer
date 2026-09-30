<!-- Title card before an act or a boss. The fight clock waits until the player is ready. -->
<script lang="ts">
  import { ACT_BASE, BOSSES } from '@keycraft/engine';
  import { FIELD } from '../game/look';
  import type { Session } from '../game/session.svelte';
  import Button from '../ui/Button.svelte';
  import Initial from '../ui/Initial.svelte';

  let { session }: { session: Session } = $props();
  const intro = $derived(session.intro!);
  const boss = $derived(intro.kind === 'boss' ? BOSSES[session.machine.run.bosses[intro.act - 1]] : null);

  const LINES = [
    'Short words and slow foes. Find your rhythm, and choose your muses.',
    'Longer words, armored hides, and foes that steal your combo.',
    'The deepest ink. Wardens, shifters and swarms. Every typo costs.',
  ];
  const numeral = (n: number) => ['I', 'II', 'III'][n - 1];

  let ready = $state(false);
  $effect(() => {
    const t = setTimeout(() => (ready = true), 300);
    return () => clearTimeout(t);
  });

  export function onKey(k: string): boolean {
    if (k === 'Enter' && ready) {
      session.dismissIntro();
      return true;
    }
    return false;
  }
</script>

<div class="intro" data-screen="intro">
  {#if boss}
    <Initial glyph={boss.glyph} size={180} field={FIELD.boss} ink="var(--rose)" />
    <p class="kicker">Act {numeral(intro.act)} boss</p>
    <h1>{boss.name}</h1>
    <p class="line">{boss.desc}</p>
  {:else}
    <p class="kicker">Act {numeral(intro.act)}</p>
    <h1>{ACT_BASE[intro.act - 1].name}</h1>
    <p class="line">{LINES[intro.act - 1]}</p>
  {/if}
  <Button hotkey="Enter" onclick={() => session.dismissIntro()}>Begin</Button>
</div>

<style>
  .intro {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-4);
    text-align: center;
    animation: rise 0.9s var(--ease-out);
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(12px);
      filter: blur(6px);
    }
  }
  .kicker {
    font-family: var(--f-display);
    color: var(--gold);
    font-size: var(--t-lg);
    margin-top: var(--space-4);
  }
  h1 {
    font-size: var(--t-hero);
    color: var(--moon);
  }
  .line {
    color: var(--moon-dim);
    font-size: var(--t-lg);
    margin-bottom: var(--space-4);
  }
</style>
