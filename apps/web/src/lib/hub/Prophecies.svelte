<!-- Prophecies: achievements, grouped, with what's left to fulfil. -->
<script lang="ts">
  import { PROPHECIES, type ProphecyCategory } from '@lettermancer/engine';
  import { profile } from '../stores/profile.svelte';
  import Panel from '../ui/Panel.svelte';

  let { onclose }: { onclose: () => void } = $props();
  const meta = profile.meta;
  const done = $derived(PROPHECIES.filter((p) => meta.prophecies[p.id]).length);
  // Grouped by category, in the order categories first appear.
  const categories = [...new Set(PROPHECIES.map((p) => p.category))] as ProphecyCategory[];
  const groups = categories.map((c) => [c, PROPHECIES.filter((p) => p.category === c)] as const);

  export function onKey(k: string): boolean {
    if (k === 'Escape') {
      onclose();
      return true;
    }
    return false;
  }
</script>

<Panel
  title="Prophecies"
  subtitle="{done} of {PROPHECIES.length} fulfilled. Each one pays Seals, which the Archivist trades for Gold Leaf."
  width={920}
  screen="prophecies"
  {onclose}
>
  {#each groups as [cat, list] (cat)}
    <section>
      <h3>{cat}</h3>
      <ul>
        {#each list as p (p.id)}
          <li class:done={!!meta.prophecies[p.id]}>
            <span class="mark" aria-hidden="true">{meta.prophecies[p.id] ? '✦' : '✧'}</span>
            <span class="text"><b>{p.name}</b> <span>{p.desc}</span></span>
            <span class="seals">{p.seals} ✪</span>
          </li>
        {/each}
      </ul>
    </section>
  {/each}
</Panel>

<style>
  section + section {
    margin-top: var(--space-4);
  }
  h3 {
    font-size: var(--t-md);
    color: var(--gold);
    margin-bottom: var(--space-2);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px var(--space-4);
  }
  li {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: var(--space-2);
    align-items: baseline;
    font-size: var(--t-sm);
    color: var(--moon-faint);
  }
  li.done {
    color: var(--moon-dim);
  }
  .mark {
    color: var(--moon-faint);
  }
  .done .mark {
    color: var(--gold-bright);
  }
  b {
    color: var(--moon-dim);
    font-weight: 700;
  }
  .done b {
    color: var(--moon);
  }
  .seals {
    color: var(--rose);
    font-size: var(--t-xs);
  }

  /* Typography roles (see app.css): boon names, titles and speakers get their own faces. */
  .text b {
    font-family: var(--f-boon);
    font-weight: 700;
    text-transform: none;
    letter-spacing: 0.02em;
  }
</style>
