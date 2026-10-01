<script lang="ts">
  import { BLESSINGS, isDuo, MODS, MUSES, RARITY_NAMES, RELICS, type Offer } from '@lettermancer/engine';
  import * as sfx from '../fx/audio';
  import { RARITY_COLOR } from '../game/look';
  import type { Session } from '../game/session.svelte';
  import Button from '../ui/Button.svelte';
  import Hud from '../ui/Hud.svelte';
  import Initial from '../ui/Initial.svelte';
  import OfferCard from '../ui/OfferCard.svelte';

  let { session, onbuild }: { session: Session; onbuild?: () => void } = $props();
  const v = $derived(session.view.kind === 'reward' ? session.view : null);
  const run = $derived(session.run);
  const muse = $derived(v?.muse ? MUSES[v.muse] : null);

  const lines = $derived.by(() => {
    const s = v?.summary;
    if (!s) return [];
    const out = [
      `${s.words} words at ${Math.round(s.wpm)} wpm, best combo ${s.maxCombo}.`,
      `You earned ${s.coins} coins.`,
    ];
    if (s.interest) out.push(`Interest paid ${s.interest} more.`);
    if (s.healed) out.push(`You recover ${s.healed} health.`);
    return out;
  });

  function card(o: Offer) {
    if (o.kind === 'power') {
      const m = MODS[o.mod];
      return {
        glyph: m.glyph,
        name: m.name,
        desc: m.describe(o.rarity),
        color: m.color,
        kind: `${RARITY_NAMES[o.rarity]} key power`,
        rarity: o.rarity,
        ornate: o.rarity >= 2,
      };
    }
    if (o.kind === 'blessing') {
      const b = BLESSINGS[o.id];
      const duo = isDuo(o.id);
      return {
        glyph: b.glyph,
        name: b.name,
        desc: b.desc,
        color: MUSES[b.muses[0]].color,
        kind: duo ? `Duo boon of ${b.muses.map((m) => MUSES[m].name).join(' and ')}` : 'Blessing',
        rarity: duo ? 3 : 1,
        ornate: duo,
      };
    }
    const r = RELICS[o.relic];
    return { glyph: r.glyph, name: r.name, desc: r.desc, color: 'var(--gold)', kind: 'Relic', rarity: 2, ornate: true };
  }

  function take(i: number) {
    sfx.boon();
    session.pick(i);
  }

  export function onKey(k: string): boolean {
    if (!v) return false;
    if (k === 'Enter') {
      session.pick(-1);
      return true;
    }
    if (k === 'r' && v.canReroll) {
      if (session.reroll()) sfx.select();
      return true;
    }
    const i = Number(k) - 1;
    if (i >= 0 && i < v.offers.length) {
      take(i);
      return true;
    }
    return false;
  }
</script>

{#if v}
  <div class="screen" data-screen="reward">
    <Hud hp={run.hp} maxHp={run.maxHp} coins={run.coins} act={run.act} room={run.room} relics={run.relics} {onbuild} />
    <div class="body">
      <header>
        {#if muse}
          <div class="muse">
            <Initial glyph={MODS[muse.mod].glyph} size={64} field="#2a1f3f" ink={muse.color} />
            <div>
              <h1 style:color={muse.color}>{muse.name} offers a boon</h1>
              <p class="sub">{muse.title}</p>
            </div>
          </div>
        {:else}
          <h1>{v.title}</h1>
        {/if}
        {#if v.summary?.perfect}<p class="perfect">A flawless fight — not a single typo.</p>{/if}
        {#if lines.length}<p class="lines">{lines.join(' ')}</p>{/if}
      </header>

      {#if v.offers.length}
        <div class="cards">
          {#each v.offers as o, i (i)}
            {@const c = card(o)}
            <OfferCard
              hotkey={String(i + 1)}
              glyph={c.glyph}
              name={c.name}
              desc={c.desc}
              color={c.color}
              kind={c.kind}
              ornate={c.ornate}
              rarityColor={RARITY_COLOR[c.rarity]}
              onselect={() => take(i)}
            />
          {/each}
        </div>
        <div class="actions">
          {#if v.canReroll}
            <Button kind="quiet" hotkey="R" onclick={() => session.reroll()}>Re-roll ({run.rerollsLeft} left)</Button>
          {/if}
          <Button kind="quiet" hotkey="Enter" onclick={() => session.pick(-1)}>Skip</Button>
        </div>
      {:else}
        <Button hotkey="Enter" onclick={() => session.pick(-1)}>Continue</Button>
      {/if}
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
    align-items: center;
    gap: var(--space-2);
  }
  .muse {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    text-align: left;
  }
  h1 {
    font-size: var(--t-3xl);
    color: var(--gold-bright);
  }
  .sub {
    color: var(--moon-dim);
  }
  .perfect {
    color: var(--witchfire);
    font-style: italic;
  }
  .lines {
    color: var(--moon-dim);
    max-width: 62ch;
  }
  .cards {
    display: flex;
    gap: var(--space-5);
    flex-wrap: wrap;
    justify-content: center;
  }
  .actions {
    display: flex;
    gap: var(--space-3);
  }
</style>
