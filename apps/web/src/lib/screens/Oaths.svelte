<!-- Swear Oaths to make runs harder. Heat (the sum of Oath levels) raises your score and rewards. -->
<script lang="ts">
  import { heat, MAX_HEAT, OATH_IDS, OATHS, type OathId } from '@lettermancer/engine';
  import { profile } from '../stores/profile.svelte';
  import Button from '../ui/Button.svelte';
  import Frame from '../ui/Frame.svelte';

  let { onclose, maxHeat = MAX_HEAT }: { onclose: () => void; maxHeat?: number } = $props();
  const meta = profile.meta;
  const total = $derived(heat(meta.oaths));

  function set(id: OathId, level: number) {
    const next = { ...meta.oaths, [id]: Math.max(0, Math.min(OATHS[id].max, level)) };
    if (heat(next) > maxHeat) return;
    meta.oaths = next;
    profile.saveMeta();
  }

  export function onKey(k: string): boolean {
    if (k === 'Escape' || k === 'Enter') {
      onclose();
      return true;
    }
    return false;
  }
</script>

<div class="scrim" role="dialog" aria-modal="true" aria-labelledby="oaths-title" data-screen="oaths">
  <Frame ornate>
    <div class="inner">
      <h2 id="oaths-title">Oaths</h2>
      <p class="intro">
        Swear Oaths to make your runs harder. Every level adds Heat, and Heat multiplies your score and what you earn.
        {#if maxHeat < MAX_HEAT}You can carry up to {maxHeat} Heat so far; win at your limit to raise it.{/if}
      </p>
      <ul>
        {#each OATH_IDS as id (id)}
          {@const o = OATHS[id]}
          {@const lvl = meta.oaths[id] ?? 0}
          <li class:sworn={lvl > 0}>
            <div class="text">
              <b>{o.name}</b>
              <span>{o.desc}</span>
            </div>
            <div class="stepper" role="group" aria-label="{o.name} level">
              <button type="button" onclick={() => set(id, lvl - 1)} disabled={lvl === 0} aria-label="Lower">−</button>
              <span class="pips">
                {#each Array(o.max) as _, i (i)}<i class:on={i < lvl}></i>{/each}
              </span>
              <button
                type="button"
                onclick={() => set(id, lvl + 1)}
                disabled={lvl === o.max || total >= maxHeat}
                aria-label="Raise">+</button
              >
            </div>
          </li>
        {/each}
      </ul>
      <p class="heat">Heat {total} <span>of {maxHeat}</span></p>
      <Button hotkey="Esc" onclick={onclose}>Done</Button>
    </div>
  </Frame>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 85;
    display: grid;
    /* safe: centered when it fits, top-aligned (and scrollable) when the window is too short */
    place-items: safe center;
    background: rgba(12, 9, 20, 0.82);
    backdrop-filter: blur(3px);
    overflow: auto;
  }
  .inner {
    width: min(58rem, 94vw);
    padding: var(--space-4) var(--space-6);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
  }
  h2 {
    font-size: var(--t-2xl);
    color: var(--rose);
  }
  .intro {
    color: var(--moon-dim);
    text-align: center;
    max-width: 56ch;
  }
  /* Two columns of Oaths, so all of them fit on one screen. */
  ul {
    width: 100%;
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2) var(--space-3);
  }
  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--rule);
  }
  li.sworn {
    border-color: color-mix(in oklab, var(--rose) 60%, var(--rule));
  }
  .text {
    display: flex;
    flex-direction: column;
  }
  b {
    font-family: var(--f-display);
    text-transform: var(--ui-case);
    letter-spacing: 0.03em;
  }
  .text span {
    font-size: var(--t-sm);
    color: var(--moon-dim);
  }
  .stepper {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .stepper button {
    width: 1.647rem;
    height: 1.647rem;
    background: var(--ink);
    border: 1px solid var(--rule);
    cursor: pointer;
  }
  .stepper button:disabled {
    opacity: 0.3;
    cursor: default;
  }
  .pips {
    display: flex;
    gap: 4px;
  }
  .pips i {
    width: 0.588rem;
    height: 0.588rem;
    transform: rotate(45deg);
    border: 1px solid var(--rose);
  }
  .pips i.on {
    background: var(--rose);
  }
  .heat {
    font-family: var(--f-display);
    text-transform: var(--ui-case);
    letter-spacing: 0.03em;
    font-weight: 700;
    font-size: var(--t-xl);
    color: var(--rose);
  }
  .heat span {
    font-size: var(--t-md);
    color: var(--moon-faint);
  }
</style>
