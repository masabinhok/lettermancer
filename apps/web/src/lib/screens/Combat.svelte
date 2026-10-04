<script lang="ts">
  import { COMBO_TIERS, MODS, type MachineEvent } from '@lettermancer/engine';
  import { onMount } from 'svelte';
  import * as sfx from '../fx/audio';
  import { banner, hitStop, punch, shatter, slash } from '../fx/impact';
  import { burstAt, floatText, motesAt, shake } from '../fx/particles';
  import type { Session } from '../game/session.svelte';
  import { profile } from '../stores/profile.svelte';
  import EnemyCard from '../ui/EnemyCard.svelte';
  import Hud from '../ui/Hud.svelte';
  import Keyboard from '../ui/Keyboard.svelte';

  let { session, onbuild }: { session: Session; onbuild?: () => void } = $props();

  let stage: HTMLElement;
  let comboEl: HTMLElement;
  let kb = $state<ReturnType<typeof Keyboard>>();
  let flashKind = $state<'hurt' | 'miss' | null>(null);

  const snap = $derived(session.snap!);
  const run = $derived(session.run);
  const settings = profile.settings;
  const isBlackout = $derived(snap.enemies.some((e) => e.rule === 'blackout'));
  const nextTier = $derived(COMBO_TIERS[snap.tier + 1]);
  const target = $derived(snap.enemies.find((e) => e.targeted));

  const enemyEl = (id: number) => stage?.querySelector(`[data-enemy="${id}"]`);
  const glyphEl = (id: number) => enemyEl(id)?.querySelector('.portrait');

  function flash(kind: 'hurt' | 'miss') {
    flashKind = null;
    requestAnimationFrame(() => (flashKind = kind));
  }

  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- bookkeeping for sounds, never rendered
  const windupsSeen = new Set<number>();
  /** Color of the power on the last key typed: the slash that finishes a word takes it on. */
  let strikeColor = '#ddd7ea';

  /** Bigger hits, relative to the foe's health, get bigger numbers (up to about twice the size). */
  function hitScale(enemyId: number, dmg: number, crit: boolean): number {
    const e = snap.enemies.find((x) => x.id === enemyId);
    const share = e ? dmg / Math.max(1, e.maxHp) : 0.2;
    return Math.min(2.1, 0.9 + share * 2.2) * (crit ? 1.25 : 1);
  }

  function onEvent(ev: MachineEvent) {
    switch (ev.t) {
      case 'key-ok': {
        const boons = run.keyMods[ev.key] ?? [];
        strikeColor = boons.length ? MODS[boons[boons.length - 1].mod].color : '#ddd7ea';
        kb?.flash(ev.key, true);
        sfx.keyClick(session.machine.combat?.combo ?? 0);
        break;
      }
      case 'key-miss':
        kb?.flash(ev.key, false);
        sfx.miss();
        flash('miss');
        break;
      case 'combo-break':
        floatText(comboEl, `combo lost (${ev.lost})`, 'ft-bad');
        sfx.setIntensity(0);
        break;
      case 'combo-tier':
        sfx.tierUp(ev.tier);
        sfx.setIntensity(ev.tier);
        banner(stage, `×${COMBO_TIERS[ev.tier].mult}`, `${COMBO_TIERS[ev.tier].at} combo`, '#f3d98c');
        motesAt(comboEl, '#f3d98c', 30);
        break;
      case 'hit': {
        sfx.hit(ev.crit);
        const el = enemyEl(ev.enemyId);
        floatText(
          el,
          `${ev.dmg}${ev.crit ? '!' : ''}${ev.armored ? ' (armored)' : ''}`,
          ev.crit ? 'ft-crit' : 'ft-dmg',
          hitScale(ev.enemyId, ev.dmg, ev.crit),
        );
        burstAt(glyphEl(ev.enemyId), ev.crit ? '#f3d98c' : strikeColor, ev.crit ? 40 : 18);
        slash(el?.querySelector('.word'), ev.crit ? '#f3d98c' : strikeColor, ev.crit);
        punch(el, ev.crit);
        hitStop(stage, ev.crit ? 110 : 45);
        if (ev.crit) shake(stage, 'small');
        break;
      }
      case 'burn':
        floatText(enemyEl(ev.enemyId), `${ev.dmg}`, 'ft-burn');
        burstAt(glyphEl(ev.enemyId), MODS.ember.color, 6, 120);
        break;
      case 'spark':
        sfx.zap();
        floatText(enemyEl(ev.toId), `ϟ ${ev.dmg}`, 'ft-spark');
        burstAt(glyphEl(ev.toId), MODS.spark.color, 14);
        break;
      case 'thorns':
        floatText(enemyEl(ev.enemyId), `✱ ${ev.dmg}`, 'ft-dmg');
        break;
      case 'frost':
        floatText(enemyEl(ev.enemyId), `+${(ev.ms / 1000).toFixed(1)}s`, 'ft-frost');
        burstAt(enemyEl(ev.enemyId)?.querySelector('.threat'), MODS.frost.color, 10, 120);
        break;
      case 'kill': {
        sfx.kill();
        const el = enemyEl(ev.enemyId);
        const big = !!el?.matches('.boss, .elite');
        burstAt(glyphEl(ev.enemyId), '#f3d98c', big ? 90 : 48, big ? 520 : 380);
        shatter(el, big ? '#e24b6e' : '#f3d98c', big);
        hitStop(stage, big ? 220 : 120);
        shake(stage, big ? 'big' : 'small');
        break;
      }
      case 'player-hit':
        sfx.hurt();
        shake(stage, 'big');
        flash('hurt');
        floatText(
          stage.querySelector('.hud .hp'),
          ev.blocked ? `−${ev.dmg} (${ev.blocked} blocked)` : `−${ev.dmg}`,
          'ft-hurt',
        );
        windupsSeen.delete(ev.enemyId);
        break;
      case 'shield':
        floatText(stage.querySelector('.hud .vitals'), `+${ev.amount} shield`, 'ft-shield');
        break;
      case 'heal':
        floatText(stage.querySelector('.hud .hp'), `+${ev.amount}`, 'ft-heal');
        motesAt(stage.querySelector('.hud .hp'), '#7fe0b0', 10);
        break;
      case 'coins':
        sfx.coin();
        floatText(stage.querySelector('.hud .coins'), `+${ev.amount}`, 'ft-coin');
        break;
      case 'glass-shatter':
        sfx.shatter();
        floatText(stage.querySelector('.keyboard'), `${ev.key.toUpperCase()}'s Glass shattered`, 'ft-bad');
        burstAt(stage.querySelector('.keyboard'), MODS.glass.color, 40, 300);
        break;
      case 'zap':
        sfx.zap();
        floatText(enemyEl(ev.enemyId), `ϟ ${ev.dmg}`, 'ft-spark');
        break;
      case 'cold-snap':
        floatText(comboEl, 'Cold snap', 'ft-frost');
        for (const e of snap.enemies) burstAt(enemyEl(e.id)?.querySelector('.threat'), MODS.frost.color, 8, 120);
        break;
      case 'combo-drain':
        floatText(comboEl, `combo stolen (${ev.lost})`, 'ft-bad');
        break;
      case 'enemy-heal':
        floatText(enemyEl(ev.enemyId), `+${ev.amount}`, 'ft-heal');
        motesAt(glyphEl(ev.enemyId), '#7fe0b0', 8);
        break;
      case 'enemy-shield':
        floatText(enemyEl(ev.enemyId), `◈ ${ev.amount}`, 'ft-frost');
        break;
      case 'enemy-shield-break':
        burstAt(enemyEl(ev.enemyId)?.querySelector('.hp'), MODS.frost.color, 16, 200);
        break;
      case 'word-shift':
        sfx.select();
        break;
      case 'wave':
        banner(stage, `Wave ${ev.wave}`, 'More are coming', '#ddd7ea');
        break;
      case 'phase':
        sfx.tierUp(ev.phase + 1);
        shake(stage, 'big');
        banner(stage, 'It changes', snap.enemies.find((e) => e.id === ev.enemyId)?.name ?? '', '#e24b6e');
        burstAt(glyphEl(ev.enemyId), '#e24b6e', 50, 400);
        hitStop(stage, 200);
        break;
      case 'typo-hurt':
        floatText(stage.querySelector('.hud .hp'), `−${ev.dmg}`, 'ft-hurt');
        break;
      case 'second-wind':
        sfx.boon();
        floatText(stage.querySelector('.hud .hp'), 'Second wind', 'ft-heal');
        motesAt(stage.querySelector('.hud .hp'), '#7fe0b0', 30);
        break;
      case 'fight-end':
        sfx.setIntensity(0);
        break;
    }
  }

  // A soft chime the moment an enemy begins its wind-up, once per swing.
  $effect(() => {
    for (const e of snap.enemies) {
      if (e.windup && !windupsSeen.has(e.id)) {
        windupsSeen.add(e.id);
        sfx.windup();
      }
    }
  });

  onMount(() => session.on(onEvent));
