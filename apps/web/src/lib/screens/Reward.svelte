<!--
  After a fight: the muse appears in a full-screen overlay and her offers slide in as large plaques.
  Keys are held until every offer is on screen, so a choice is never made blind.
-->
<script lang="ts">
  import {
    BLESSINGS,
    BOSSES,
    isDuo,
    MODS,
    MUSE_IDS,
    MUSES,
    RARITY_NAMES,
    RELICS,
    type Offer,
  } from '@lettermancer/engine';
  import { onMount } from 'svelte';
  import * as sfx from '../fx/audio';
  import { burstAt } from '../fx/particles';
  import { RARITY_COLOR } from '../game/look';
  import type { Session } from '../game/session.svelte';
  import Button from '../ui/Button.svelte';
  import Dialogue from '../ui/Dialogue.svelte';
  import Emblem from '../ui/Emblem.svelte';
  import Hud from '../ui/Hud.svelte';

  let { session, onbuild }: { session: Session; onbuild?: () => void } = $props();
  const v = $derived(session.view.kind === 'reward' ? session.view : null);
  const run = $derived(session.run);
  const muse = $derived(v?.muse ? MUSES[v.muse] : null);

  const GREETINGS: Record<string, string[]> = {
    ignis: [
      'Burn bright, little scribe. Burn everything.',
      'Your keys smoke already. Let me help.',
      'Ash is just ink that finished its sentence.',
    ],
    glacia: ['Slow down. Let them wait on you.', 'Cold hands, clear letters.', 'Winter takes its time. So should you.'],
    volta: ['Faster! Let the sparks jump!', 'I like the crackle of your typing.', 'One word, many strikes.'],
    aurum: ['Every letter can pay, if you let it.', 'A full purse is a sharp quill.', 'Spend well. I always do.'],
    resona: ['Again. And again. Louder.', 'Words sung twice strike twice as hard.', 'I hear a rhythm in your hands.'],
    aegis: [
      'Stand behind your words.',
      'Let them strike. You will not break.',
      'A steady wall outlasts a quick blade.',
    ],
  };

  const REVEAL_GAP = 200;
  const START = 380;
  const reduced = () => document.documentElement.dataset.reducedMotion === 'true';

  let shown = $state(0);
  let ready = $state(false);
  let taking = $state<number | null>(null);
  let plaques = $state<HTMLElement[]>([]);

  const greeting = $derived.by(() => {
    if (!v?.muse) return null;
    const lines = GREETINGS[v.muse];
    return lines[(run.act * 7 + run.room) % lines.length];
  });

  const lines = $derived.by(() => {
    const s = v?.summary;
    if (!s) return [];
    const out = [`${s.words} words at ${Math.round(s.wpm)} wpm, best combo ${s.maxCombo}.`, `+${s.coins} coins.`];
    if (s.interest) out.push(`Interest +${s.interest}.`);
    if (s.healed) out.push(`Healed ${s.healed}.`);
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
        tier: o.rarity,
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
        kind: duo ? `Duo boon · ${b.muses.map((m) => MUSES[m].name).join(' & ')}` : 'Blessing · changes your whole run',
        tier: duo ? 3 : 1,
      };
    }
    const r = RELICS[o.relic];
    const boss = r.boss ? BOSSES[r.boss].name : '';
    const kind = r.boss ? `Boss relic · always dropped by ${boss.startsWith('The ') ? boss : `the ${boss}`}` : 'Relic';
    return { glyph: r.glyph, name: r.name, desc: r.desc, color: '#e6a100', kind, tier: r.boss ? 3 : 2 };
  }

  const cards = $derived(v ? v.offers.map(card) : []);

  onMount(() => {
    const n = v?.offers.length ?? 0;
    if (reduced()) {
      shown = n;
      ready = true;
      return;
    }
    if (v?.muse) sfx.museArrive(MUSE_IDS.indexOf(v.muse));
    const timers = Array.from({ length: n }, (_, i) =>
      setTimeout(
        () => {
          shown = i + 1;
          sfx.cardIn(i);
        },
        START + i * REVEAL_GAP,
      ),
    );
    timers.push(setTimeout(() => (ready = true), START + n * REVEAL_GAP + 120));
    return () => timers.forEach(clearTimeout);
  });

  function take(i: number) {
    if (!ready || taking !== null) return;
    taking = i;
    sfx.take(cards[i].tier);
    burstAt(plaques[i]?.querySelector('.emblem'), cards[i].color, 36, 380);
    setTimeout(() => session.pick(i), reduced() ? 100 : 650);
  }

  function skip() {
    if (taking === null) session.pick(-1);
  }

  function reroll() {
    if (!ready || taking !== null) return;
    if (session.reroll()) sfx.select();
  }

  export function onKey(k: string): boolean {
    if (!v) return false;
    if (!ready || taking !== null) return /^[1-9]$/.test(k) || k === 'Enter' || k === 'r';
    if (k === 'Enter') {
      skip();
      return true;
    }
    if (k === 'r' && v.canReroll) {
      reroll();
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
  <div class="screen" data-screen="reward" style:--muse={muse?.color ?? '#e6a100'}>
    <Hud hp={run.hp} maxHp={run.maxHp} coins={run.coins} act={run.act} room={run.room} relics={run.relics} {onbuild} />
    <div class="stage">
      <section class="giver">
        <Emblem
          glyph={muse ? MODS[muse.mod].glyph : '✦'}
          color={muse?.color ?? '#e6a100'}
          size="13rem"
          tier={muse ? 3 : 2}
          bob
        />
        {#if muse}
          <h1 class="speaker">{muse.name}</h1>
          <p class="title">{muse.title}</p>
          {#if greeting}<Dialogue><p class="greeting">“{greeting}”</p></Dialogue>{/if}
        {:else}
          <h1>{v.title}</h1>
        {/if}
        {#if v.summary?.perfect}<p class="perfect">A flawless fight. Not a single typo.</p>{/if}
        {#if lines.length}<p class="summary">{lines.join(' ')}</p>{/if}
      </section>

      <section class="offers" aria-label="Choose a boon">
        {#each cards as c, i (i)}
          <button
            bind:this={plaques[i]}
            class="plaque card"
            class:shown={i < shown}
            class:taken={taking === i}
            class:faded={taking !== null && taking !== i}
            style:--c={c.color}
            style:--rc={RARITY_COLOR[c.tier]}
            onclick={() => take(i)}
            onmouseenter={() => ready && taking === null && sfx.chime(i)}
            tabindex={ready ? 0 : -1}
            type="button"
          >
            <kbd>{i + 1}</kbd>
            <Emblem glyph={c.glyph} color={c.color} tier={c.tier} size="6rem" rays={c.tier >= 2} />
            <span class="text">
              <span class="kind">{c.kind}</span>
              <span class="name">{c.name}</span>
              <span class="desc">{c.desc}</span>
            </span>
          </button>
        {/each}
        {#if cards.length}
          <div class="actions" class:shown={ready}>
            {#if v.canReroll}
              <Button kind="quiet" hotkey="R" onclick={reroll}>Re-roll ({run.rerollsLeft} left)</Button>
            {/if}
            <Button kind="quiet" hotkey="Enter" onclick={skip}>Skip</Button>
          </div>
        {:else}
          <Button hotkey="Enter" onclick={skip}>Continue</Button>
        {/if}
      </section>
    </div>
  </div>
{/if}

<style>
  .screen {
    position: relative;
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: var(--space-4) var(--space-5);
    overflow: hidden;
    background:
      radial-gradient(ellipse 50% 70% at 22% 55%, color-mix(in oklab, var(--muse) 22%, transparent), transparent 70%),
      radial-gradient(ellipse 120% 100% at 50% 50%, transparent 55%, rgba(0, 0, 0, 0.55));
    animation: dim 0.5s ease-out;
  }
  .screen > :global(.hud) {
    align-self: center;
  }
  .stage {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(15.294rem, 0.8fr) minmax(0, 1.4fr);
    align-items: center;
    gap: var(--space-6);
    width: min(70.588rem, 100%);
    margin: 0 auto;
  }
  .giver {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--space-2);
    animation: arrive 0.7s var(--ease-out);
  }
  h1 {
    font-size: clamp(2.6rem, 5vw, 3.6rem);
    line-height: 1;
    color: var(--muse);
    text-shadow: 0 0 40px color-mix(in oklab, var(--muse) 55%, transparent);
  }
  .title {
    font-family: var(--f-display);
    text-transform: var(--ui-case);
    font-size: var(--t-lg);
    color: var(--moon-dim);
    letter-spacing: 0.05em;
  }
  .greeting {
    margin: 0;
    max-width: 26ch;
    font-size: var(--t-lg);
    color: var(--moon);
  }
  .perfect {
    color: var(--witchfire);
    font-style: italic;
  }
  .summary {
    max-width: 34ch;
    font-size: var(--t-sm);
    color: var(--moon-faint);
  }
  .offers {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    align-items: stretch;
  }
  .plaque {
    position: relative;
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-3) var(--space-5) var(--space-3) var(--space-4);
    text-align: left;
    cursor: pointer;
    background: linear-gradient(90deg, color-mix(in oklab, var(--c) 16%, var(--ink-2)), var(--ink) 70%), var(--ink);
    border: 1px solid color-mix(in oklab, var(--rc) 55%, var(--rule));
    border-left: 4px solid var(--rc);
    border-radius: 4px;
    opacity: 0;
    transform: translateX(80px);
    transition:
      opacity 0.45s var(--ease-out),
      transform 0.45s var(--ease-out),
      box-shadow var(--dur),
      border-color var(--dur);
  }
  .plaque.shown {
    opacity: 1;
    transform: none;
  }
  .plaque.shown:hover,
  .plaque.shown:focus-visible {
    outline: none;
    transform: translateX(-8px) scale(1.02);
    border-color: var(--c);
    box-shadow:
      0 0 0 1px var(--c),
      0 16px 50px -14px color-mix(in oklab, var(--c) 75%, transparent);
  }
  .plaque kbd {
    position: absolute;
    top: 50%;
    left: calc(-1 * var(--space-6));
    transform: translateY(-50%);
    font-size: var(--t-lg);
  }
  .text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .kind {
    font-size: var(--t-sm);
    letter-spacing: 0.08em;
    font-family: var(--f-ui);
    text-transform: var(--ui-case);
    color: var(--rc);
  }
  .name {
    font-family: var(--f-display);
    text-transform: var(--ui-case);
    letter-spacing: var(--ui-tracking);
    font-weight: 700;
    font-size: var(--t-2xl);
    line-height: 1.1;
    color: var(--c);
  }
  .desc {
    font-size: var(--t-lg);
    line-height: 1.35;
    color: var(--moon);
  }
  .actions {
    display: flex;
    gap: var(--space-3);
    justify-content: flex-end;
    margin-top: var(--space-2);
    opacity: 0;
    transition: opacity 0.4s;
  }
  .actions.shown {
    opacity: 1;
  }

  /* Taking a boon: its plaque flares and swells, the rest fall away. */
  .plaque.taken {
    transform: scale(1.06) !important;
    box-shadow: 0 0 90px 10px color-mix(in oklab, var(--c) 70%, transparent) !important;
    border-color: var(--c);
  }
  .plaque.faded {
    opacity: 0 !important;
    transform: translateX(60px) !important;
  }
  @keyframes dim {
    from {
      background-color: rgba(0, 0, 0, 0.6);
    }
  }
  @keyframes arrive {
    from {
      opacity: 0;
      transform: scale(0.85);
      filter: blur(8px);
    }
  }
  @media (max-aspect-ratio: 1/1) {
    .stage {
      grid-template-columns: 1fr;
    }
  }

  /* Typography roles (see app.css): boon names, titles and speakers get their own faces. */
  .name {
    font-family: var(--f-boon);
    font-weight: 700;
    text-transform: none;
    letter-spacing: 0.02em;
  }
  .giver h1.speaker {
    font-family: var(--f-speaker);
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0.04em;
    color: var(--gold-bright);
  }
</style>
