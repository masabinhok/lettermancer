<!-- A modal station panel: ornate frame, title, scrollable body, closes on Esc (handled by the page). -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import Button from './Button.svelte';
  import Frame from './Frame.svelte';

  let {
    title,
    subtitle = null,
    width = 820,
    screen,
    onclose,
    children,
  }: {
    title: string;
    subtitle?: string | null;
    width?: number;
    screen: string;
    onclose: () => void;
    children: Snippet;
  } = $props();
</script>

<div class="scrim" role="dialog" aria-modal="true" aria-label={title} data-screen={screen}>
  <Frame ornate>
    <div class="inner" style:width="min({width / 17}rem, 94vw)">
      <header>
        <h2>{title}</h2>
        {#if subtitle}<p>{subtitle}</p>{/if}
      </header>
      <div class="body">{@render children()}</div>
      <Button kind="quiet" hotkey="Esc" onclick={onclose}>Close</Button>
    </div>
  </Frame>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 84;
    display: grid;
    place-items: center;
    background: rgba(12, 9, 20, 0.84);
    backdrop-filter: blur(3px);
    animation: in 0.2s var(--ease-out);
  }
  @keyframes in {
    from {
      opacity: 0;
    }
  }
  .inner {
    max-height: 90vh;
    padding: var(--space-5) var(--space-6);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
  }
  header {
    text-align: center;
  }
  h2 {
    font-size: var(--t-2xl);
    color: var(--gold-bright);
  }
  header p {
    color: var(--moon-dim);
    margin-top: var(--space-1);
    max-width: 60ch;
  }
  .body {
    width: 100%;
    overflow: auto;
    min-height: 0;
  }
</style>
