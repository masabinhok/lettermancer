<script lang="ts">
  import { MODS, RELICS, REROLL_BASE } from '@keycraft/engine';
  import * as sfx from '../fx/audio';
  import { floatText } from '../fx/particles';
  import type { Session } from '../game/session.svelte';
  import Button from '../ui/Button.svelte';
  import Hud from '../ui/Hud.svelte';
  import OfferCard from '../ui/OfferCard.svelte';

  let { session }: { session: Session } = $props();
  const v = $derived(session.view.kind === 'shop' ? session.view : null);
  const run = $derived(session.machine.run);
  const rerollCost = $derived(REROLL_BASE + (v?.rerolls ?? 0));
  let root = $state<HTMLElement>();

  function buy(i: number) {
    if (session.buy(i)) sfx.coin();
    else deny();
  }

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
    <Hud hp={run.hp} maxHp={run.maxHp} coins={run.coins} act={run.act} node={run.node} relics={run.relics} />
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
                      desc={MODS[it.mod].desc}
                      color={MODS[it.mod].color}
                      kind="Key power"
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
    font-size: var(--t-2xl);
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
  .row :global(.card) {
    width: 150px;
    min-height: 236px;
    padding: var(--space-5) var(--space-3) var(--space-3);
  }
  .row :global(.card .name) {
    font-size: var(--t-md);
  }
  .row :global(.card .sigil) {
    width: 52px;
    height: 52px;
    font-size: 1.7rem;
  }
  .actions {
    display: flex;
    gap: var(--space-4);
  }
</style>
