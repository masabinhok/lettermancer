<!-- One enemy: its illuminated initial, health, what it does, the word you must type, and when it strikes. -->
<script lang="ts">
  import { BOSSES, MODS } from '@lettermancer/engine';
  import { FIELD, letterColors, TRAIT_INFO } from '../game/look';
  import type { EnemySnap } from '../game/snapshot';
  import { profile } from '../stores/profile.svelte';
  import Bar from './Bar.svelte';
  import Initial from './Initial.svelte';

  let { e }: { e: EnemySnap } = $props();
  const size = $derived(e.kind === 'boss' ? 104 : e.kind === 'elite' ? 88 : e.kind === 'minion' ? 52 : 72);
  const secs = $derived(Math.ceil(e.msToHit / 100) / 10);
  const harmless = $derived(e.atk === 0 || e.msToHit > 60_000);
  const phases = $derived(e.rule ? BOSSES[e.rule].phases.length + 1 : 0);
</script>

<article
  class="enemy {e.kind}"
  class:targeted={e.targeted}
  class:windup={e.windup}
  class:danger={e.intent > 0.75}
  class:shifting={e.shifting}
  data-enemy={e.id}
  aria-label="{e.name}, {e.hp} health, word {e.word}"
>
  <div class="portrait">
    <Initial
      glyph={e.glyph}
      {size}
      field={FIELD[e.kind]}
      mirrored={e.rule === 'mirror'}
      ink={e.windup ? 'var(--rose)' : undefined}
    />
  </div>
  <h3 class="name">
    {e.name}
    {#if phases > 1}<span class="phase" title="Phase {e.phase} of {phases}"
        >{#each Array(phases) as _, i (i)}<i class:on={i < e.phase}></i>{/each}</span
      >{/if}
  </h3>
  <div class="hp">
    <Bar value={e.hp} max={e.maxHp} tone="foe" height={14} label={String(e.hp)} />
    {#if e.shield > 0}<span class="eshield" title="Shield: absorbs damage first">◈ {e.shield}</span>{/if}
  </div>
  {#if e.traits.length || e.burn > 0}
    <ul class="traits">
      {#each e.traits as t (t)}
        <li title={TRAIT_INFO[t]?.desc}>{TRAIT_INFO[t]?.name ?? t}</li>
      {/each}
      {#if e.burn > 0}<li class="burn">▲ Burning {e.burn}</li>{/if}
    </ul>
  {/if}

  <p class="word" class:blacked={e.letters.some((l) => l.hidden)} aria-hidden="true">
    {#each e.letters as l, i (i)}
      {@const c = letterColors(l.boons)}
      <span
        class="l {l.state}"
        class:modded={!!c.fill}
        class:stacked={l.boons.length > 1}
        class:masked={l.masked}
        class:space={l.ch === ' '}
        style:--fill={c.fill}
        style:--under={c.under}
        >{#if profile.settings.powerSymbols && l.boons.length && !l.hidden && !l.masked}<span class="sym"
            >{l.boons.map((b) => MODS[b.mod].glyph).join('')}</span
          >{/if}{l.hidden ? '·' : l.masked ? '_' : l.ch === ' ' ? '␣' : l.ch}</span
      >
    {/each}
  </p>
  {#if e.shifting}<p class="warn">Its word is about to change</p>{/if}

  <div class="threat">
    {#if harmless}
      <span class="when calm">Does not attack</span>
    {:else}
      <Bar value={e.intent} max={1} tone={e.intent > 0.75 ? 'danger' : 'threat'} height={6} />
      <span class="hit" title="Damage of its next hit">
        <span aria-hidden="true">⚔</span>
        {e.atk}
        <span class="when">{e.windup ? 'now' : `in ${secs.toFixed(1)}s`}</span>
      </span>
    {/if}
  </div>
</article>

<style>
  .enemy {
    position: relative;
    width: 17rem;
    padding: var(--space-3) var(--space-4) var(--space-3);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    background: linear-gradient(180deg, rgba(44, 36, 66, 0.9), rgba(26, 20, 40, 0.9));
    border: 1px solid var(--rule);
    border-radius: 2px;
    transition:
      transform var(--dur) var(--ease-out),
      border-color var(--dur),
      box-shadow var(--dur);
    animation: enter 0.35s var(--ease-out);
  }
  @keyframes enter {
    from {
      opacity: 0;
      transform: translateY(-14px) scale(0.94);
    }
  }
  .elite {
    width: 19.4rem;
    border-color: var(--gold-deep);
  }
  .boss {
    width: 25.9rem;
    border-color: color-mix(in oklab, var(--rose) 50%, var(--gold-deep));
  }
  .minion {
    width: 11.8rem;
  }
  .targeted {
    border-color: var(--moon);
    box-shadow:
      0 0 0 1px var(--moon),
      0 16px 40px -16px rgba(221, 215, 234, 0.35);
    transform: translateY(-4px);
  }
  .windup {
    border-color: var(--rose);
    animation: windup 0.28s infinite alternate;
  }
  @keyframes windup {
    from {
      box-shadow:
        0 0 0 1px var(--rose),
        0 0 18px -4px var(--rose);
    }
    to {
      box-shadow:
        0 0 0 2px var(--rose),
        0 0 42px -2px var(--rose);
    }
  }
  .windup .portrait {
    animation: tremble 0.12s infinite;
  }
  @keyframes tremble {
    50% {
      transform: translate(-1.5px, 1px) scale(1.04);
    }
  }
  .name {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--t-sm);
    color: var(--moon-dim);
    margin-top: var(--space-2);
  }
  .phase {
    display: inline-flex;
    gap: 3px;
  }
  .phase i {
    width: 7px;
    height: 7px;
    transform: rotate(45deg);
    border: 1px solid var(--rose);
  }
  .phase i.on {
    background: var(--rose);
  }
  .hp {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .eshield {
    flex: none;
    font-size: var(--t-xs);
    font-weight: 700;
    color: var(--frost);
  }
  .traits {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 4px;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .traits li {
    font-size: var(--t-xs);
    padding: 0 6px;
    border: 1px solid var(--rule);
    color: var(--moon-dim);
    cursor: help;
  }
  .traits .burn {
    color: var(--ember);
    border-color: color-mix(in oklab, var(--ember) 40%, transparent);
  }
  .word {
    margin: var(--space-1) 0;
    font-family: var(--f-type);
    font-weight: 600;
    font-size: 2.5rem;
    line-height: 1.2;
    letter-spacing: 0.01em;
    white-space: nowrap;
  }
  .boss .word {
    font-size: 2.6rem;
  }
  .minion .word {
    font-size: 1.9rem;
  }
  .l {
    display: inline-block;
    position: relative;
  }
  .l.modded {
    color: var(--fill);
    text-shadow: 0 0 14px color-mix(in oklab, var(--fill) 55%, transparent);
  }
  .l.modded::after {
    content: '';
    position: absolute;
    left: 8%;
    right: 8%;
    bottom: 0.05em;
    height: 2px;
    background: var(--under);
  }
  .l.stacked::after {
    height: 4px;
    background: linear-gradient(180deg, var(--fill) 0 50%, var(--under) 50%);
  }
  .l.masked {
    color: var(--rose);
  }
  .l.space {
    color: var(--moon-faint);
  }
  .sym {
    position: absolute;
    left: 50%;
    top: -0.55em;
    transform: translateX(-50%);
    font-size: 0.32em;
    letter-spacing: 0;
    color: var(--fill);
  }
  .l.done {
    opacity: 0.5;
    text-shadow: none;
  }
  .l.next {
    color: var(--moon);
  }
  .l.next::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: -0.18em;
    height: 3px;
    background: var(--gold-bright);
    animation: caret 0.9s steps(2) infinite;
  }
  @keyframes caret {
    50% {
      opacity: 0.25;
    }
  }
  .blacked .l:not(.done) {
    color: var(--moon-faint);
  }
  .shifting .word {
    animation: flicker 0.2s infinite alternate;
  }
  @keyframes flicker {
    to {
      opacity: 0.55;
    }
  }
  .warn {
    font-size: var(--t-xs);
    color: var(--spark);
    margin-top: -4px;
  }
  .threat {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: var(--space-3);
  }
  .hit {
    font-weight: 700;
    font-size: var(--t-md);
    color: var(--moon);
    white-space: nowrap;
  }
  .danger .hit {
    color: var(--rose);
  }
  .windup .hit {
    font-size: var(--t-lg);
  }
  .calm {
    grid-column: span 2;
    text-align: center;
  }
  .when {
    font-weight: 400;
    font-size: var(--t-xs);
    color: var(--moon-faint);
  }
</style>
