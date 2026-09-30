<!-- The Scriptorium: where you return between runs. -->
<script lang="ts">
  import {
    archivistLine,
    clampOaths,
    heat,
    heatCap,
    keepsakeLevel,
    KEEPSAKES,
    keyMastery,
    MODS,
    PROPHECIES,
    SEALS_PER_LEAF,
    STARTER_IDS,
    STARTERS,
    tradeSeals,
    type StarterId,
  } from '@keycraft/engine';
  import { onMount } from 'svelte';
  import { account } from '$lib/cloud/account.svelte';
  import { cloudEnabled } from '$lib/cloud/client';
  import * as sfx from '$lib/fx/audio';
  import { Session } from '$lib/game/session.svelte';
  import CodexOfHands from '$lib/hub/CodexOfHands.svelte';
  import Codex from '$lib/hub/Codex.svelte';
  import Currencies from '$lib/hub/Currencies.svelte';
  import Keepsakes from '$lib/hub/Keepsakes.svelte';
  import Prophecies from '$lib/hub/Prophecies.svelte';
  import { nav } from '$lib/nav';
  import Oaths from '$lib/screens/Oaths.svelte';
  import Settings from '$lib/screens/Settings.svelte';
  import { profile } from '$lib/stores/profile.svelte';
  import Button from '$lib/ui/Button.svelte';
  import Frame from '$lib/ui/Frame.svelte';
  import Initial from '$lib/ui/Initial.svelte';
  import Keyboard from '$lib/ui/Keyboard.svelte';

  type Panel = 'settings' | 'oaths' | 'hands' | 'keepsakes' | 'prophecies' | 'codex' | null;

  const meta = profile.meta;
  const hasSave = Session.hasSave();
  const firstTime = !meta.prologueDone && meta.runs === 0;
  let selected = $state<StarterId>(meta.unlocked.includes(meta.lastStarter) ? meta.lastStarter : 'apprentice');
  let panel = $state<Panel>(null);
  let panelRef = $state<{ onKey(k: string): boolean }>();
  const line = archivistLine(meta);

  const mastery = $derived(keyMastery(profile.stats));
  const rankCounts = $derived([1, 2, 3].map((r) => Object.values(mastery).filter((m) => m >= r).length));
  const heatNow = $derived(heat(clampOaths(meta)));
  const fulfilled = $derived(Object.keys(meta.prophecies).length);
  const carried = $derived(meta.equipped ? KEEPSAKES[meta.equipped] : null);

  onMount(() => {
    // The Archivist doesn't repeat himself.
    if (line.id !== 'general' && !meta.heard.includes(line.id)) {
      meta.heard.push(line.id);
      profile.saveMeta();
    }
  });

  function start() {
    meta.lastStarter = selected;
    profile.saveMeta();
    nav(`/run?starter=${selected}`);
  }

  function toggleGentle() {
    meta.gentle = !meta.gentle;
    profile.saveMeta();
  }

  function trade() {
    if (tradeSeals(meta)) {
      profile.saveMeta();
      sfx.coin();
    } else sfx.miss();
  }

  const open = (p: Panel) => () => (panel = p);

  function onkeydown(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (panel) {
      if (e.key === 'Escape') panel = null;
      else if (!panelRef?.onKey(e.key)) return;
      e.preventDefault();
      return;
    }
    const k = e.key.toLowerCase();
    const i = Number(k) - 1;
    if (k === 'enter') {
      if (hasSave) nav('/run?resume');
      else if (firstTime) nav('/prologue');
      else start();
    } else if (k === 'n' && (hasSave || firstTime)) start();
    else if (k === 't') nav('/prologue');
    else if (k === 's') panel = 'settings';
    else if (k === 'o') panel = 'oaths';
    else if (k === 'h') panel = 'hands';
    else if (k === 'k') panel = 'keepsakes';
    else if (k === 'p') panel = 'prophecies';
    else if (k === 'c') panel = 'codex';
    else if (k === 'r') nav('/practice');
    else if (k === 'a') nav(account.user || !cloudEnabled ? '/profile' : '/login');
    else if (k === 'g') toggleGentle();
    else if (k === 'x') trade();
    else if (STARTER_IDS[i] && meta.unlocked.includes(STARTER_IDS[i])) selected = STARTER_IDS[i];
    else return;
    e.preventDefault();
  }
</script>

<svelte:window {onkeydown} />
<svelte:head><title>Keycraft</title></svelte:head>

