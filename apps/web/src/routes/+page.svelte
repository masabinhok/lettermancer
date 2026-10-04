<!-- The Scriptorium: where you return between runs. -->
<script lang="ts">
  import {
    archivistLine,
    clampOaths,
    dailyLabel,
    dailyStarter,
    heat,
    heatCap,
    OATHS,
    keepsakeLevel,
    KEEPSAKES,
    keyMastery,
    MODS,
    PROPHECIES,
    SEALS_PER_LEAF,
    STARTER_IDS,
    STARTERS,
    tradeSeals,
    weeklyLabel,
    weeklyOaths,
    type OathId,
    type StarterId,
  } from '@lettermancer/engine';
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
  import Dialogue from '$lib/ui/Dialogue.svelte';
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

  // Shared runs: the same seed for everyone. The daily is once a day; the weekly is as often as you like.
  const now = new Date();
  const today = dailyLabel(now);
  const todayStarter = STARTERS[dailyStarter(today)];
  const week = weeklyOaths(weeklyLabel(now));
  const weekHeat = heat(week);
  let dailyDone = $state(false);

  onMount(() => {
    void account.dailyPlayed(today.slice('daily:'.length)).then((p) => (dailyDone = p));
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

  function daily() {
    if (!dailyDone) nav('/run?mode=daily');
  }

  function weekly() {
    meta.lastStarter = selected;
    profile.saveMeta();
    nav(`/run?mode=weekly&starter=${selected}`);
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
    else if (k === 'd' && !dailyDone) daily();
    else if (k === 'w') weekly();
    else if (k === 'l') nav('/leaderboards');
    else if (k === 'a') nav(account.user || !cloudEnabled ? '/profile' : '/login');
    else if (k === 'g') toggleGentle();
    else if (k === 'x') trade();
    else if (STARTER_IDS[i] && meta.unlocked.includes(STARTER_IDS[i])) selected = STARTER_IDS[i];
    else return;
    e.preventDefault();
  }
</script>

<svelte:window {onkeydown} />
<svelte:head><title>Lettermancer</title></svelte:head>

<div class="hub" data-screen="title">
  <header class="top">
    <h1 class="logo" aria-label="Lettermancer">
      <Initial glyph="L" size={60} field="#3b2160" />
      <span aria-hidden="true">ettermancer</span>
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
      <div class="archivist">
        <Initial glyph="A" size={72} field="#2c2a4a" ink="var(--moon)" />
        <Dialogue speaker="The Archivist">
          <p class="says">“{line.text}”</p>
          {#if meta.seals >= SEALS_PER_LEAF}
            <button class="trade" onclick={trade} type="button"
              ><kbd>X</kbd> Trade {SEALS_PER_LEAF} Seals for a Gold Leaf</button
            >
          {/if}
        </Dialogue>
      </div>

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

      <div class="shared" aria-label="Shared runs">
        <button class="rite" onclick={daily} disabled={dailyDone} type="button">
          <kbd>D</kbd>
          <span class="name">Daily rite</span>
          <span class="desc">
            {#if dailyDone}Played. A new rite opens at midnight UTC.
            {:else}One attempt. Everyone plays today's seed with the {todayStarter.name}, no upgrades.{/if}
          </span>
        </button>
        <button class="rite" onclick={weekly} type="button">
          <kbd>W</kbd>
          <span class="name">Weekly challenge · Heat {weekHeat}</span>
          <span class="desc">
            {Object.entries(week)
              .map(([id, l]) => `${OATHS[id as OathId].name}${OATHS[id as OathId].max > 1 ? ` ${l}` : ''}`)
              .join(', ')}. Your chosen keyboard, no upgrades, best score counts.
          </span>
        </button>
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
        <button class="station" onclick={() => nav('/leaderboards')} type="button">
          <span class="g">♛</span><span class="n">Leaderboards</span><span class="h"
            >Daily, weekly, Heat and practice</span
          ><kbd>L</kbd>
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
    font-size: 1.95rem;
    line-height: 0.85;
    letter-spacing: 0.03em;
  }
  .top :global(.purse) {
    justify-self: center;
  }
  .util {
    display: flex;
    gap: var(--space-2);
    white-space: nowrap;
  }
  .hall {
    flex: 1;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 22.353rem;
    gap: var(--space-6);
    align-items: start;
    width: min(72.941rem, 100%);
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
    align-items: flex-end;
  }
  .archivist > :global(.dialogue) {
    flex: 1;
  }
  .says {
    font-size: var(--t-lg);
    line-height: 1.45;
    max-width: 60ch;
  }
  .trade {
    margin-top: var(--space-2);
    background: none;
    border: 1px solid var(--rule);
    padding: 4px 0.588rem;
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
    min-height: 7.529rem;
  }
  .starter kbd {
    position: absolute;
    top: 0.471rem;
    right: 0.471rem;
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
    text-transform: uppercase;
    letter-spacing: var(--ui-tracking);
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
    padding: 0 0.294rem;
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
    padding: 0.353rem 0.706rem;
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
  .shared {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }
  .rite {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    text-align: left;
    padding: var(--space-3);
    background: linear-gradient(160deg, color-mix(in oklab, var(--gold-deep) 18%, var(--ink)), var(--ink));
    border: 1px solid var(--gold-deep);
    cursor: pointer;
  }
  .rite:hover:not(:disabled),
  .rite:focus-visible {
    border-color: var(--gold);
  }
  .rite:disabled {
    opacity: 0.55;
    cursor: default;
  }
  .rite kbd {
    position: absolute;
    top: 0.471rem;
    right: 0.471rem;
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
    grid-template-columns: 2.118rem 1fr auto;
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
    text-transform: uppercase;
    letter-spacing: var(--ui-tracking);
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
  @media (max-aspect-ratio: 1/1) {
    .hall {
      grid-template-columns: 1fr;
    }
    .starters {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  /* Typography roles (see app.css): boon names, titles and speakers get their own faces. */
  .starter .name {
    font-family: var(--f-boon);
    font-weight: 700;
    text-transform: none;
    letter-spacing: 0.02em;
  }
  .logo span {
    font-family: var(--f-title);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  /* Header buttons: a step smaller, so spaced capitals fit beside the logo and purse. */
  .util :global(.btn) {
    font-size: var(--t-sm);
    padding: 0.5rem 0.9rem;
  }
</style>
