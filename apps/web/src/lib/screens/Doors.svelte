<!--
  Choose the next room. The doors rise out of the dark one by one, each showing what waits behind it.
  The first press looks closer at a door; the second (or Enter) steps through.
-->
<script lang="ts">
  import { BLESSINGS, MODS, MUSES, ROOMS_PER_ACT, type Door } from '@lettermancer/engine';
  import { onMount } from 'svelte';
  import * as sfx from '../fx/audio';
  import { burstAt } from '../fx/particles';
  import type { Session } from '../game/session.svelte';
  import Emblem from '../ui/Emblem.svelte';
  import Hud from '../ui/Hud.svelte';

  let { session, onbuild }: { session: Session; onbuild?: () => void } = $props();
  const v = $derived(session.view.kind === 'doors' ? session.view : null);
  const run = $derived(session.run);

  const REVEAL_GAP = 260;
  const reduced = () => document.documentElement.dataset.reducedMotion === 'true';

  let shown = $state(0);
  let ready = $state(false);
  let picked = $state<number | null>(null);
  let entering = $state<number | null>(null);
  let doorEls = $state<HTMLElement[]>([]);

  interface Info {
    kind: string;
    title: string;
    line: string;
    more: string;
    glyph: string;
    color: string;
    tier: number;
  }

  function describe(d: Door): Info {
    if (d.node === 'shop')
      return {
        kind: 'Rest stop',
        title: 'Shop',
        line: 'Spend your coins.',
        more: 'Buy key powers, relics and healing. No fight.',
        glyph: '⚖',
        color: '#e9c46a',
        tier: 1,
      };
    if (d.node === 'event')
      return {
        kind: 'Event',
        title: 'Unknown',
        line: 'Something waits here.',
        more: 'A choice, a bargain, sometimes a typing challenge. Never a normal fight.',
        glyph: '?',
        color: '#b79cf2',
        tier: 1,
      };
    if (d.node === 'elite')
      return {
        kind: 'Elite fight',
        title: 'Elite',
        line: 'A dangerous foe.',
        more: 'A much harder fight. Win it and take a relic.',
        glyph: '◆',
        color: '#e24b6e',
        tier: 3,
      };
    const r = d.reward;
    if (r?.kind === 'muse') {
      const m = MUSES[r.muse];
      const gifts = Object.values(BLESSINGS)
        .filter((b) => b.muses.length === 1 && b.muses[0] === r.muse)
        .map((b) => b.name);
      return {
        kind: 'Fight',
        title: m.name,
        line: `${m.title}.`,
        more: `Win and she offers a boon: ${MODS[m.mod].name} for your keys, or blessings like ${gifts.join(', ')}.`,
        glyph: MODS[m.mod].glyph,
        color: m.color,
        tier: 2,
      };
    }
    if (r?.kind === 'coins')
      return {
        kind: 'Fight',
        title: 'Purse',
        line: 'A heavy purse.',
        more: 'Win the fight for a big pile of coins.',
        glyph: '●',
        color: '#e9c46a',
        tier: 0,
      };
    if (r?.kind === 'heal')
      return {
        kind: 'Fight',
        title: 'Spring',
        line: 'Rest after.',
        more: 'Win the fight, then heal 35% of your health.',
        glyph: '✚',
        color: '#7fe0b0',
        tier: 0,
      };
    return { kind: 'Fight', title: 'Fight', line: '', more: 'A fight.', glyph: '⚔', color: '#ddd7ea', tier: 0 };
  }

  const infos = $derived(v ? v.doors.map(describe) : []);

  onMount(() => {
    const n = v?.doors.length ?? 0;
    if (reduced()) {
      shown = n;
      ready = true;
      return;
    }
    const timers = Array.from({ length: n }, (_, i) =>
      setTimeout(
        () => {
          shown = i + 1;
          sfx.doorReveal(i);
        },
        200 + i * REVEAL_GAP,
      ),
    );
    timers.push(setTimeout(() => (ready = true), 200 + n * REVEAL_GAP + 150));
    return () => timers.forEach(clearTimeout);
  });

  function look(i: number) {
    if (!ready || entering !== null || picked === i) return;
    picked = i;
    sfx.chime(i);
  }

  function enter(i: number) {
    if (!ready || entering !== null) return;
    entering = i;
    picked = i;
    sfx.portal();
    burstAt(doorEls[i]?.querySelector('.emblem'), infos[i].color, 40, 420);
    setTimeout(() => session.door(i), reduced() ? 120 : 720);
  }

  function press(i: number) {
    if (picked === i) enter(i);
    else look(i);
  }

  export function onKey(k: string): boolean {
    if (!v) return false;
    // Keys pressed while the doors are still rising are swallowed, so nobody walks through one blind.
    if (!ready || entering !== null) return /^[1-9]$/.test(k) || k === 'Enter';
    if (k === 'Enter' && picked !== null) {
      enter(picked);
      return true;
    }
    const i = Number(k) - 1;
    if (i >= 0 && i < v.doors.length) {
      press(i);
      return true;
    }
    return false;
  }
