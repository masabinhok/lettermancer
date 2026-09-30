<script lang="ts">
  import Button from '../ui/Button.svelte';
  import Frame from '../ui/Frame.svelte';

  let {
    onresume,
    onsettings,
    onbuild,
    onabandon,
  }: { onresume: () => void; onsettings: () => void; onbuild: () => void; onabandon: () => void } = $props();
  let confirming = $state(false);

  export function onKey(k: string): boolean {
    if (k === 'Escape' || k === 'Enter') {
      if (confirming && k === 'Enter') onabandon();
      else if (confirming) confirming = false;
      else onresume();
      return true;
    }
    return false;
  }
</script>

<div class="scrim" data-screen="pause" role="dialog" aria-modal="true" aria-labelledby="pause-title">
  <Frame ornate class="panel">
    <div class="inner">
      <h2 id="pause-title">Paused</h2>
      <p>The ink is still wet. Take your time.</p>
      {#if confirming}
        <p class="warn">Abandon this run? It counts as a loss.</p>
        <div class="stack">
          <Button hotkey="Enter" onclick={onabandon}>Abandon run</Button>
          <Button kind="quiet" hotkey="Esc" onclick={() => (confirming = false)}>Keep playing</Button>
        </div>
      {:else}
        <div class="stack">
          <Button hotkey="Esc" onclick={onresume}>Resume</Button>
          <Button kind="quiet" onclick={onbuild}>Your build</Button>
          <Button kind="quiet" onclick={onsettings}>Settings</Button>
          <Button kind="quiet" onclick={() => (confirming = true)}>Abandon run</Button>
        </div>
      {/if}
    </div>
  </Frame>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 80;
    display: grid;
    place-items: center;
    background: rgba(12, 9, 20, 0.78);
    backdrop-filter: blur(3px);
  }
  .inner {
    padding: var(--space-6) var(--space-7);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
    text-align: center;
  }
  h2 {
    font-size: var(--t-2xl);
    color: var(--gold-bright);
  }
  p {
    color: var(--moon-dim);
  }
  .warn {
    color: var(--rose);
  }
  .stack {
    margin-top: var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 220px;
  }
</style>