</script>

<div
  class="combat"
  data-screen="combat"
  bind:this={stage}
  class:hurt={flashKind === 'hurt'}
  class:miss={flashKind === 'miss'}
>
  <Hud
    hp={snap.hp}
    maxHp={snap.maxHp}
    shield={snap.shield}
    coins={snap.coins}
    act={run.act}
    room={run.room}
    relics={run.relics}
    {onbuild}
  />

  <section class="field" aria-label="Enemies">
    {#each snap.enemies as e (e.id)}
      <EnemyCard {e} />
    {/each}
  </section>

  <section class="combo tier-{snap.tier}" bind:this={comboEl} aria-live="off">
    <span class="mult">×{snap.mult}</span>
    <div class="meter">
      <span class="count">
        {snap.combo} combo{#if nextTier}<span class="to">, {nextTier.at - snap.combo} more for ×{nextTier.mult}</span
          >{/if}
      </span>
      <div class="track"><i style:width="{snap.tierProgress * 100}%"></i></div>
    </div>
    <span class="preview">
      {#if target && snap.preview !== null}
        Finishing <b>{target.word}</b> deals <b class="dmg">{snap.preview}</b>
      {:else}
        Type the first letter of a word to lock on
      {/if}
    </span>
  </section>

  {#if settings.keyboard !== 'hidden'}
    <Keyboard
      bind:this={kb}
      keyMods={run.keyMods}
      layout={settings.layout}
      next={snap.nextKey}
      size={settings.keyboard === 'full' ? 'full' : 'compact'}
      fingerHints={settings.fingerHints}
      dark={isBlackout}
    />
  {/if}

  <p class="hints">
    <kbd>Backspace</kbd> deletes a letter <kbd>Tab</kbd> switches target <kbd>Esc</kbd> pauses
  </p>
</div>

<style>
  .combat {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-4) var(--space-5);
    position: relative;
  }
  .combat::before {
    content: '';
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 30;
    opacity: 0;
  }
  .hurt::before {
    box-shadow: inset 0 0 180px rgba(226, 75, 110, 0.55);
    animation: fade 0.45s ease-out;
  }
  .miss::before {
    box-shadow: inset 0 0 70px rgba(226, 75, 110, 0.28);
    animation: fade 0.18s ease-out;
  }
  @keyframes fade {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }
  .field {
    flex: 1;
    min-height: 0;
    width: min(69rem, 100%);
    display: flex;
    justify-content: center;
    align-items: center;
    gap: var(--space-6);
    flex-wrap: wrap;
  }
  .combo {
    display: grid;
    grid-template-columns: auto 14.118rem;
    grid-template-rows: auto auto;
    column-gap: var(--space-4);
    align-items: center;
  }
  .mult {
    grid-row: span 2;
    min-width: 2.6em;
    text-align: right;
    font-family: var(--f-display);
    font-weight: 700;
    font-size: var(--t-3xl);
    line-height: 1;
    color: var(--moon-dim);
    transition: color var(--dur);
  }
  .meter {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .count {
    font-size: var(--t-sm);
    color: var(--moon);
  }
  .to {
    color: var(--moon-faint);
  }
  .track {
    height: 4px;
    background: rgba(0, 0, 0, 0.45);
    border-radius: 2px;
    overflow: hidden;
  }
  .track i {
    display: block;
    height: 100%;
    background: var(--moon-dim);
    transition: width 0.1s;
  }
  .preview {
    font-size: var(--t-sm);
    color: var(--moon-faint);
  }
  .preview b {
    color: var(--moon);
    font-weight: 500;
  }
  .preview .dmg {
    color: var(--gold-bright);
    font-weight: 700;
  }
  .tier-1 .mult {
    color: var(--frost);
  }
  .tier-1 .track i {
    background: var(--frost);
  }
  .tier-2 .mult {
    color: var(--spark);
  }
  .tier-2 .track i {
    background: var(--spark);
  }
  .tier-3 .mult {
    color: var(--ember);
    text-shadow: 0 0 22px var(--ember);
  }
  .tier-3 .track i {
    background: var(--ember);
  }
  .tier-4 .mult {
    color: var(--gold-bright);
    text-shadow: 0 0 28px var(--gold);
    animation: throb 0.5s infinite alternate;
  }
  .tier-4 .track i {
    background: var(--gold-bright);
  }
  @keyframes throb {
    to {
      transform: scale(1.1);
    }
  }
  .hints {
    font-size: var(--t-xs);
    color: var(--moon-faint);
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }
  .hints kbd {
    margin-left: var(--space-3);
  }
  .hints kbd:first-child {
    margin-left: 0;
  }
</style>
