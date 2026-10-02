<script lang="ts">
  import { MODS, RARITY_NAMES, RELICS, REROLL_BASE } from '@lettermancer/engine';
  import { RARITY_COLOR } from '../game/look';
  import * as sfx from '../fx/audio';
  import { burstAt, floatText } from '../fx/particles';
  import type { Session } from '../game/session.svelte';
  import Button from '../ui/Button.svelte';
  import Hud from '../ui/Hud.svelte';
  import OfferCard from '../ui/OfferCard.svelte';

  let { session, onbuild }: { session: Session; onbuild?: () => void } = $props();
  const v = $derived(session.view.kind === 'shop' ? session.view : null);
  const run = $derived(session.run);
  const rerollCost = $derived(REROLL_BASE + (v?.rerolls ?? 0));
  let root = $state<HTMLElement>();

  function buy(i: number) {
    const card = root?.querySelectorAll('.card')[order.indexOf(i)];
    if (session.buy(i)) {
      sfx.purchase();
      burstAt(card, '#e9c46a', 36, 340);
      card?.animate(
        [
          { transform: 'scale(1.08)', filter: 'brightness(1.8)' },
          { transform: 'scale(1)', filter: 'brightness(1)' },
        ],
        { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' },
      );
    } else deny();
  }

  /** Items in the order their cards appear on screen (grouped by kind). */
  const GROUPS = ['mod', 'relic', 'heal'] as const;
  const order = $derived(v ? GROUPS.flatMap((g) => v.items.flatMap((it, i) => (it.kind === g ? [i] : []))) : []);

  function reroll() {
    if (session.reroll()) sfx.select();
    else deny();
  }

  function deny() {
    sfx.miss();
    floatText(root?.querySelector('.hud .coins'), 'Not enough coins', 'ft-bad');
  }

  export function onKey(k: string): boolean {
    if (!v) return false;
    if (k === 'Enter') {
      session.leave();
      return true;
    }
    if (k === '0') {
      reroll();
      return true;
    }
    const i = Number(k) - 1;
    if (i >= 0 && i < v.items.length) {
      buy(i);
      return true;
    }
    return false;
  }
</script>

{#if v}
  <div class="screen" data-screen="shop" bind:this={root}>
    <Hud hp={run.hp} maxHp={run.maxHp} coins={run.coins} act={run.act} room={run.room} relics={run.relics} {onbuild} />
    <div class="body">
      <header>
        <h1>The Type Foundry</h1>
        <p>Spend your coins. What you don't buy is gone when you leave.</p>
      </header>

      <div class="groups">
        {#each [{ title: 'Key powers', kind: 'mod' }, { title: 'Relics', kind: 'relic' }, { title: 'Services', kind: 'heal' }] as g (g.kind)}
          <section>
            <h2>{g.title}</h2>
            <div class="row">
              {#each v.items as it, i (i)}
                {#if it.kind === g.kind}
                  {#if it.kind === 'mod'}
                    <OfferCard
                      hotkey={String(i + 1)}
                      glyph={MODS[it.mod].glyph}
                      name={MODS[it.mod].name}
                      desc={MODS[it.mod].describe(it.rarity)}
                      color={MODS[it.mod].color}
                      kind="{RARITY_NAMES[it.rarity]} key power"
                      rarityColor={RARITY_COLOR[it.rarity]}
                      tier={it.rarity}
                      index={order.indexOf(i)}
                      cost={it.cost}
                      sold={it.sold}
                      affordable={it.cost <= run.coins}
                      onselect={() => buy(i)}
                    />
                  {:else if it.kind === 'relic'}
                    <OfferCard
                      hotkey={String(i + 1)}
                      glyph={RELICS[it.relic].glyph}
                      name={RELICS[it.relic].name}
                      desc={RELICS[it.relic].desc}
                      kind="Relic"
                      ornate
                      tier={2}
                      index={order.indexOf(i)}
                      cost={it.cost}
                      sold={it.sold}
                      affordable={it.cost <= run.coins}
                      onselect={() => buy(i)}
                    />
                  {:else}
                    <OfferCard
                      hotkey={String(i + 1)}
                      glyph="✚"
                      name="Mend"
                      desc="Restore {it.amount} health."
                      color="var(--witchfire)"
                      kind="Service"
                      index={order.indexOf(i)}
                      cost={it.cost}
                      sold={it.sold}
                      affordable={it.cost <= run.coins}
                      onselect={() => buy(i)}
                    />
                  {/if}
                {/if}
              {/each}
            </div>
          </section>
        {/each}
      </div>

      <div class="actions">
        <Button kind="quiet" hotkey="0" onclick={reroll} disabled={run.coins < rerollCost}
          >Restock for {rerollCost} coins</Button
        >
        <Button hotkey="Enter" onclick={() => session.leave()}>Leave the shop</Button>
      </div>
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
    overflow: auto;
  }
  .body {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-4);
  }
  header {
    text-align: center;
  }
  h1 {
    font-size: var(--t-3xl);
    color: var(--gold-bright);
  }
  header p {
    color: var(--moon-dim);
    margin-top: var(--space-1);
  }
  h2 {
    font-size: var(--t-md);
    color: var(--moon-dim);
    margin-bottom: var(--space-2);
  }
  .groups {
    display: flex;
    gap: var(--space-6);
    align-items: flex-start;
    justify-content: center;
    flex-wrap: wrap;
  }
  section {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }
  .row {
    display: flex;
    gap: var(--space-3);
  }
  /* Seven wares on one screen: narrower cards, smaller medallions. */
  .row :global(.card) {
    width: 9.4rem;
    min-height: 14.5rem;
    padding: var(--space-5) var(--space-3) var(--space-3);
  }
  .row :global(.card .name) {
    font-size: var(--t-lg);
  }
  .row :global(.card .desc) {
    font-size: var(--t-sm);
  }
  .row :global(.card .sigil .emblem) {
    --size: 3.6rem !important;
  }
  .actions {
    display: flex;
    gap: var(--space-4);
  }
</style>
