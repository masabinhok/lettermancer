<script lang="ts">
  import { nav } from '$lib/nav';
  import {
    accuracy,
    heat,
    keyWeakness,
    MODS,
    nemesisBigram,
    STARTER_IDS,
    STARTERS,
    topWeakKeys,
    type StarterId,
  } from '@keycraft/engine';
  import { Session } from '$lib/game/session.svelte';
  import Oaths from '$lib/screens/Oaths.svelte';
  import Settings from '$lib/screens/Settings.svelte';
  import { profile } from '$lib/stores/profile.svelte';
  import Button from '$lib/ui/Button.svelte';
  import Frame from '$lib/ui/Frame.svelte';
  import HeatLegend from '$lib/ui/HeatLegend.svelte';
  import Initial from '$lib/ui/Initial.svelte';
  import Keyboard from '$lib/ui/Keyboard.svelte';

  const meta = profile.meta;
  const hasSave = Session.hasSave();
  let selected = $state<StarterId>(meta.unlocked.includes(meta.lastStarter) ? meta.lastStarter : 'apprentice');
  let settingsOpen = $state(false);
  let oathsOpen = $state(false);
  let settings = $state<{ onKey(k: string): boolean }>();
  const heatNow = $derived(heat(meta.oaths));

  const weak = $derived(topWeakKeys(profile.stats, 3));
  const nem = $derived(nemesisBigram(profile.stats));
  const played = $derived(meta.runs > 0);
  const firstTime = !meta.prologueDone && meta.runs === 0;

  function toggleGentle() {
    meta.gentle = !meta.gentle;
    profile.saveMeta();
  }

  function start() {
    meta.lastStarter = selected;
    profile.saveMeta();
    nav(`/run?starter=${selected}`);
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (settingsOpen || oathsOpen) {
      if (settings?.onKey(e.key)) e.preventDefault();
      return;
    }
    const i = Number(e.key) - 1;
    if (e.key === 'Enter') {
      if (hasSave) nav('/run?resume');
      else if (firstTime) nav('/prologue');
      else start();
    } else if (e.key === 'n' && (hasSave || firstTime)) start();
    else if (e.key === 't') nav('/prologue');
    else if (e.key === 's') settingsOpen = true;
    else if (e.key === 'o') oathsOpen = true;
    else if (e.key === 'g') toggleGentle();
    else if (STARTER_IDS[i] && meta.unlocked.includes(STARTER_IDS[i])) selected = STARTER_IDS[i];
    else return;
    e.preventDefault();
  }
</script>

<svelte:window {onkeydown} />
<svelte:head><title>Keycraft</title></svelte:head>

