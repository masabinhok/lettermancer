<script lang="ts">
  import { letterShare, MAX_MODS_PER_KEY, MODS, WORDS } from '@keycraft/engine';
  import * as sfx from '../fx/audio';
  import { motesAt } from '../fx/particles';
  import type { Session } from '../game/session.svelte';
  import { profile } from '../stores/profile.svelte';
  import Button from '../ui/Button.svelte';
  import Hud from '../ui/Hud.svelte';
  import Keyboard from '../ui/Keyboard.svelte';

  let { session }: { session: Session } = $props();
  const v = $derived(session.view.kind === 'install' ? session.view : null);
  const run = $derived(session.machine.run);
  let wrap = $state<HTMLElement>();

  const share = letterShare(WORDS);
  const labels = Object.fromEntries(
    Object.entries(share).map(([k, s]) => [k, s < 0.01 ? '<1%' : `${Math.round(s * 100)}%`]),
  );

  function install(k: string) {
    if (!v) return;
    motesAt(wrap?.querySelector(`[data-key="${k}"]`), MODS[v.mod].color, 24);
    sfx.boon();
    session.install(k);
  }

  export function onKey(k: string): boolean {
    if (!v) return false;
    if (k === 'Escape') {
      session.install(null);
      return true;
    }
    if (/^[a-z]$/.test(k)) {
      install(k);
      return true;
    }
    return false;
  }
</script>

{#if v}
  {@const m = MODS[v.mod]}
  <div class="screen" data-screen="install" bind:this={wrap}>
    <Hud hp={run.hp} maxHp={run.maxHp} coins={run.coins} act={run.act} node={run.node} relics={run.relics} />
    <div class="body">
      <h1>Press the key that should carry <span style:color={m.color}>{m.glyph} {m.name}</span></h1>
      <p class="desc">{m.desc}</p>
      <Keyboard
        keyMods={run.keyMods}
        layout={profile.settings.layout}
        {labels}
        size="large"
        pickColor={m.color}
        onpick={install}
        fingerHints={profile.settings.fingerHints}
      />
      <p class="tip">
        The percentage on each key is how often that letter appears in enemy words. A key holds {MAX_MODS_PER_KEY} powers;
        a third replaces the oldest, and the same power twice stacks.
      </p>
      <Button kind="quiet" hotkey="Esc" onclick={() => session.install(null)}>Discard</Button>
    </div>
  </div>
{/if}

<style>
  .screen {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-4) var(--space-5);
  }
  .body {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-4);
  }
  h1 {
    font-size: var(--t-2xl);
    text-align: center;
  }
  .desc {
    color: var(--moon-dim);
  }
  .tip {
    max-width: 62ch;
    text-align: center;
    font-size: var(--t-sm);
    color: var(--moon-faint);
  }
</style>
