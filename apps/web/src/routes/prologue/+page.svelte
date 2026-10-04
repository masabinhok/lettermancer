<script lang="ts">
  import { COMBO_TIERS, installMod, MODS, type CombatEvent } from '@lettermancer/engine';
  import { onMount } from 'svelte';
  import * as sfx from '$lib/fx/audio';
  import { burstAt, floatText, motesAt, shake } from '$lib/fx/particles';
  import { PrologueFight, STEPS } from '$lib/game/prologue';
  import { combatSnapshot, type CombatSnap } from '$lib/game/snapshot';
  import { nav } from '$lib/nav';
  import { profile } from '$lib/stores/profile.svelte';
  import Button from '$lib/ui/Button.svelte';
  import EnemyCard from '$lib/ui/EnemyCard.svelte';
  import Frame from '$lib/ui/Frame.svelte';
  import Keyboard from '$lib/ui/Keyboard.svelte';
  import OfferCard from '$lib/ui/OfferCard.svelte';

  const fight = new PrologueFight();
  let index = $state(0);
  let snap = $state.raw<CombatSnap | null>(null);
  let done = $state(false);
  let praise = $state<string | null>(null);
  let keyMods = $state.raw(fight.run.keyMods);
  let stage = $state<HTMLElement>();
  let kb = $state<ReturnType<typeof Keyboard>>();
  let start = 0;

  const step = $derived(STEPS[index]);
  const finished = $derived(index >= STEPS.length);

  function begin(i: number) {
    index = i;
    praise = null;
    done = false;
    if (i >= STEPS.length) {
      fight.combat = null;
      snap = null;
      return;
    }
    fight.start(STEPS[i]);
    start = performance.now();
    refresh();
  }

  function refresh() {
    snap = fight.combat ? combatSnapshot(fight.combat, fight.run) : null;
  }

  function complete() {
    if (done) return;
    done = true;
    praise = step.praise;
    sfx.boon();
    setTimeout(() => begin(index + 1), 1400);
  }

  function check() {
    const c = fight.combat;
    if (!c || done || finished) return;
    if (step.goal === 'kill' && c.over === 'win') complete();
    if (step.goal === 'combo' && c.combo >= COMBO_TIERS[1].at) complete();
  }

  const enemyEl = (id: number) => stage?.querySelector(`[data-enemy="${id}"]`);

  function fx(events: CombatEvent[]) {
    for (const ev of events) {
      if (ev.t === 'key-ok') {
        kb?.flash(ev.key, true);
        sfx.keyClick(fight.combat?.combo ?? 0);
      } else if (ev.t === 'key-miss') {
        kb?.flash(ev.key, false);
        sfx.miss();
      } else if (ev.t === 'hit') {
        sfx.hit(ev.crit);
        floatText(enemyEl(ev.enemyId), String(ev.dmg), 'ft-dmg');
        burstAt(enemyEl(ev.enemyId)?.querySelector('.portrait'), '#ddd7ea', 16);
      } else if (ev.t === 'burn') {
        floatText(enemyEl(ev.enemyId), String(ev.dmg), 'ft-burn');
      } else if (ev.t === 'kill') {
        sfx.kill();
        burstAt(enemyEl(ev.enemyId)?.querySelector('.portrait'), '#f3d98c', 40, 360);
      } else if (ev.t === 'player-hit') {
        sfx.hurt();
        shake(stage ?? null, 'big');
      } else if (ev.t === 'combo-tier') {
        sfx.tierUp(ev.tier);
        floatText(stage?.querySelector('.combo'), `×${COMBO_TIERS[ev.tier].mult}`, 'ft-combo');
      }
    }
  }

  function finish() {
    profile.meta.prologueDone = true;
    profile.saveMeta();
    nav('/run?starter=apprentice');
  }

  function skip() {
    profile.meta.prologueDone = true;
    profile.saveMeta();
    nav('/');
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === 'Escape') skip();
    else if (finished) {
      if (k === 'Enter') finish();
    } else if (done) {
      // wait for the next step
    } else if (step.goal === 'install') {
      if (k === 'e') {
        fight.run.keyMods = installMod(fight.run.keyMods, 'e', step.mod!).keyMods;
        keyMods = fight.run.keyMods;
        motesAt(stage?.querySelector('[data-key="e"]'), MODS.ember.color, 30);
        complete();
      } else if (/^[a-z]$/.test(k)) {
        kb?.flash(k, false);
        floatText(stage?.querySelector('.keyboard'), 'Press E for this one', 'ft-bad');
      }
    } else if (k === 'Tab') fight.untarget();
    else if (k === 'Backspace') fight.backspace();
    else if (/^[a-z]$/.test(k)) {
      fx(fight.key(k, Math.round(performance.now() - start)));
      check();
    } else return;
    e.preventDefault();
    refresh();
  }

  onMount(() => {
    begin(0);
    let raf = 0;
    const frame = () => {
      if (!done && fight.combat && document.hasFocus()) {
        fx(fight.advance(Math.round(performance.now() - start)));
        check();
        refresh();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  });
</script>

<svelte:window {onkeydown} />
<svelte:head><title>Learn to play · Lettermancer</title></svelte:head>

<div class="prologue" data-screen="prologue" bind:this={stage}>
  <Frame ornate class="coach">
    <div class="coach-inner">
      {#if finished}
        <h1>You're ready</h1>
        <p>
          Each run is three acts of fights, shops and a boss. The game quietly feeds you more of the keys you're slowest
          at, so every run makes your hands a little better.
        </p>
        <Button hotkey="Enter" onclick={finish}>Start your first run</Button>
      {:else}
        <p class="count">Step {index + 1} of {STEPS.length}</p>
        <h1>{step.title}</h1>
        <p class:praise={!!praise}>{praise ?? step.coach}</p>
      {/if}
    </div>
  </Frame>

  {#if !finished}
    <section class="field">
      {#if step.goal === 'install' && !done}
        <OfferCard
          hotkey="E"
          glyph={MODS.ember.glyph}
          name={MODS.ember.name}
          desc={MODS.ember.describe(0)}
          color={MODS.ember.color}
          kind="Your first power"
          onselect={() => onkeydown(new KeyboardEvent('keydown', { key: 'e' }))}
        />
      {/if}
      {#each snap?.enemies ?? [] as e (e.id)}
        <EnemyCard {e} />
      {/each}
    </section>

    {#if snap}
      <p class="combo" class:lit={step.goal === 'combo'}>
        <span class="mult">×{snap.mult}</span>
        <span>{snap.combo} combo</span>
      </p>
    {/if}

    <Keyboard
      bind:this={kb}
      {keyMods}
      layout={profile.settings.layout}
      next={step.goal === 'install' ? 'e' : (snap?.nextKey ?? null)}
      fingerHints={profile.settings.fingerHints}
      size={step.goal === 'install' ? 'large' : 'compact'}
    />
  {/if}

  <p class="skip"><kbd>Esc</kbd> skip the tutorial</p>
</div>

<style>
  .prologue {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-4) var(--space-5);
  }
  .prologue :global(.coach) {
    width: min(42.353rem, 100%);
  }
  .coach-inner {
    padding: var(--space-3) var(--space-6);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    text-align: center;
  }
  .count {
    font-size: var(--t-sm);
    color: var(--moon-faint);
  }
  h1 {
    font-size: var(--t-2xl);
    color: var(--gold-bright);
  }
  .coach-inner p {
    max-width: 64ch;
    color: var(--moon);
    font-size: var(--t-md);
  }
  .coach-inner p.praise {
    color: var(--witchfire);
  }
  .field {
    flex: 1;
    min-height: 0;
    display: flex;
    gap: var(--space-6);
    align-items: center;
    justify-content: center;
  }
  .combo {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    color: var(--moon-dim);
    padding: 2px var(--space-4);
    border: 1px solid transparent;
  }
  .combo.lit {
    border-color: var(--gold-deep);
    color: var(--moon);
  }
  .mult {
    font-family: var(--f-display);
    font-weight: 700;
    font-size: var(--t-2xl);
  }
  .skip {
    font-size: var(--t-xs);
    color: var(--moon-faint);
  }
</style>