<div class="hub" data-screen="title">
  <header class="top">
    <h1 class="logo" aria-label="Keycraft">
      <Initial glyph="K" size={60} field="#3b2160" />
      <span aria-hidden="true">eycraft</span>
    </h1>
    <Currencies ink={meta.ink} leaf={meta.leaf} seals={meta.seals} />
    <nav class="util">
      <Button kind="quiet" hotkey="A" onclick={() => nav(account.user || !cloudEnabled ? '/profile' : '/login')}
        >{account.user ? (account.username ?? 'Profile') : cloudEnabled ? 'Sign in' : 'Profile'}</Button
      >
      <Button kind="quiet" hotkey="T" onclick={() => nav('/prologue')}>Tutorial</Button>
      <Button kind="quiet" hotkey="S" onclick={open('settings')}>Settings</Button>
    </nav>
  </header>

  <main class="hall">
    <section class="left">
      <Frame ornate>
        <div class="archivist">
          <Initial glyph="A" size={72} field="#2c2a4a" ink="var(--moon)" />
          <div>
            <p class="who">The Archivist</p>
            <p class="says">“{line.text}”</p>
            {#if meta.seals >= SEALS_PER_LEAF}
              <button class="trade" onclick={trade} type="button"
                ><kbd>X</kbd> Trade {SEALS_PER_LEAF} Seals for a Gold Leaf</button
              >
            {/if}
          </div>
        </div>
      </Frame>

      <div class="begin">
        {#if hasSave}
          <Button hotkey="Enter" onclick={() => nav('/run?resume')}>Continue your run</Button>
          <Button kind="quiet" hotkey="N" onclick={start}>Start a new run</Button>
        {:else if firstTime}
          <Button hotkey="Enter" onclick={() => nav('/prologue')}>Learn to play</Button>
          <Button kind="quiet" hotkey="N" onclick={start}>Skip to a run</Button>
        {:else}
          <Button hotkey="Enter" onclick={start}>Begin a run</Button>
        {/if}
      </div>

      <div class="setup">
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
        <div class="options">
          <button class="opt" onclick={open('keepsakes')} type="button">
            <kbd>K</kbd>
            {#if carried}Carrying the {carried.name} (level {keepsakeLevel(meta.keepsakeUses[meta.equipped!] ?? 0)})
            {:else if meta.keepsakes.length}Choose a keepsake to carry{:else}No keepsakes yet{/if}
          </button>
          <button class="opt" onclick={open('oaths')} type="button">
            <kbd>O</kbd> Oaths: {heatNow ? `Heat ${heatNow}` : 'none sworn'}
          </button>
          <label class="opt gentle">
            <input type="checkbox" checked={meta.gentle} onchange={toggleGentle} />
            <kbd>G</kbd> Gentle pace
          </label>
        </div>
      </div>
    </section>

    <aside class="right">
      <div class="stations">
        <button class="station" onclick={open('hands')} type="button">
          <span class="g">☙</span><span class="n">Codex of Hands</span><span class="h">Permanent upgrades</span><kbd
            >H</kbd
          >
        </button>
        <button class="station" onclick={open('prophecies')} type="button">
          <span class="g">✦</span><span class="n">Prophecies</span><span class="h"
            >{fulfilled} of {PROPHECIES.length} fulfilled</span
          ><kbd>P</kbd>
        </button>
        <button class="station" onclick={() => nav('/practice')} type="button">
          <span class="g">✎</span><span class="n">Practice desk</span><span class="h"
            >{meta.practice.streak ? `${meta.practice.streak}-day streak` : 'Tests, lessons and trials'}</span
          ><kbd>R</kbd>
        </button>
        <button class="station" onclick={open('codex')} type="button">
          <span class="g">❦</span><span class="n">Codex</span><span class="h">Foes, bosses and boons</span><kbd>C</kbd>
        </button>
      </div>
      <Frame>
        <div class="hands">
          <h2>Your hands</h2>
          <Keyboard {mastery} layout={profile.settings.layout} size="mini" />
          <p class="legend">
            <span class="m1">Bronze {rankCounts[0]}</span>
            <span class="m2">Silver {rankCounts[1]}</span>
            <span class="m3">Gold {rankCounts[2]}</span>
          </p>
          <p class="note">
            {#if meta.runs === 0}Each key earns Bronze, Silver and Gold as it gets faster and cleaner.
            {:else}{meta.runs} run{meta.runs === 1 ? '' : 's'}, {meta.wins} won. Best score {meta.bestScore.toLocaleString()}.{/if}
          </p>
        </div>
      </Frame>
    </aside>
  </main>
</div>

{#if panel === 'settings'}<Settings bind:this={panelRef} onclose={() => (panel = null)} />{/if}
{#if panel === 'oaths'}<Oaths bind:this={panelRef} maxHeat={heatCap(meta)} onclose={() => (panel = null)} />{/if}
{#if panel === 'hands'}<CodexOfHands bind:this={panelRef} onclose={() => (panel = null)} />{/if}
{#if panel === 'keepsakes'}<Keepsakes bind:this={panelRef} onclose={() => (panel = null)} />{/if}
{#if panel === 'prophecies'}<Prophecies bind:this={panelRef} onclose={() => (panel = null)} />{/if}
{#if panel === 'codex'}<Codex bind:this={panelRef} onclose={() => (panel = null)} />{/if}

<style>
  .hub {
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: var(--space-4) var(--space-6);
    gap: var(--space-4);
    overflow: auto;
  }
  .top {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: var(--space-6);
  }
  .logo {
    display: flex;
    align-items: flex-end;
    gap: var(--space-2);
  }
  .logo span {
    font-size: 2.6rem;
    line-height: 0.85;
    letter-spacing: 0.03em;
  }
  .top :global(.purse) {
    justify-self: center;
  }
  .util {
    display: flex;
    gap: var(--space-2);
  }
  .hall {
    flex: 1;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 380px;
    gap: var(--space-6);
    align-items: start;
    width: min(1240px, 100%);
    margin: 0 auto;
  }
  .left {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .archivist {
    display: flex;
    gap: var(--space-4);
    align-items: flex-start;
    padding: var(--space-4) var(--space-5);
  }
  .who {
    font-family: var(--f-display);
    color: var(--gold);
    font-size: var(--t-sm);
  }
  .says {
    font-size: var(--t-lg);
    line-height: 1.45;
    max-width: 60ch;
    font-style: italic;
  }
  .trade {
    margin-top: var(--space-2);
    background: none;
    border: 1px solid var(--rule);
    padding: 4px 10px;
    color: var(--moon-dim);
    cursor: pointer;
  }
  .begin {
    display: flex;
    gap: var(--space-3);
  }
  .setup {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .starters {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-3);
  }
  .starter {
    position: relative;
    padding: var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    text-align: left;
    cursor: pointer;
    background: var(--ink);
    border: 1px solid var(--rule);
    min-height: 128px;
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
  }
  .desc {
    font-size: var(--t-xs);
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
    padding: 0 5px;
    border: 1px solid color-mix(in oklab, var(--c) 60%, transparent);
  }
  .options {
    display: flex;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .opt {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: 6px 12px;
    background: var(--ink);
    border: 1px solid var(--rule);
    color: var(--moon-dim);
    font-size: var(--t-sm);
    cursor: pointer;
  }
  .opt:hover {
    border-color: var(--gold-deep);
    color: var(--moon);
  }
  .gentle input {
    accent-color: var(--witchfire);
  }
  .right {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .stations {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .station {
    display: grid;
    grid-template-columns: 36px 1fr auto;
    grid-template-rows: auto auto;
    column-gap: var(--space-3);
    align-items: center;
    text-align: left;
    padding: var(--space-2) var(--space-3);
    background: var(--ink);
    border: 1px solid var(--rule);
    cursor: pointer;
  }
  .station:hover,
  .station:focus-visible {
    border-color: var(--gold);
  }
  .station .g {
    grid-row: span 2;
    font-family: var(--f-glyph);
    font-size: 1.5rem;
    color: var(--gold-bright);
    text-align: center;
  }
  .station .n {
    font-family: var(--f-display);
    font-weight: 700;
  }
  .station .h {
    grid-column: 2;
    font-size: var(--t-xs);
    color: var(--moon-faint);
  }
  .station kbd {
    grid-row: 1 / span 2;
    grid-column: 3;
  }
  .hands {
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
  }
  .hands h2 {
    font-size: var(--t-md);
    color: var(--gold);
    align-self: flex-start;
  }
  .legend {
    display: flex;
    gap: var(--space-4);
    font-size: var(--t-sm);
  }
  .m1 {
    color: #b07a4a;
  }
  .m2 {
    color: #c9d0dc;
  }
  .m3 {
    color: var(--gold-bright);
  }
  .note {
    font-size: var(--t-sm);
    color: var(--moon-dim);
    text-align: center;
  }
  @media (max-width: 1100px) {
    .hall {
      grid-template-columns: 1fr;
    }
    .starters {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