<div class="title" data-screen="title">
  <section class="main">
    <h1 class="logo" aria-label="Keycraft">
      <Initial glyph="K" size={132} field="#3b2160" />
      <span class="rest" aria-hidden="true">eycraft</span>
    </h1>
    <p class="tagline">
      A roguelike where your keyboard is the deck. Type to strike, bind powers to your keys, and get faster with every
      run.
    </p>

    <div class="actions">
      {#if hasSave}
        <Button hotkey="Enter" onclick={() => nav('/run?resume')}>Continue your run</Button>
        <Button kind="quiet" hotkey="N" onclick={start}>Start a new run</Button>
      {:else if firstTime}
        <Button hotkey="Enter" onclick={() => nav('/prologue')}>Learn to play</Button>
        <Button kind="quiet" hotkey="N" onclick={start}>Skip to a run</Button>
      {:else}
        <Button hotkey="Enter" onclick={start}>Begin a run</Button>
      {/if}
      <Button kind="quiet" hotkey="O" onclick={() => (oathsOpen = true)}
        >Oaths{heatNow ? ` (Heat ${heatNow})` : ''}</Button
      >
      <Button kind="quiet" hotkey="S" onclick={() => (settingsOpen = true)}>Settings</Button>
      {#if !firstTime}<Button kind="quiet" hotkey="T" onclick={() => nav('/prologue')}>Tutorial</Button>{/if}
    </div>

    <label class="gentle">
      <input type="checkbox" checked={meta.gentle} onchange={toggleGentle} />
      <span>Gentle pace <kbd>G</kbd></span>
      <small>Slower, weaker enemies while you learn. Gentle runs don't count for leaderboards.</small>
    </label>

    <h2>Choose your keyboard</h2>
    <div class="starters" role="radiogroup" aria-label="Starting keyboard">
      {#each STARTER_IDS as id, i (id)}
        {@const s = STARTERS[id]}
        {@const locked = !meta.unlocked.includes(id)}
        <button
          class="starter"
          class:selected={selected === id}
          class:locked
          role="radio"
          aria-checked={selected === id}
          disabled={locked}
          onclick={() => (selected = id)}
          type="button"
        >
          <kbd>{i + 1}</kbd>
          <span class="name">{s.name}</span>
          {#if locked}
            <span class="desc">Locked. {s.unlock}.</span>
          {:else}
            <span class="desc">{s.desc}</span>
            <span class="chips">
              {#each Object.entries(s.keyMods) as [k, boons] (k)}
                {#each boons as b, j (j)}
                  <span class="chip" style:--c={MODS[b.mod].color}>{k.toUpperCase()} {MODS[b.mod].glyph}</span>
                {/each}
              {/each}
            </span>
          {/if}
        </button>
      {/each}
    </div>
  </section>

  <aside>
    <Frame>
      <div class="hands">
        <h2>Your hands</h2>
        <Keyboard heat={keyWeakness(profile.stats)} layout={profile.settings.layout} size="mini" />
        <HeatLegend />
        {#if played}
          <p>
            {meta.runs} run{meta.runs === 1 ? '' : 's'}, {meta.wins} won. Lifetime accuracy {(
              accuracy(profile.stats) * 100
            ).toFixed(1)}%.
          </p>
          {#if weak.length}<p>
              Your slowest keys are {weak.map((k) => k.toUpperCase()).join(', ')}. Runs will lean on them.
            </p>{/if}
          {#if nem}<p>Hardest pair so far: “{nem.bigram}”.</p>{/if}
        {:else}
          <p>Play a run and this keyboard fills in with how each key feels under your fingers.</p>
        {/if}
      </div>
    </Frame>
  </aside>
</div>

{#if settingsOpen}<Settings bind:this={settings} onclose={() => (settingsOpen = false)} />{/if}
{#if oathsOpen}<Oaths bind:this={settings} onclose={() => (oathsOpen = false)} />{/if}

<style>
  .title {
    height: 100%;
    display: grid;
    grid-template-columns: minmax(0, 760px) 360px;
    justify-content: center;
    align-items: center;
    gap: var(--space-7);
    padding: var(--space-6);
    overflow: auto;
  }
  .main {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    animation: arrive 1s var(--ease-out);
  }
  @keyframes arrive {
    from {
      opacity: 0;
      filter: blur(6px);
      transform: translateY(8px);
    }
  }
  .logo {
    display: flex;
    align-items: flex-end;
    gap: var(--space-3);
  }
  .rest {
    font-size: var(--t-hero);
    font-weight: 700;
    line-height: 0.85;
    letter-spacing: 0.03em;
    color: var(--moon);
  }
  .tagline {
    max-width: 52ch;
    font-size: var(--t-lg);
    color: var(--moon-dim);
  }
  .gentle {
    display: grid;
    grid-template-columns: auto 1fr;
    column-gap: var(--space-2);
    align-items: center;
    color: var(--moon);
    cursor: pointer;
  }
  .gentle input {
    accent-color: var(--witchfire);
    width: 18px;
    height: 18px;
  }
  .gentle small {
    grid-column: 2;
    color: var(--moon-faint);
    font-size: var(--t-sm);
  }
  .actions {
    display: flex;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  h2 {
    font-size: var(--t-md);
    color: var(--gold);
    margin-top: var(--space-2);
  }
  .starters {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-3);
  }
  .starter {
    position: relative;
    padding: var(--space-4) var(--space-3) var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    text-align: left;
    cursor: pointer;
    background: var(--ink);
    border: 1px solid var(--rule);
    border-radius: 2px;
    min-height: 150px;
    transition:
      border-color var(--dur),
      transform var(--dur) var(--ease-out);
  }
  .starter:hover:not(:disabled) {
    transform: translateY(-3px);
  }
  .starter kbd {
    position: absolute;
    top: 8px;
    right: 8px;
  }
  .selected {
    border-color: var(--gold);
    box-shadow: 0 0 0 1px var(--gold-deep);
  }
  .locked {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .name {
    font-family: var(--f-display);
    font-weight: 700;
    color: var(--moon);
  }
  .desc {
    font-size: var(--t-sm);
    color: var(--moon-dim);
    line-height: 1.3;
  }
  .chips {
    margin-top: auto;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .chip {
    font-size: var(--t-xs);
    font-weight: 700;
    color: var(--c);
    padding: 1px 6px;
    border: 1px solid color-mix(in oklab, var(--c) 60%, transparent);
  }
  .hands {
    padding: var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .hands h2 {
    margin: 0;
  }
  .hands p {
    font-size: var(--t-sm);
    color: var(--moon-dim);
  }
  @media (max-width: 1100px) {
    .title {
      grid-template-columns: minmax(0, 760px);
    }
    .starters {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
