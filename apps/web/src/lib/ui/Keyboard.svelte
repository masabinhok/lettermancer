<!-- The on-screen keyboard: shows your mods, the next key, finger colors, heatmaps and install picking. -->
<script lang="ts">
  import { MODS, RARITY_NAMES, type KeyMods } from '@keycraft/engine';
  import { fingerForColumn, HOME_COLUMNS, LAYOUTS } from '../game/layouts';
  import type { KeyboardLayout } from '../stores/profile.svelte';

  let {
    keyMods = {},
    layout = 'qwerty',
    next = null,
    size = 'full',
    fingerHints = false,
    dark = false,
    heat = null,
    mastery = null,
    labels = null,
    pickColor = null,
    onpick,
  }: {
    keyMods?: KeyMods;
    layout?: KeyboardLayout;
    next?: string | null;
    size?: 'large' | 'full' | 'compact' | 'mini';
    fingerHints?: boolean;
    dark?: boolean;
    heat?: Record<string, number> | null;
    /** key mastery ranks 0-3, drawn as bronze, silver and gold */
    mastery?: Record<string, number> | null;
    labels?: Record<string, string> | null;
    /** when set, letter keys are clickable to install a mod of this color */
    pickColor?: string | null;
    onpick?: (key: string) => void;
  } = $props();

  let flashes = $state<Record<string, 'ok' | 'bad' | undefined>>({});
  const timers: Record<string, ReturnType<typeof setTimeout>> = {};

  /** Briefly light a key (called by the parent via bind:this). */
  export function flash(k: string, ok: boolean): void {
    flashes[k] = undefined;
    clearTimeout(timers[k]);
    requestAnimationFrame(() => {
      flashes[k] = ok ? 'ok' : 'bad';
      timers[k] = setTimeout(() => (flashes[k] = undefined), 220);
    });
  }

  const rows = $derived(LAYOUTS[layout]);
  const isLetter = (k: string) => /^[a-z]$/.test(k);
</script>

<div
  class="keyboard {size}"
  class:finger-hints={fingerHints}
  class:dark
  class:heat={!!heat}
  class:picking={!!pickColor}
  style:--pick={pickColor}
  aria-hidden={!pickColor}
