<script lang="ts">
  import { MODS, RELICS } from '@keycraft/engine';
  import type { Session } from '../game/session.svelte';
  import Button from '../ui/Button.svelte';
  import Hud from '../ui/Hud.svelte';
  import OfferCard from '../ui/OfferCard.svelte';

  let { session, onbuild }: { session: Session; onbuild?: () => void } = $props();
  const v = $derived(session.view.kind === 'reward' ? session.view : null);
  const run = $derived(session.machine.run);

  const title = $derived(
    v?.summary.node === 'boss' ? 'The boss falls' : v?.summary.node === 'elite' ? 'Elite slain' : 'Victory',
  );
  const lines = $derived.by(() => {
    if (!v) return [];
    const s = v.summary;
    const out = [
      `${s.words} words at ${Math.round(s.wpm)} wpm, best combo ${s.maxCombo}.`,
      `You earned ${s.coins} coins.`,
    ];
    if (s.interest) out.push(`Interest paid ${s.interest} more.`);
    if (s.healed) out.push(`You recover ${s.healed} health.`);
    return out;
  });

  export function onKey(k: string): boolean {
    if (!v) return false;
    if (k === 'Enter') {
      session.pick(-1);
      return true;
    }
    const i = Number(k) - 1;
    const offers = v.stage === 'relic' ? v.reward.relics : v.reward.mods;
    if (i >= 0 && i < offers.length) {
      session.pick(i);
      return true;
    }
    return false;
  }
</script>

{#if v}
  <div class="screen" data-screen="reward">
    <Hud hp={run.hp} maxHp={run.maxHp} coins={run.coins} act={run.act} node={run.node} relics={run.relics} {onbuild} />
    <div class="body">
      <header>
        <h1>{title}</h1>
        {#if v.summary.perfect}<p class="perfect">A flawless fight — not a single typo.</p>{/if}
        <p class="lines">{lines.join(' ')}</p>
      </header>

      {#if v.stage === 'relic'}
        <h2>Choose a relic</h2>
        <div class="cards">
          {#each v.reward.relics as r, i (r)}
            <OfferCard
              hotkey={String(i + 1)}
              glyph={RELICS[r].glyph}
              name={RELICS[r].name}
              desc={RELICS[r].desc}
              kind="Relic, lasts the whole run"
              ornate
              onselect={() => session.pick(i)}
            />
          {/each}
        </div>
      {:else}
        <h2>Choose a power for one of your keys</h2>
        <div class="cards">
          {#each v.reward.mods as m, i (m)}
            <OfferCard
              hotkey={String(i + 1)}
              glyph={MODS[m].glyph}
              name={MODS[m].name}
              desc={MODS[m].desc}
              color={MODS[m].color}
              kind="Key power"
              onselect={() => session.pick(i)}
            />
          {/each}
        </div>
      {/if}
      <Button kind="quiet" hotkey="Enter" onclick={() => session.pick(-1)}>Skip</Button>
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
    gap: var(--space-5);
  }
  header {
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  h1 {
    font-size: var(--t-3xl);
    color: var(--gold-bright);
  }
  h2 {
    font-size: var(--t-lg);
    color: var(--moon);
  }
  .perfect {
    color: var(--witchfire);
    font-style: italic;
  }
  .lines {
    color: var(--moon-dim);
    max-width: 60ch;
  }
  .cards {
    display: flex;
    gap: var(--space-5);
    flex-wrap: wrap;
    justify-content: center;
  }
</style>
