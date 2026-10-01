<!-- Choose the next room. Each door says what waits behind it: a fight and its reward, a shop, or an event. -->
<script lang="ts">
  import { MODS, MUSES, ROOMS_PER_ACT, type Door } from '@lettermancer/engine';
  import * as sfx from '../fx/audio';
  import type { Session } from '../game/session.svelte';
  import Hud from '../ui/Hud.svelte';

  let { session, onbuild }: { session: Session; onbuild?: () => void } = $props();
  const v = $derived(session.view.kind === 'doors' ? session.view : null);
  const run = $derived(session.run);

  function describe(d: Door): { title: string; line: string; glyph: string; color: string } {
    if (d.node === 'shop')
      return { title: 'Shop', line: 'Spend coins on powers and relics.', glyph: '⚖', color: 'var(--aurum)' };
    if (d.node === 'event')
      return { title: 'Unknown', line: 'Something waits here. Not a fight.', glyph: '?', color: 'var(--echo)' };
    if (d.node === 'elite')
      return { title: 'Elite', line: 'A dangerous foe guards a relic.', glyph: '◆', color: 'var(--rose)' };
    const r = d.reward;
    if (r?.kind === 'muse') {
      const m = MUSES[r.muse];
      return { title: m.name, line: `${m.title}. Fight for her boon.`, glyph: MODS[m.mod].glyph, color: m.color };
    }
    if (r?.kind === 'coins')
      return { title: 'Purse', line: 'A fight with a heavy purse.', glyph: '●', color: 'var(--aurum)' };
    if (r?.kind === 'heal')
      return { title: 'Spring', line: 'A fight, then rest: heal 35%.', glyph: '✚', color: 'var(--witchfire)' };
    return { title: 'Fight', line: '', glyph: '⚔', color: 'var(--moon)' };
  }

  function go(i: number) {
    sfx.select();
    session.door(i);
  }

  export function onKey(k: string): boolean {
    const i = Number(k) - 1;
    if (v && i >= 0 && i < v.doors.length) {
      go(i);
      return true;
    }
    return false;
  }
</script>

{#if v}
  <div class="screen" data-screen="doors">
    <Hud hp={run.hp} maxHp={run.maxHp} coins={run.coins} act={run.act} room={run.room} relics={run.relics} {onbuild} />
    <div class="body">
      <header>
        <h1>Choose your path</h1>
        <p>
          {ROOMS_PER_ACT - run.room} room{ROOMS_PER_ACT - run.room === 1 ? '' : 's'} before the boss.
          {#if run.room === ROOMS_PER_ACT - 1}Prepare well.{/if}
        </p>
      </header>
      <div class="doors">
        {#each v.doors as d, i (i)}
          {@const info = describe(d)}
          <button
            class="door"
            class:fight={d.node === 'fight' || d.node === 'elite'}
            style:--c={info.color}
            onclick={() => go(i)}
            type="button"
          >
            <kbd>{i + 1}</kbd>
            <span class="arch" aria-hidden="true"><span class="sigil">{info.glyph}</span></span>
            <span class="kind"
              >{d.node === 'fight'
                ? 'Fight'
                : d.node === 'elite'
                  ? 'Elite fight'
                  : d.node === 'shop'
                    ? 'Rest stop'
                    : 'Event'}</span
            >
            <span class="title">{info.title}</span>
            <span class="line">{info.line}</span>
          </button>
        {/each}
      </div>
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
    gap: var(--space-6);
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
    margin-top: var(--space-2);
  }
  .doors {
    display: flex;
    gap: var(--space-6);
  }
  .door {
    position: relative;
    width: 220px;
    padding: 0 0 var(--space-4);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    background: none;
    border: none;
    cursor: pointer;
    text-align: center;
  }
  .door kbd {
    position: absolute;
    top: -8px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1;
  }
  .arch {
    width: 180px;
    height: 240px;
    display: grid;
    place-items: center;
    border-radius: 90px 90px 4px 4px;
    border: 2px solid var(--gold-deep);
    outline: 1px solid color-mix(in oklab, var(--gold-deep) 50%, transparent);
    outline-offset: 5px;
    background:
      radial-gradient(ellipse 60% 55% at 50% 60%, color-mix(in oklab, var(--c) 35%, transparent), transparent 75%),
      linear-gradient(180deg, var(--night-deep), var(--ink));
    box-shadow: inset 0 -30px 60px -30px color-mix(in oklab, var(--c) 45%, transparent);
    transition:
      transform var(--dur) var(--ease-out),
      box-shadow var(--dur),
      border-color var(--dur);
  }
  .sigil {
    font-family: var(--f-glyph);
    font-size: 3.4rem;
    color: var(--c);
    text-shadow: 0 0 24px var(--c);
  }
  .door:hover .arch,
  .door:focus-visible .arch {
    transform: translateY(-6px);
    border-color: var(--gold-bright);
    box-shadow:
      inset 0 -40px 70px -30px color-mix(in oklab, var(--c) 65%, transparent),
      0 16px 40px -16px color-mix(in oklab, var(--c) 60%, transparent);
  }
  .door:focus-visible {
    outline: none;
  }
  .kind {
    margin-top: var(--space-3);
    font-size: var(--t-xs);
    color: var(--moon-faint);
  }
  .title {
    font-family: var(--f-display);
    font-weight: 700;
    font-size: var(--t-xl);
    color: var(--c);
  }
  .line {
    font-size: var(--t-sm);
    color: var(--moon-dim);
    max-width: 24ch;
  }
</style>
