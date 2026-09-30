<script lang="ts">
  import '../app.css';
  import type { Snippet } from 'svelte';
  import { account } from '$lib/cloud/account.svelte';
  import { setVolumes } from '$lib/fx/audio';
  import { attachCanvas, setReducedMotion } from '$lib/fx/particles';
  import { profile } from '$lib/stores/profile.svelte';

  let { children }: { children: Snippet } = $props();
  let canvas: HTMLCanvasElement;

  const systemReduced = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  let systemPrefersReduced = $state(systemReduced?.matches ?? false);

  $effect(() => {
    const on = () => (systemPrefersReduced = systemReduced?.matches ?? false);
    systemReduced?.addEventListener('change', on);
    return () => systemReduced?.removeEventListener('change', on);
  });

  $effect(() => attachCanvas(canvas));
  $effect(() => account.start());

  // Apply settings everywhere, live.
  $effect(() => {
    const s = profile.settings;
    const reduced = s.reducedMotion === 'on' || (s.reducedMotion === 'system' && systemPrefersReduced);
    document.documentElement.dataset.reducedMotion = String(reduced);
    document.documentElement.style.setProperty('--font-scale', String(s.fontScale));
    setReducedMotion(reduced);
    setVolumes({ volume: s.volume, sfx: s.sfx, music: s.music });
  });
</script>

<canvas class="fx" bind:this={canvas} aria-hidden="true"></canvas>
<main>{@render children()}</main>

<style>
  .fx {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 70;
  }
  main {
    height: 100%;
  }
</style>
