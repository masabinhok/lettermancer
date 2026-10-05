<!--
  Title card before an act or a boss. The act's name types itself in, letter by letter; a boss's name
  slams down. The fight clock waits until the player is ready. The first Enter skips the animation,
  the second begins.
-->
<script lang="ts">
  import { ACT_BASE, BOSSES } from '@lettermancer/engine';
  import { onMount } from 'svelte';
  import * as sfx from '../fx/audio';
  import { shake } from '../fx/particles';
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
  /** Each act has its own light: dusk violet, desert amber, abyssal teal. */
  const ACT_COLOR = ['#9d7cf2', '#e0a458', '#4fc3c7'];
  const numeral = (n: number) => ['I', 'II', 'III'][n - 1];

  const title = $derived(boss ? boss.name : ACT_BASE[intro.act - 1].name);
  const color = $derived(boss ? '#e24b6e' : ACT_COLOR[intro.act - 1]);

  let el: HTMLElement;
  let typed = $state(0);
  let ready = $state(false);
  const timers: ReturnType<typeof setTimeout>[] = [];
  const reduced = () => document.documentElement.dataset.reducedMotion === 'true';

  function finish() {
    timers.forEach(clearTimeout);
    typed = title.length;
    ready = true;
  }

  onMount(() => {
    if (reduced()) {
      finish();
      return;
    }
    const start = boss ? 650 : 500;
    const gap = boss ? 110 : 55;
    if (boss) {
      sfx.bossCard();
      timers.push(setTimeout(() => shake(el, 'big'), 120));
    } else sfx.actCard(intro.act);
    [...title].forEach((ch, i) =>
      timers.push(
        setTimeout(
          () => {
            typed = i + 1;
            if (ch === ' ') return;
            if (boss) sfx.stamp();
            else sfx.titleTap(i);
          },
          start + i * gap,
        ),
      ),
    );
    timers.push(setTimeout(() => (ready = true), start + title.length * gap + 350));
    return () => timers.forEach(clearTimeout);
  });

  export function onKey(k: string): boolean {
    if (k !== 'Enter') return false;
    if (!ready) finish();
    else session.dismissIntro();
    return true;
  }
</script>

<div class="intro" class:boss={!!boss} class:ready data-screen="intro" bind:this={el} style:--c={color}>
  <span class="numeral" aria-hidden="true">{numeral(intro.act)}</span>
  {#if boss}
    <div class="glyph"><Initial glyph={boss.glyph} size={200} field={FIELD.boss} ink="var(--rose)" /></div>
    <p class="kicker">Act {numeral(intro.act)} · Boss</p>
  {:else}
    <p class="kicker">Act {numeral(intro.act)}</p>
  {/if}
  <h1 aria-label={title}>
    {#each [...title] as ch, i (i)}<span class="ch" class:in={i < typed} aria-hidden="true">{ch}</span>{/each}
  </h1>
  <p class="line">{boss ? boss.desc : LINES[intro.act - 1]}</p>
  <div class="go">
    <Button hotkey="Enter" onclick={() => (ready ? session.dismissIntro() : finish())}>
      {boss ? 'Face it' : 'Begin'}
    </Button>
  </div>
</div>

<style>
  .intro {
    position: relative;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    text-align: center;
    overflow: hidden;
    background:
      radial-gradient(ellipse 60% 50% at 50% 50%, color-mix(in oklab, var(--c) 22%, transparent), transparent 70%),
      radial-gradient(ellipse 120% 100% at 50% 50%, transparent 50%, rgba(0, 0, 0, 0.6));
  }
  .boss {
    animation: pulse 2.2s ease-in-out infinite;
  }
  /* The act's numeral, huge and faint, behind everything. */
  .numeral {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-family: var(--f-display);
    letter-spacing: 0.03em;
    font-weight: 700;
    font-size: min(70vh, 40vw);
    line-height: 1;
    color: transparent;
    -webkit-text-stroke: 2px color-mix(in oklab, var(--c) 30%, transparent);
    opacity: 0;
    animation: numeral 1.6s var(--ease-out) forwards;
    pointer-events: none;
  }
  .boss .numeral {
    -webkit-text-stroke-color: color-mix(in oklab, var(--c) 18%, transparent);
  }
  .glyph {
    position: relative;
    animation: slam 0.5s cubic-bezier(0.3, 1.6, 0.5, 1) both;
    filter: drop-shadow(0 0 40px color-mix(in oklab, var(--c) 60%, transparent));
  }
  .kicker {
    position: relative;
    font-family: var(--f-display);
    font-size: var(--t-lg);
    letter-spacing: 0.4em;
    text-transform: var(--ui-case);
    color: var(--c);
    animation: spread 1s var(--ease-out) both;
  }
  h1 {
    position: relative;
    font-size: clamp(3rem, 9vh, 5.5rem);
    line-height: 1.05;
    color: var(--moon);
    min-height: 1.05em;
    text-shadow: 0 0 40px color-mix(in oklab, var(--c) 45%, transparent);
  }
  .boss h1 {
    color: var(--rose);
  }
  .ch {
    display: inline-block;
    white-space: pre;
    opacity: 0;
    transform: translateY(0.3em);
    filter: blur(4px);
    transition:
      opacity 0.25s,
      transform 0.25s var(--ease-out),
      filter 0.25s;
  }
  .ch.in {
    opacity: 1;
    transform: none;
    filter: none;
  }
  .boss .ch {
    transform: scale(2.2);
    transition-duration: 0.18s;
  }
  .boss .ch.in {
    transform: none;
  }
  .line {
    position: relative;
    max-width: 46ch;
    color: var(--moon-dim);
    font-size: var(--t-lg);
    opacity: 0;
    transition: opacity 0.6s;
  }
  .go {
    position: relative;
    margin-top: var(--space-3);
    opacity: 0;
    transform: translateY(8px);
    transition:
      opacity 0.4s,
      transform 0.4s var(--ease-out);
  }
  .ready .line,
  .ready .go {
    opacity: 1;
    transform: none;
  }
  @keyframes numeral {
    from {
      opacity: 0;
      transform: scale(1.25);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
  @keyframes spread {
    from {
      opacity: 0;
      letter-spacing: 1.2em;
    }
  }
  @keyframes slam {
    from {
      opacity: 0;
      transform: scale(2.6);
    }
  }
  @keyframes pulse {
    50% {
      box-shadow: inset 0 0 160px rgba(226, 75, 110, 0.35);
    }
  }

  /* Typography roles (see app.css): boon names, titles and speakers get their own faces. */
  h1 {
    font-family: var(--f-title);
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0.01em;
  }
  .numeral {
    font-family: var(--f-title);
  }
</style>
