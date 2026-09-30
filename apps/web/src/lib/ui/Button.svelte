<script lang="ts">
  import type { Snippet } from 'svelte';
  let {
    kind = 'primary',
    hotkey = null,
    disabled = false,
    onclick,
    children,
  }: {
    kind?: 'primary' | 'quiet';
    hotkey?: string | null;
    disabled?: boolean;
    onclick?: () => void;
    children: Snippet;
  } = $props();
</script>

<button class="btn {kind}" {disabled} {onclick} type="button">
  {@render children()}
  {#if hotkey}<kbd>{hotkey}</kbd>{/if}
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-3);
    padding: 10px 20px;
    border-radius: 2px;
    cursor: pointer;
    font-family: var(--f-display);
    font-weight: 600;
    font-size: var(--t-md);
    letter-spacing: 0.04em;
    transition:
      background var(--dur-fast),
      border-color var(--dur-fast),
      box-shadow var(--dur-fast);
  }
  .primary {
    background: linear-gradient(180deg, #e7c678, var(--gold) 55%, #b58f3e);
    color: #1b1206;
    border: 1px solid var(--gold-bright);
    box-shadow: 0 6px 20px -8px rgba(217, 180, 91, 0.7);
  }
  .primary:hover:not(:disabled) {
    box-shadow: 0 6px 28px -4px rgba(217, 180, 91, 0.9);
  }
  .primary kbd {
    background: rgba(0, 0, 0, 0.15);
    border-color: rgba(0, 0, 0, 0.3);
    color: #1b1206;
  }
  .quiet {
    background: transparent;
    color: var(--moon-dim);
    border: 1px solid var(--rule);
  }
  .quiet:hover:not(:disabled) {
    color: var(--moon);
    border-color: var(--moon-faint);
  }
  .btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
