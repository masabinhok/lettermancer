<script lang="ts">
  import { heat, KEEPSAKES, keyWeakness, nemesisBigram, runScore, STARTERS, topWeakKeys } from '@keycraft/engine';
  import { untrack } from 'svelte';
  import type { Session } from '../game/session.svelte';
  import { profile } from '../stores/profile.svelte';
  import Button from '../ui/Button.svelte';
  import HeatLegend from '../ui/HeatLegend.svelte';
  import Keyboard from '../ui/Keyboard.svelte';

  let { session, onagain, onhome }: { session: Session; onagain: () => void; onhome: () => void } = $props();

  // The run is over, so these never change: read them once.
  const { run, report } = untrack(() => session.machine);
  const won = run.result === 'won';
  const t = run.totals;
  const typingMs = report.fights.reduce((s, f) => s + f.ms, 0);
  // Average over fights weighted by words, so idle time before the first key doesn't drag it down.
  const avgWpm = (() => {
    const w = report.fights.reduce((s, f) => s + f.words, 0);
    return w ? report.fights.reduce((s, f) => s + f.wpm * f.words, 0) / w : 0;
  })();
  const acc = t.correct + t.errors ? (t.correct / (t.correct + t.errors)) * 100 : 100;
  const weak = topWeakKeys(run.stats, 3);
  const nem = nemesisBigram(run.stats);
  const score = runScore(run);
  const runHeat = heat(run.oaths);
  const minutes = Math.floor(typingMs / 60000);
  const seconds = Math.round((typingMs % 60000) / 1000);

  export function onKey(k: string): boolean {
    if (k === 'Enter') onagain();
    else if (k === 'Escape') onhome();
    else return false;
    return true;
  }
</script>

<div class="results" data-screen="results">
  <header>
    <h1 class:won>{won ? 'Victory' : 'Fallen'}</h1>
    <p>
      {#if won}
        Every glyph bows to your keyboard.
      {:else}
        {report.killedBy ? `${report.killedBy} ended your run` : 'Your run ended'} in Act {run.act}. The keys remember.
      {/if}
    </p>
  </header>

  <div class="columns">
    <dl class="stats">
      <div class="score">
        <dt>Score{runHeat ? ` at Heat ${runHeat}` : ''}{run.gentle ? ' (gentle pace)' : ''}</dt>
        <dd>{score.toLocaleString()}</dd>
      </div>
      <div>
        <dt>Average speed</dt>
        <dd>{Math.round(avgWpm)} <small>wpm</small></dd>
      </div>
      <div>
        <dt>Fastest fight</dt>
        <dd>{Math.round(t.peakWpm)} <small>wpm</small></dd>
      </div>
      <div>
        <dt>Accuracy</dt>
        <dd>{acc.toFixed(1)}<small>%</small></dd>
      </div>
      <div>
        <dt>Best combo</dt>
        <dd>{t.maxCombo}</dd>
      </div>
      <div>
        <dt>Words</dt>
        <dd>{t.words}</dd>
      </div>
      <div>
        <dt>Time in combat</dt>
        <dd>{minutes}:{String(seconds).padStart(2, '0')}</dd>
      </div>
    </dl>

    <section class="insight">
      <h2>This run's heatmap</h2>
      <Keyboard heat={keyWeakness(run.stats)} layout={profile.settings.layout} size="compact" />
      <HeatLegend />
      <p class="notes">
        {#if weak.length}Your slowest keys were {weak.map((k) => k.toUpperCase()).join(', ')}; you'll meet them more
          often next run.{/if}
        {#if nem}Your hardest pair was “{nem.bigram}” at {Math.round(nem.ms)} ms.{/if}
      </p>
    </section>
  </div>

  {#if session.award}
    {@const a = session.award}
    <section class="earned" aria-label="What you earned">
      <p class="purse">
        <span><b class="ink">✒ {a.ink}</b> Ink</span>
        {#if a.leaf}<span><b class="leaf">❧ {a.leaf}</b> Gold Leaf</span>{/if}
        {#if a.seals}<span><b class="seal">✪ {a.seals}</b> Seals</span>{/if}
      </p>
      {#each a.prophecies as p (p.id)}
        <p class="prophecy"><b>✦ {p.name}</b> {p.desc}</p>
      {/each}
      {#each a.keepsakes as k (k)}
        <p class="prophecy"><b>New keepsake: {KEEPSAKES[k].name}.</b> {KEEPSAKES[k].levels[0]}</p>
      {/each}
      {#if a.keepsakeLevel}<p class="prophecy"><b>Your keepsake reached level {a.keepsakeLevel}.</b></p>{/if}
    </section>
  {/if}

  {#if session.unlocked.length}
    <p class="unlock">
      New keyboard{session.unlocked.length > 1 ? 's' : ''} unlocked: {session.unlocked
        .map((id) => STARTERS[id].name)
        .join(', ')}
    </p>
  {/if}

  <div class="actions">
    <Button kind="quiet" hotkey="Esc" onclick={onhome}>Title screen</Button>
    <Button hotkey="Enter" onclick={onagain}>Start another run</Button>
  </div>
</div>

<style>
  .results {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-5);
    padding: var(--space-5);
    animation: rise 0.6s var(--ease-out);
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
  }
  header {
    text-align: center;
  }
  h1 {
    font-size: var(--t-hero);
    color: var(--rose);
  }
  h1.won {
    color: var(--gold-bright);
    text-shadow: 0 0 40px rgba(217, 180, 91, 0.5);
  }
  header p {
    color: var(--moon-dim);
    font-size: var(--t-lg);
  }
  .columns {
    display: grid;
    grid-template-columns: auto auto;
    gap: var(--space-7);
    align-items: center;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(2, auto);
    gap: var(--space-4) var(--space-6);
    margin: 0;
  }
  .score {
    grid-column: span 2;
  }
  .score dd {
    color: var(--gold-bright);
    font-size: var(--t-3xl);
  }
  dt {
    font-size: var(--t-sm);
    color: var(--moon-faint);
  }
  dd {
    margin: 0;
    font-family: var(--f-display);
    font-weight: 700;
    font-size: var(--t-2xl);
  }
  dd small {
    font-size: var(--t-sm);
    color: var(--moon-dim);
    font-family: var(--f-text);
  }
  .insight {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }
  h2 {
    font-size: var(--t-md);
    color: var(--moon-dim);
  }
  .notes {
    max-width: 44ch;
    text-align: center;
    color: var(--moon-dim);
    font-size: var(--t-sm);
  }
  .earned {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
  }
  .purse {
    display: flex;
    gap: var(--space-5);
    color: var(--moon-dim);
  }
  .purse b {
    font-family: var(--f-display);
    font-size: var(--t-lg);
  }
  .ink {
    color: var(--echo);
  }
  .leaf {
    color: var(--gold-bright);
  }
  .seal {
    color: var(--rose);
  }
  .prophecy {
    font-size: var(--t-sm);
    color: var(--moon-dim);
  }
  .prophecy b {
    color: var(--gold-bright);
  }
  .unlock {
    padding: var(--space-2) var(--space-4);
    border: 1px solid var(--gold-deep);
    color: var(--gold-bright);
  }
  .actions {
    display: flex;
    gap: var(--space-4);
  }
  @media (max-width: 900px) {
    .columns {
      grid-template-columns: 1fr;
      gap: var(--space-4);
    }
  }
</style>
