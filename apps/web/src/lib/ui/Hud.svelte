<!-- Run status: health, shield, coins, where you are in the act, and your relics. -->
<script lang="ts">
  import { RELICS, ROOMS_PER_ACT, type RelicId } from '@lettermancer/engine';
  import Bar from './Bar.svelte';

  let {
    hp,
    maxHp,
    shield = 0,
    coins,
    act,
    room,
    relics,
    onbuild,
  }: {
    hp: number;
    maxHp: number;
    shield?: number;
    coins: number;
    act: number;
    /** rooms cleared this act; ROOMS_PER_ACT means the boss */
    room: number;
    relics: RelicId[];
    onbuild?: () => void;
  } = $props();

  const rooms = [...Array(ROOMS_PER_ACT + 1).keys()];
  const numeral = (n: number) => ['I', 'II', 'III', 'IV'][n - 1] ?? String(n);
</script>

<header class="hud">
  <div class="vitals">
    <div class="hp" class:low={hp / maxHp < 0.3}>
      <Bar value={hp} max={maxHp} tone="hp" height={20} label="{hp} / {maxHp}" />
    </div>
    {#if shield > 0}<span class="shield" title="Shield absorbs damage first">■ {shield}</span>{/if}
    <span class="coins" title="Coins">● {coins}</span>
  </div>

  <nav class="path" aria-label="Act progress">
    <span class="act">Act {numeral(act)}</span>
    <ol>
      {#each rooms as i (i)}
        {@const boss = i === ROOMS_PER_ACT}
        <li class:done={i < room} class:here={i === room} class:boss>
          <span aria-hidden="true">{boss ? '☠' : ''}</span>
        </li>
      {/each}
    </ol>
    <span class="here-name">{room >= ROOMS_PER_ACT ? 'Boss' : `Room ${room + 1} of ${ROOMS_PER_ACT}`}</span>
  </nav>

  <div class="right">
    <ul class="relics" aria-label="Relics">
      {#each relics as r (r)}
        <li>
          <button type="button" class="relic" aria-label="{RELICS[r].name}: {RELICS[r].desc}">
            <span aria-hidden="true">{RELICS[r].glyph}</span>
            <span class="tip" role="tooltip"><b>{RELICS[r].name}</b>{RELICS[r].desc}</span>
          </button>
        </li>
      {/each}
    </ul>
    {#if onbuild}<button type="button" class="build" onclick={onbuild}>Build</button>{/if}
  </div>
</header>

<style>
  .hud {
    width: min(1120px, 100%);
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: var(--space-4);
  }
  .vitals {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }
  .hp {
    width: 230px;
  }
  .low {
    animation: low 0.9s infinite alternate;
  }
  @keyframes low {
    to {
      filter: drop-shadow(0 0 8px var(--rose));
    }
  }
  .shield {
    color: var(--witchfire);
    font-weight: 700;
  }
  .coins {
    color: var(--aurum);
    font-weight: 700;
  }
  .path {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  .act {
    font-family: var(--f-display);
    font-weight: 700;
    color: var(--gold);
  }
  ol {
    display: flex;
    gap: 6px;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    position: relative;
  }
  ol li {
    width: 14px;
    height: 14px;
    display: grid;
    place-items: center;
    font-size: 0.8rem;
    color: var(--moon-faint);
    border: 1px solid var(--rule);
    transform: rotate(45deg);
  }
  ol li > span[aria-hidden] {
    transform: rotate(-45deg);
  }
  ol li.done {
    opacity: 0.35;
  }
  ol li.here {
    color: var(--night);
    background: var(--gold);
    border-color: var(--gold-bright);
    box-shadow: 0 0 12px -2px var(--gold);
  }
  ol li.boss {
    width: 22px;
    height: 22px;
  }
  ol li.boss:not(.here) {
    border-color: color-mix(in oklab, var(--rose) 60%, var(--rule));
    color: var(--rose);
  }
  .here-name {
    min-width: 7.5em;
    color: var(--moon-dim);
    font-size: var(--t-sm);
  }
  .right {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: var(--space-3);
  }
  .build {
    padding: 4px 12px;
    font-family: var(--f-display);
    font-size: var(--t-sm);
    color: var(--moon-dim);
    background: var(--ink);
    border: 1px solid var(--rule);
    cursor: pointer;
  }
  .build:hover {
    color: var(--moon);
    border-color: var(--gold-deep);
  }
  .relics {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .relic {
    position: relative;
    padding: 0;
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    font-family: var(--f-glyph);
    font-size: 1.15rem;
    color: var(--gold-bright);
    background: var(--ink);
    border: 1px solid var(--gold-deep);
    cursor: help;
  }
  .tip {
    display: none;
    position: absolute;
    top: 40px;
    right: 0;
    z-index: 60;
    width: 240px;
    padding: var(--space-3);
    font-family: var(--f-text);
    font-size: var(--t-sm);
    color: var(--moon);
    text-align: left;
    background: var(--ink);
    border: 1px solid var(--gold-deep);
    box-shadow: 0 12px 30px -10px #000;
  }
  .tip b {
    display: block;
    font-family: var(--f-display);
    color: var(--gold-bright);
  }
  .relic:hover .tip,
  .relic:focus-visible .tip {
    display: block;
  }
</style>
