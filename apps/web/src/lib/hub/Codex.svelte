<!-- The Codex: every foe, boss and boon you've met, filling in as you play. -->
<script lang="ts">
  import { BLESSING_IDS, BLESSINGS, BOSSES, ELITES, isDuo, MOD_IDS, MODS, MUSES, ROSTER } from '@lettermancer/engine';
  import { TRAIT_INFO } from '../game/look';
  import { profile } from '../stores/profile.svelte';
  import Panel from '../ui/Panel.svelte';

  let { onclose }: { onclose: () => void } = $props();
  const cx = profile.meta.codex;
  let tab = $state<'foes' | 'bosses' | 'boons'>('foes');
  const acts = ['Act I', 'Act II', 'Act III'];

  export function onKey(k: string): boolean {
    if (k === 'Escape') {
      onclose();
      return true;
    }
    if (k === '1') tab = 'foes';
    else if (k === '2') tab = 'bosses';
    else if (k === '3') tab = 'boons';
    else return false;
    return true;
  }
</script>

<Panel title="Codex" subtitle="Everything you've met fills in here." width={920} screen="codex" {onclose}>
  <div class="tabs" role="tablist">
    {#each [['foes', 'Foes'], ['bosses', 'Bosses'], ['boons', 'Boons']] as const as [id, label], i (id)}
      <button role="tab" aria-selected={tab === id} class:on={tab === id} onclick={() => (tab = id)} type="button"
        ><kbd>{i + 1}</kbd> {label}</button
      >
    {/each}
  </div>

  {#if tab === 'foes'}
    {#each [...ROSTER, ELITES] as list, i (i)}
      <h3>{acts[i] ?? 'Elites'}</h3>
      <ul class="grid">
        {#each list as m (m.name)}
          {@const seen = (cx.enemies[m.name] ?? 0) > 0}
          <li class:seen>
            <span class="g">{seen ? m.glyph : '?'}</span>
            <span
              ><b>{seen ? m.name : 'Unknown foe'}</b>
              {#if seen}<small
                  >{m.traits.map((t) => TRAIT_INFO[t]?.name ?? t).join(', ') || 'No special traits'}. Met {cx.enemies[
                    m.name
                  ]} time{cx.enemies[m.name] === 1 ? '' : 's'}.</small
                >{/if}
            </span>
          </li>
        {/each}
      </ul>
    {/each}
  {:else if tab === 'bosses'}
    <ul class="grid">
      {#each Object.values(BOSSES) as b (b.rule)}
        {@const beaten = cx.bosses[b.rule] ?? 0}
        <li class:seen={beaten > 0}>
          <span class="g">{beaten ? b.glyph : '?'}</span>
          <span
            ><b>{beaten ? b.name : 'Undefeated'}</b>
            {#if beaten}<small>{b.desc} Beaten {beaten} time{beaten === 1 ? '' : 's'}.</small>{:else}<small
                >Defeat it to learn its ways.</small
              >{/if}
          </span>
        </li>
      {/each}
    </ul>
  {:else}
    <h3>Key powers</h3>
    <ul class="grid">
      {#each MOD_IDS as id (id)}
        {@const seen = cx.boons.includes(id)}
        <li class:seen>
          <span class="g" style:color={seen ? MODS[id].color : null}>{seen ? MODS[id].glyph : '?'}</span>
          <span
            ><b>{seen ? MODS[id].name : 'Unknown power'}</b>{#if seen}<small>{MODS[id].describe(0)}</small>{/if}</span
          >
        </li>
      {/each}
    </ul>
    <h3>Blessings and duo boons</h3>
    <ul class="grid">
      {#each BLESSING_IDS as id (id)}
        {@const seen = cx.boons.includes(id)}
        {@const bl = BLESSINGS[id]}
        <li class:seen>
          <span class="g" style:color={seen ? MUSES[bl.muses[0]].color : null}>{seen ? bl.glyph : '?'}</span>
          <span
            ><b>{seen ? bl.name : isDuo(id) ? 'Unknown duo' : `A gift of ${MUSES[bl.muses[0]].name}`}</b
            >{#if seen}<small>{bl.desc}</small>{/if}</span
          >
        </li>
      {/each}
    </ul>
  {/if}
</Panel>

<style>
  .tabs {
    display: flex;
    gap: var(--space-2);
    justify-content: center;
    margin-bottom: var(--space-4);
  }
  .tabs button {
    padding: 0.353rem 0.824rem;
    background: var(--ink);
    border: 1px solid var(--rule);
    cursor: pointer;
    font-family: var(--f-display);
    text-transform: var(--ui-case);
    letter-spacing: var(--ui-tracking);
  }
  .tabs .on {
    border-color: var(--gold);
    color: var(--gold-bright);
  }
  h3 {
    font-size: var(--t-md);
    color: var(--gold);
    margin: var(--space-3) 0 var(--space-2);
  }
  .grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-2) var(--space-4);
  }
  li {
    display: grid;
    grid-template-columns: 2.353rem 1fr;
    gap: var(--space-3);
    align-items: center;
    color: var(--moon-faint);
  }
  .g {
    width: 2.353rem;
    height: 2.353rem;
    display: grid;
    place-items: center;
    font-family: var(--f-glyph);
    font-size: 1.4rem;
    border: 1px solid var(--rule);
    color: var(--moon-faint);
  }
  .seen .g {
    color: var(--gold-bright);
    border-color: var(--gold-deep);
  }
  b {
    display: block;
    font-weight: 700;
  }
  .seen b {
    color: var(--moon);
  }
  small {
    display: block;
    color: var(--moon-dim);
    font-size: var(--t-xs);
  }

  /* Typography roles (see app.css): boon names, titles and speakers get their own faces. */
  li b {
    font-family: var(--f-boon);
    font-weight: 700;
    text-transform: none;
    letter-spacing: 0.02em;
  }
</style>
