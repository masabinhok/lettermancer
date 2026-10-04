<!--
  Someone speaking: their name in the chiseled speaker face (gold, left-aligned), sitting on top of a
  translucent, angular charcoal box that holds the line in clean white text.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  /** Leave `speaker` out when the name is already shown nearby (a muse's name above her greeting). */
  let { speaker = null, children }: { speaker?: string | null; children: Snippet } = $props();
</script>

<figure class="dialogue">
  {#if speaker}<figcaption class="speaker">{speaker}</figcaption>{/if}
  <div class="box">
    {@render children()}
  </div>
</figure>

<style>
  .dialogue {
    margin: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    min-width: 0;
  }
  .speaker {
    position: relative;
    z-index: 1;
    margin: 0 0 -0.35em var(--space-4);
    font-family: var(--f-speaker);
    font-size: var(--t-xl);
    line-height: 1;
    letter-spacing: 0.04em;
    color: var(--gold-bright);
    text-shadow:
      0 2px 0 rgba(0, 0, 0, 0.85),
      0 0 18px rgba(0, 0, 0, 0.6);
  }
  /* Cut corners at top-left and bottom-right: an angular scroll rather than a soft card. */
  .box {
    align-self: stretch;
    padding: var(--space-4) var(--space-5) var(--space-4);
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 40%), rgba(16, 14, 22, 0.78);
    box-shadow:
      inset 0 0 0 1px rgba(230, 161, 0, 0.28),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
    clip-path: polygon(0.9rem 0, 100% 0, 100% calc(100% - 0.9rem), calc(100% - 0.9rem) 100%, 0 100%, 0 0.9rem);
    font-family: var(--f-text);
    color: #ffffff;
    line-height: 1.5;
  }
</style>