</script>

{#if v}
  <div class="screen" data-screen="doors" class:entering={entering !== null}>
    <Hud hp={run.hp} maxHp={run.maxHp} coins={run.coins} act={run.act} room={run.room} relics={run.relics} {onbuild} />
    <div class="body">
      <header>
        <h1>Choose your path</h1>
        <p>
          {ROOMS_PER_ACT - run.room} room{ROOMS_PER_ACT - run.room === 1 ? '' : 's'} before the boss.
          {#if run.room === ROOMS_PER_ACT - 1}Prepare well.{/if}
        </p>
      </header>

      <div class="doors" class:has-pick={picked !== null}>
        {#each v.doors as _, i (i)}
          {@const info = infos[i]}
          <button
            bind:this={doorEls[i]}
            class="door"
            class:shown={i < shown}
            class:picked={picked === i}
            class:gone={entering !== null && entering !== i}
            class:through={entering === i}
            style:--c={info.color}
            onclick={() => press(i)}
            onfocus={() => look(i)}
            onmouseenter={() => look(i)}
            tabindex={ready ? 0 : -1}
            type="button"
          >
            <span class="arch" aria-hidden="true" data-clip>
              <span class="light"></span>
              <Emblem glyph={info.glyph} color={info.color} tier={info.tier} size="8.4rem" bob />
            </span>
            <kbd>{i + 1}</kbd>
            <span class="kind">{info.kind}</span>
            <span class="title">{info.title}</span>
            <span class="line">{info.line}</span>
          </button>
        {/each}
      </div>

      <p class="preview" aria-live="polite">
        {#if picked !== null && infos[picked]}
          <span class="more">{infos[picked].more}</span>
          <span class="hint">
            {#if entering === null}Press <kbd>{picked + 1}</kbd> again or <kbd>Enter</kbd> to go through.{/if}
          </span>
        {:else if ready}
          <span class="hint">Press a door's number to look closer.</span>
        {/if}
      </p>
    </div>
    <div class="flash" aria-hidden="true" style:--c={entering !== null ? infos[entering].color : 'white'}></div>
  </div>
{/if}

<style>
  .screen {
    position: relative;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-4) var(--space-5);
    overflow: hidden;
  }
  .body {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-4);
  }
  header {
    text-align: center;
  }
  h1 {
    font-size: var(--t-3xl);
    color: var(--gold-bright);
  }
  header p {
    color: var(--moon-dim);
    font-size: var(--t-lg);
    margin-top: var(--space-1);
  }
  .doors {
    display: flex;
    gap: var(--space-6);
    align-items: flex-end;
  }
  .door {
    position: relative;
    width: 14.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    background: none;
    border: none;
    cursor: pointer;
    text-align: center;
    opacity: 0;
    transform: translateY(60px) scale(0.92);
    filter: blur(6px);
    transition:
      opacity 0.55s var(--ease-out),
      transform 0.55s var(--ease-out),
      filter 0.55s var(--ease-out);
  }
  .door.shown {
    opacity: 1;
    transform: none;
    filter: none;
  }
  .has-pick .door.shown:not(.picked) {
    opacity: 0.5;
    transform: scale(0.95);
  }
  .door.shown.picked {
    transform: translateY(-10px) scale(1.07);
  }
  .door:focus-visible {
    outline: none;
  }
  .arch {
    position: relative;
    width: 12.75rem;
    height: 16.5rem;
    display: grid;
    place-items: center;
    border-radius: 6.9rem 6.9rem 0.353rem 0.353rem;
    border: 2px solid var(--gold-deep);
    outline: 1px solid color-mix(in oklab, var(--gold-deep) 50%, transparent);
    outline-offset: 0.353rem;
    background:
      radial-gradient(ellipse 70% 60% at 50% 55%, color-mix(in oklab, var(--c) 30%, transparent), transparent 75%),
      linear-gradient(180deg, var(--night-deep), var(--ink));
    box-shadow: inset 0 -40px 70px -30px color-mix(in oklab, var(--c) 45%, transparent);
    overflow: hidden;
    transition:
      border-color var(--dur),
      box-shadow var(--dur);
  }
  /* A slow shaft of the door's light, drifting up through the arch. */
  .light {
    position: absolute;
    inset: 0;
    background: linear-gradient(0deg, color-mix(in oklab, var(--c) 40%, transparent), transparent 60%);
    opacity: 0.35;
    animation: breathe 3.6s ease-in-out infinite;
  }
  .picked .arch {
    border-color: var(--gold-bright);
    box-shadow:
      inset 0 -60px 90px -30px color-mix(in oklab, var(--c) 75%, transparent),
      0 0 60px -10px color-mix(in oklab, var(--c) 70%, transparent);
  }
  .picked .light {
    opacity: 0.7;
  }
  kbd {
    margin-top: calc(-1 * var(--space-4));
    z-index: 1;
    font-size: var(--t-md);
  }
  .kind {
    margin-top: var(--space-2);
    font-size: var(--t-sm);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--moon-faint);
  }
  .title {
    font-family: var(--f-display);
    font-weight: 700;
    font-size: var(--t-2xl);
    line-height: 1.1;
    color: var(--c);
    text-shadow: 0 0 24px color-mix(in oklab, var(--c) 50%, transparent);
  }
  .line {
    font-size: var(--t-lg);
    color: var(--moon-dim);
  }
  .preview {
    min-height: 4.2em;
    max-width: 72ch;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    text-align: center;
  }
  .more {
    font-size: var(--t-lg);
    color: var(--moon);
    animation: rise 0.3s var(--ease-out);
  }
  .hint {
    font-size: var(--t-md);
    color: var(--moon-faint);
  }

  /* Stepping through: the chosen door swells and flares, the others sink, the screen washes with its light. */
  .door.gone {
    opacity: 0 !important;
    transform: translateY(40px) scale(0.9) !important;
  }
  .door.through {
    transform: scale(1.18) !important;
    transition: transform 0.7s cubic-bezier(0.5, 0, 0.75, 0);
  }
  .through .arch {
    box-shadow: 0 0 140px 20px color-mix(in oklab, var(--c) 80%, transparent);
  }
  .flash {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(circle at 50% 55%, var(--c), transparent 70%);
    opacity: 0;
  }
  .entering .flash {
    animation: flash 0.72s ease-in forwards;
  }
  @keyframes flash {
    0% {
      opacity: 0;
    }
    70% {
      opacity: 0.55;
    }
    100% {
      opacity: 0.95;
    }
  }
  @keyframes breathe {
    50% {
      opacity: 0.6;
      transform: translateY(-8px);
    }
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }
</style>
