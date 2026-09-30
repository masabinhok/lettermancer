<!-- A choice card for boons, relics and shop items. Rarer offers get the ornate gold frame. -->
<script lang="ts">
  import Corner from './Corner.svelte';

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
    onselect: () => void;
  } = $props();
</script>

<button
  class="card"
  class:ornate
  class:sold
  class:poor={!affordable}
  style:--c={color}
  onclick={onselect}
  disabled={sold}
  type="button"
>
  {#if ornate}<Corner pos="tl" size={20} /><Corner pos="tr" size={20} /><Corner pos="bl" size={20} /><Corner
      pos="br"
      size={20}
    />{/if}
  <kbd class="hk">{hotkey}</kbd>
  <span class="sigil" aria-hidden="true">{glyph}</span>
  <span class="kind">{kind}</span>
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
    width: 208px;
    min-height: 250px;
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
    width: 64px;
    height: 64px;
    display: grid;
    place-items: center;
    margin-top: var(--space-2);
    border-radius: 50%;
    font-family: var(--f-glyph);
    font-size: 2.1rem;
    color: var(--c);
    background: radial-gradient(circle, color-mix(in oklab, var(--c) 22%, transparent), transparent 70%);
    border: 1px solid color-mix(in oklab, var(--c) 50%, transparent);
  }
  .kind {
    font-size: var(--t-xs);
    color: var(--moon-faint);
  }
  .name {
    font-family: var(--f-display);
    font-weight: 700;
    font-size: var(--t-lg);
    color: var(--c);
    line-height: 1.1;
  }
  .desc {
    font-size: var(--t-sm);
    color: var(--moon-dim);
    line-height: 1.35;
  }
  .detail {
    font-size: var(--t-xs);
    color: var(--moon-faint);
    font-style: italic;
  }
  .cost {
    margin-top: auto;
    font-weight: 700;
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
