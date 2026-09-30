<!-- An ink panel. With `ornate`, it gets gold corner flourishes — reserve that for things that matter. -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import Corner from './Corner.svelte';

  let {
    ornate = false,
    glow = null,
    class: cls = '',
    children,
  }: { ornate?: boolean; glow?: string | null; class?: string; children: Snippet } = $props();
</script>

<div class="frame {cls}" class:ornate style:--glow={glow}>
  {#if ornate}
    <Corner pos="tl" /><Corner pos="tr" /><Corner pos="bl" /><Corner pos="br" />
  {/if}
  {@render children()}
</div>

<style>
  .frame {
    position: relative;
    background: linear-gradient(180deg, var(--ink-2), var(--ink) 70%);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.04),
      0 18px 40px -20px rgba(0, 0, 0, 0.8);
  }
  .ornate {
    border-color: var(--gold-deep);
    border-radius: 2px;
  }
  .frame[style*='--glow'] {
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.04),
      0 0 0 1px var(--glow),
      0 0 32px -6px var(--glow);
  }
</style>
