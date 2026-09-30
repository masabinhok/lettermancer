<script lang="ts">
  import { letterShare, MAX_MODS_PER_KEY, MODS, RARITY_NAMES, WORDS } from '@keycraft/engine';
  import { RARITY_COLOR } from '../game/look';
  import * as sfx from '../fx/audio';
  import { motesAt } from '../fx/particles';
  import type { Session } from '../game/session.svelte';
  import { profile } from '../stores/profile.svelte';
  import Button from '../ui/Button.svelte';
  import Hud from '../ui/Hud.svelte';
  import Keyboard from '../ui/Keyboard.svelte';

  let { session, onbuild }: { session: Session; onbuild?: () => void } = $props();
  const v = $derived(session.view.kind === 'install' ? session.view : null);
  const run = $derived(session.run);
  let wrap = $state<HTMLElement>();

  const share = letterShare(WORDS);
  // Which letters your recent enemies actually used — a better guide than the dictionary average.
  const recent = (() => {
    const counts: Record<string, number> = {};
    for (const w of session.recentWords) for (const ch of w) if (/[a-z]/.test(ch)) counts[ch] = (counts[ch] ?? 0) + 1;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  })();
  const labels = Object.fromEntries(
    Object.entries(share).map(([k, s]) => [k, s < 0.01 ? '<1%' : `${Math.round(s * 100)}%`]),
  );

  function install(k: string) {
    if (!v) return;
    motesAt(wrap?.querySelector(`[data-key="${k}"]`), MODS[v.mod.mod].color, 24);
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
  {@const m = MODS[v.mod.mod]}
  {@const already = Object.entries(run.keyMods)
    .filter(([, b]) => b.some((x) => x.mod === v.mod.mod))
    .map(([k]) => k.toUpperCase())}
  <div class="screen" data-screen="install" bind:this={wrap}>
    <Hud hp={run.hp} maxHp={run.maxHp} coins={run.coins} act={run.act} room={run.room} relics={run.relics} {onbuild} />
    <div class="body">
      <h1>Press the key that should carry <span style:color={m.color}>{m.glyph} {m.name}</span></h1>
      <p class="desc">
        <span style:color={RARITY_COLOR[v.mod.rarity]}>{RARITY_NAMES[v.mod.rarity]}.</span>
        {m.describe(v.mod.rarity)}
      </p>
      {#if already.length}<p class="desc">
          Press {already.join(' or ')} to make that {m.name} one rarity stronger instead.
        </p>{/if}
      <Keyboard
        keyMods={run.keyMods}
        layout={profile.settings.layout}
        {labels}
        size="large"
        pickColor={m.color}
        onpick={install}
        fingerHints={profile.settings.fingerHints}
      />
      {#if recent.length && session.recentWords.length >= 8}
        <p class="recent">
          In your last {session.recentWords.length} words:
          {#each recent as [k, n], i (k)}<span
              ><kbd>{k.toUpperCase()}</kbd> {n} time{n === 1 ? '' : 's'}{i < recent.length - 1 ? ', ' : ''}</span
            >{/each}
        </p>
      {/if}
      <p class="tip">
        The percentage on each key is how often that letter appears in enemy words. A key holds {MAX_MODS_PER_KEY} powers;
        a third replaces the oldest.
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
  .recent {
    color: var(--moon-dim);
    font-size: var(--t-sm);
  }
  .tip {
    max-width: 62ch;
    text-align: center;
    font-size: var(--t-sm);
    color: var(--moon-faint);
  }
</style>
