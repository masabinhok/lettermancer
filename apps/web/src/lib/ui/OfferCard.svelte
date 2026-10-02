<!-- A choice card for boons, relics and shop items. Rarer offers get the ornate gold frame. -->
<script lang="ts">
  import Corner from './Corner.svelte';
  import Emblem from './Emblem.svelte';

  let {
    hotkey,
    glyph,
    name,
    desc,
    color = 'var(--gold)',
    kind,
    cost = null,
    affordable = true,
    sold = false,
    ornate = false,
    detail = null,
    rarityColor = null,
    tier = 0,
    index = 0,
    onselect,
  }: {
    hotkey: string;
    glyph: string;
    name: string;
    desc: string;
    color?: string;
    kind: string;
    cost?: number | null;
    affordable?: boolean;
    sold?: boolean;
    ornate?: boolean;
    detail?: string | null;
    /** colors the kind line to show rarity */
    rarityColor?: string | null;
    /** 0-3: the medallion's rim, from bronze to heroic gold */
    tier?: number;
    /** position in a row, so cards arrive one after another */
    index?: number;
    onselect: () => void;
  } = $props();
</script>

<button
  class="card"
  class:ornate
  class:sold
  class:poor={!affordable}
  style:--c={color}
  style:--i={index}
  onclick={onselect}
  disabled={sold}
  type="button"
>
  {#if ornate}<Corner pos="tl" size={20} /><Corner pos="tr" size={20} /><Corner pos="bl" size={20} /><Corner
      pos="br"
      size={20}
    />{/if}
  <kbd class="hk">{hotkey}</kbd>
  <span class="sigil" aria-hidden="true"><Emblem {glyph} {color} {tier} size="4.6rem" rays={tier >= 2} /></span>
  <span class="kind" style:color={rarityColor}>{kind}</span>
  <span class="name">{name}</span>
  <span class="desc">{desc}</span>
  {#if detail}<span class="detail">{detail}</span>{/if}
  {#if cost !== null}
    <span class="cost">{sold ? 'Sold' : `${cost} coins`}</span>
  {/if}
</button>

<style>
  .card {
    position: relative;
    width: 13.5rem;
    min-height: 15.5rem;
    padding: var(--space-5) var(--space-4) var(--space-4);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    text-align: center;
    cursor: pointer;
    background: linear-gradient(180deg, color-mix(in oklab, var(--c) 10%, var(--ink-2)), var(--ink) 65%);
    border: 1px solid color-mix(in oklab, var(--c) 35%, var(--rule));
    border-radius: 2px;
    transition:
      transform var(--dur) var(--ease-out),
      box-shadow var(--dur) var(--ease-out),
      border-color var(--dur);
    animation: deal 0.5s var(--ease-out) both;
    animation-delay: calc(var(--i) * 90ms);
  }
  @keyframes deal {
    from {
      opacity: 0;
      transform: translateY(24px) rotate(-2deg) scale(0.95);
    }
  }
  .card:hover:not(:disabled),
  .card:focus-visible {
    transform: translateY(-6px);
    border-color: var(--c);
    box-shadow: 0 14px 40px -12px color-mix(in oklab, var(--c) 60%, transparent);
  }
  .ornate {
    border-color: var(--gold-deep);
  }
  .hk {
    position: absolute;
    top: 10px;
    left: 10px;
  }
  .sigil {
    display: grid;
    place-items: center;
    margin-top: var(--space-1);
  }
  .kind {
    font-size: var(--t-xs);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--moon-faint);
  }
  .name {
    font-family: var(--f-display);
    font-weight: 700;
    font-size: var(--t-xl);
    color: var(--c);
    line-height: 1.1;
  }
  .desc {
    font-size: var(--t-md);
    color: var(--moon);
    line-height: 1.35;
  }
  .detail {
    font-size: var(--t-xs);
    color: var(--moon-faint);
    font-style: italic;
  }
  .cost {
    margin-top: auto;
    font-family: var(--f-display);
    font-weight: 700;
    font-size: var(--t-lg);
    color: var(--aurum);
  }
  .poor .cost {
    color: var(--rose);
  }
  .sold {
    opacity: 0.3;
    cursor: default;
  }
</style>