>
  {#each rows as row, r (r)}
    <div class="row r{r}">
      {#each [...row] as k, col (k)}
        {@const boons = keyMods[k] ?? []}
        {@const letter = isLetter(k)}
        {@const h = heat?.[k]}
        <svelte:element
          this={pickColor && letter ? 'button' : 'div'}
          class="key f{fingerForColumn(col)}"
          data-key={k}
          class:punct={!letter}
          class:next={next === k}
          class:modded={boons.length > 0}
          class:home={r === 1 && HOME_COLUMNS.includes(col)}
          class:ok={flashes[k] === 'ok'}
          class:bad={flashes[k] === 'bad'}
          class:no-data={heat && letter && h === undefined}
          class:m1={mastery?.[k] === 1}
          class:m2={mastery?.[k] === 2}
          class:m3={mastery?.[k] === 3}
          style:--glow={boons.length ? MODS[boons[boons.length - 1].mod].color : null}
          style:--heat={h ?? 0}
          onclick={pickColor && letter ? () => onpick?.(k) : undefined}
          aria-label={pickColor && letter ? `Install on ${k.toUpperCase()}` : undefined}
          type={pickColor && letter ? 'button' : undefined}
          role={pickColor && letter ? undefined : 'presentation'}
        >
          <span class="cap">{k}</span>
          {#if boons.length}
            <span class="pips">
              {#each boons as b, i (i)}<span
                  class="pip r{b.rarity}"
                  style:color={MODS[b.mod].color}
                  title="{RARITY_NAMES[b.rarity]} {MODS[b.mod].name}">{MODS[b.mod].glyph}</span
                >{/each}
            </span>
          {/if}
          {#if labels?.[k]}<span class="label">{labels[k]}</span>{/if}
        </svelte:element>
      {/each}
    </div>
  {/each}
</div>

<style>
  .keyboard {
    --k: 48px;
    --gap: 6px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--gap);
    user-select: none;
  }
  .large {
    --k: 58px;
  }
  .compact {
    --k: 36px;
    --gap: 4px;
  }
  .mini {
    --k: 28px;
    --gap: 3px;
  }
  .row {
    display: flex;
    gap: var(--gap);
  }
  .r1 {
    margin-left: calc(var(--k) * 0.45);
  }
  .r2 {
    margin-left: calc(var(--k) * 1.2);
  }
  .key {
    position: relative;
    width: var(--k);
    height: var(--k);
    padding: 0;
    border-radius: 6px;
    border: 1px solid var(--rule);
    border-bottom-width: 3px;
    background: linear-gradient(180deg, var(--ink-2), var(--ink));
    color: var(--moon);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
    transition:
      background var(--dur-fast),
      transform var(--dur-fast),
      border-color var(--dur-fast);
  }
  .cap {
    font-family: var(--f-type);
    font-weight: 700;
    font-size: calc(var(--k) * 0.34);
    text-transform: uppercase;
    line-height: 1;
  }
  .punct {
    opacity: 0.35;
  }
  .punct .cap {
    text-transform: none;
  }
  .home .cap {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .pips {
    display: flex;
    gap: 1px;
    font-size: calc(var(--k) * 0.22);
    line-height: 1;
  }
  .pip.r1,
  .pip.r2,
  .pip.r3 {
    text-shadow: 0 0 6px currentColor;
  }
  .pip.r3 {
    font-weight: 700;
  }
  .mini .pips {
    display: none;
  }
  .label {
    position: absolute;
    top: 2px;
    right: 4px;
    font-size: 0.66rem;
    line-height: 1;
    color: var(--aurum);
  }
  .modded {
    border-color: var(--glow);
    box-shadow:
      0 0 14px -2px color-mix(in oklab, var(--glow) 60%, transparent),
      inset 0 0 10px color-mix(in oklab, var(--glow) 18%, transparent);
  }
  .next {
    background: var(--moon);
    color: var(--night);
    transform: translateY(-2px);
  }
  .ok {
    animation: press 0.18s;
  }
  .bad {
    animation: press-bad 0.26s;
  }
  @keyframes press {
    40% {
      transform: translateY(2px);
      background: var(--rule);
    }
  }
  @keyframes press-bad {
    30% {
      background: var(--rose);
      transform: translateX(-3px);
    }
    60% {
      transform: translateX(3px);
    }
  }
  .finger-hints .key {
    border-bottom-color: var(--finger);
  }
  .f0 {
    --finger: #e98ab0;
  }
  .f1 {
    --finger: #e8a86f;
  }
  .f2 {
    --finger: #d8c86a;
  }
  .f3 {
    --finger: #86d49b;
  }
  .f4 {
    --finger: #72c6e3;
  }
  .f5 {
    --finger: #8fa0f0;
  }
  .f6 {
    --finger: #b78ef0;
  }
  .f7 {
    --finger: #e58ee0;
  }
  .dark .key {
    background: var(--night-deep);
    border-color: #1c1628;
    box-shadow: none;
    color: transparent;
  }
  .dark .pips {
    visibility: hidden;
  }
  .heat .key {
    background: color-mix(in oklab, var(--rose) calc(var(--heat) * 85%), var(--ink));
  }
  .heat .key.no-data {
    background: repeating-linear-gradient(135deg, var(--ink) 0 4px, var(--ink-2) 4px 8px);
    border-style: dashed;
  }
  .heat .key.no-data .cap {
    opacity: 0.4;
  }
  .m1 {
    border-color: #b07a4a;
    box-shadow: inset 0 -3px 0 #b07a4a;
  }
  .m2 {
    border-color: #c9d0dc;
    box-shadow: inset 0 -3px 0 #c9d0dc;
  }
  .m3 {
    border-color: var(--gold-bright);
    box-shadow:
      inset 0 -3px 0 var(--gold-bright),
      0 0 12px -3px var(--gold);
    color: var(--gold-bright);
  }
  .picking button.key {
    cursor: pointer;
  }
  .picking button.key:hover,
  .picking button.key:focus-visible {
    border-color: var(--pick);
    box-shadow: 0 0 16px -2px var(--pick);
    transform: translateY(-2px);
  }
</style>
