<!-- Your whole build at a glance: every key's powers and every relic, with what they do. -->
<script lang="ts">
  import { MODS, RELICS, type KeyMods, type ModId, type RelicId } from '@keycraft/engine';
  import { profile } from '../stores/profile.svelte';
  import Button from '../ui/Button.svelte';
  import Frame from '../ui/Frame.svelte';
  import Keyboard from '../ui/Keyboard.svelte';

  let { keyMods, relics, onclose }: { keyMods: KeyMods; relics: RelicId[]; onclose: () => void } = $props();

  const keys = $derived(
    Object.entries(keyMods)
      .filter(([, m]) => m.length)
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  const count = (mods: ModId[]) => {
    const c: Partial<Record<ModId, number>> = {};
    for (const m of mods) c[m] = (c[m] ?? 0) + 1;
    return Object.entries(c) as [ModId, number][];
  };

  export function onKey(k: string): boolean {
    if (k === 'Escape' || k === 'b' || k === 'Enter') {
      onclose();
      return true;
    }
    return false;
  }
</script>

<div class="scrim" role="dialog" aria-modal="true" aria-labelledby="build-title" data-screen="build">
  <Frame ornate>
    <div class="inner">
      <h2 id="build-title">Your build</h2>
      <Keyboard {keyMods} layout={profile.settings.layout} size="full" />
      <div class="cols">
        <section>
          <h3>Key powers</h3>
          {#if keys.length}
            <ul>
              {#each keys as [k, mods] (k)}
                <li>
                  <kbd>{k.toUpperCase()}</kbd>
                  <span>
                    {#each count(mods) as [m, n] (m)}
                      <span class="power"
                        ><b style:color={MODS[m].color}>{MODS[m].glyph} {MODS[m].name}{n > 1 ? ` ×${n}` : ''}</b>
                        {MODS[m].desc}</span
                      >
                    {/each}
                  </span>
                </li>
              {/each}
            </ul>
          {:else}
            <p class="empty">No powers yet. Win a fight to bind one to a key.</p>
          {/if}
        </section>
        <section>
          <h3>Relics</h3>
          {#if relics.length}
            <ul>
              {#each relics as r (r)}
                <li>
                  <span class="rglyph">{RELICS[r].glyph}</span><span><b>{RELICS[r].name}</b> {RELICS[r].desc}</span>
                </li>
              {/each}
            </ul>
          {:else}
            <p class="empty">No relics yet. Elites and bosses drop them, and shops sell them.</p>
          {/if}
        </section>
      </div>
      <Button hotkey="Esc" onclick={onclose}>Close</Button>
    </div>
  </Frame>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 82;
    display: grid;
    place-items: center;
    background: rgba(12, 9, 20, 0.82);
    backdrop-filter: blur(3px);
    overflow: auto;
  }
  .inner {
    width: min(900px, 94vw);
    max-height: 92vh;
    overflow: auto;
    padding: var(--space-5) var(--space-6);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
  }
  h2 {
    font-size: var(--t-2xl);
    color: var(--gold-bright);
  }
  .cols {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-6);
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
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  li {
    display: grid;
    grid-template-columns: 2.2em 1fr;
    gap: var(--space-3);
    align-items: baseline;
    font-size: var(--t-sm);
    color: var(--moon-dim);
  }
  .power {
    display: block;
  }
  b {
    color: var(--moon);
    font-weight: 700;
  }
  .rglyph {
    font-family: var(--f-glyph);
    color: var(--gold-bright);
    font-size: 1.2rem;
    text-align: center;
  }
  .empty {
    color: var(--moon-faint);
    font-size: var(--t-sm);
  }
</style>
