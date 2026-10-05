<!-- Permanent upgrades, bought with Ink and Gold Leaf. -->
<script lang="ts">
  import { nextCost, rankOf, UPGRADE_IDS, UPGRADES, buyUpgrade, type UpgradeId } from '@lettermancer/engine';
  import * as sfx from '../fx/audio';
  import { profile } from '../stores/profile.svelte';
  import Panel from '../ui/Panel.svelte';

  let { onclose }: { onclose: () => void } = $props();
  const meta = profile.meta;

  function buy(id: UpgradeId) {
    if (buyUpgrade(meta, id)) {
      sfx.boon();
      profile.saveMeta();
    } else sfx.miss();
  }

  export function onKey(k: string): boolean {
    if (k === 'Escape') {
      onclose();
      return true;
    }
    const i = Number(k) - 1;
    if (i >= 0 && i < UPGRADE_IDS.length) {
      buy(UPGRADE_IDS[i]);
      return true;
    }
    return false;
  }
</script>

<Panel
  title="Codex of Hands"
  subtitle="Small, lasting gifts for every run. They grow pricier as you buy them — your fingers stay your real strength."
  screen="codex-of-hands"
  {onclose}
>
  <ul class="grid">
    {#each UPGRADE_IDS as id, i (id)}
      {@const u = UPGRADES[id]}
      {@const rank = rankOf(meta.upgrades, id)}
      {@const cost = nextCost(meta.upgrades, id)}
      {@const wallet = u.currency === 'ink' ? meta.ink : meta.leaf}
      <li>
        <button class="up" disabled={cost === null || wallet < cost} onclick={() => buy(id)} type="button">
          <kbd>{i + 1}</kbd>
          <span class="glyph" aria-hidden="true">{u.glyph}</span>
          <span class="name">{u.name}</span>
          <span class="desc">{u.desc}</span>
          <span class="ranks" aria-label="Rank {rank} of {u.costs.length}">
            {#each u.costs as _, r (r)}<i class:on={r < rank}></i>{/each}
          </span>
          <span class="cost" class:leaf={u.currency === 'leaf'}>
            {cost === null ? 'Complete' : `${cost} ${u.currency === 'ink' ? 'Ink' : 'Gold Leaf'}`}
          </span>
        </button>
      </li>
    {/each}
  </ul>
</Panel>

<style>
  .grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-3);
  }
  .up {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 8.824rem;
    padding: var(--space-3) var(--space-3) var(--space-2);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    text-align: center;
    background: var(--ink);
    border: 1px solid var(--rule);
    cursor: pointer;
  }
  .up:hover:not(:disabled),
  .up:focus-visible {
    border-color: var(--gold);
  }
  .up:disabled {
    cursor: default;
  }
  .up:disabled .cost {
    color: var(--moon-faint);
  }
  kbd {
    position: absolute;
    top: 0.471rem;
    left: 0.471rem;
  }
  .glyph {
    font-family: var(--f-glyph);
    font-size: 1.6rem;
    line-height: 1;
    color: var(--gold-bright);
  }
  .name {
    font-family: var(--f-display);
    text-transform: var(--ui-case);
    letter-spacing: var(--ui-tracking);
    font-weight: 700;
  }
  .desc {
    font-size: var(--t-xs);
    color: var(--moon-dim);
    line-height: 1.3;
  }
  .ranks {
    display: flex;
    gap: 4px;
    margin-top: auto;
  }
  .ranks i {
    width: 0.529rem;
    height: 0.529rem;
    transform: rotate(45deg);
    border: 1px solid var(--gold);
  }
  .ranks i.on {
    background: var(--gold);
  }
  .cost {
    font-weight: 700;
    color: var(--echo);
  }
  .cost.leaf {
    color: var(--gold-bright);
  }

  /* Typography roles (see app.css): boon names, titles and speakers get their own faces. */
  .name {
    font-family: var(--f-boon);
    font-weight: 700;
    text-transform: none;
    letter-spacing: 0.02em;
  }
</style>
