<!-- Keepsakes: carry one into each run. They grow stronger the more runs you carry them. -->
<script lang="ts">
  import {
    KEEPSAKE_IDS,
    KEEPSAKE_RUNS_PER_LEVEL,
    KEEPSAKES,
    keepsakeLevel,
    type KeepsakeId,
  } from '@lettermancer/engine';
  import * as sfx from '../fx/audio';
  import { profile } from '../stores/profile.svelte';
  import Panel from '../ui/Panel.svelte';

  let { onclose }: { onclose: () => void } = $props();
  const meta = profile.meta;

  function equip(id: KeepsakeId) {
    if (!meta.keepsakes.includes(id)) return sfx.miss();
    meta.equipped = meta.equipped === id ? null : id;
    profile.saveMeta();
    sfx.select();
  }

  export function onKey(k: string): boolean {
    if (k === 'Escape') {
      onclose();
      return true;
    }
    const i = Number(k) - 1;
    if (i >= 0 && i < KEEPSAKE_IDS.length) {
      equip(KEEPSAKE_IDS[i]);
      return true;
    }
    return false;
  }
</script>

<Panel
  title="Keepsakes"
  subtitle="Carry one keepsake into each run. Every {KEEPSAKE_RUNS_PER_LEVEL} runs you carry it, it grows stronger (up to level 3)."
  screen="keepsakes"
  {onclose}
>
  <ul class="list">
    {#each KEEPSAKE_IDS as id, i (id)}
      {@const k = KEEPSAKES[id]}
      {@const owned = meta.keepsakes.includes(id)}
      {@const uses = meta.keepsakeUses[id] ?? 0}
      {@const lvl = keepsakeLevel(uses)}
      <li>
        <button
          class="ks"
          class:owned
          class:equipped={meta.equipped === id}
          onclick={() => equip(id)}
          disabled={!owned}
          aria-pressed={meta.equipped === id}
          type="button"
        >
          <kbd>{i + 1}</kbd>
          <span class="glyph" aria-hidden="true">{owned ? k.glyph : '?'}</span>
          <span class="text">
            <b>{owned ? k.name : 'Not yet found'}</b>
            {#if owned}
              <span>Level {lvl}: {k.levels[lvl - 1]}</span>
              {#if lvl < 3}<small
                  >{KEEPSAKE_RUNS_PER_LEVEL * lvl - uses} more run{KEEPSAKE_RUNS_PER_LEVEL * lvl - uses === 1
                    ? ''
                    : 's'} to level {lvl + 1}</small
                >{/if}
            {:else}
              <span>{k.unlock}</span>
            {/if}
          </span>
          {#if meta.equipped === id}<span class="tag">Carried</span>{/if}
        </button>
      </li>
    {/each}
  </ul>
</Panel>

<style>
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .ks {
    width: 100%;
    display: grid;
    grid-template-columns: auto auto 1fr auto;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-3) var(--space-4);
    text-align: left;
    background: var(--ink);
    border: 1px solid var(--rule);
    cursor: pointer;
  }
  .ks:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .ks.owned:hover,
  .ks:focus-visible {
    border-color: var(--gold);
  }
  .equipped {
    border-color: var(--gold);
    box-shadow: 0 0 0 1px var(--gold-deep);
  }
  .glyph {
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    font-family: var(--f-glyph);
    font-size: 1.7rem;
    color: var(--gold-bright);
    border: 1px solid var(--gold-deep);
    border-radius: 50%;
  }
  .text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  b {
    font-family: var(--f-display);
  }
  .text span {
    color: var(--moon-dim);
    font-size: var(--t-sm);
  }
  small {
    color: var(--moon-faint);
  }
  .tag {
    font-size: var(--t-xs);
    color: var(--gold-bright);
    border: 1px solid var(--gold-deep);
    padding: 2px 8px;
  }
</style>
