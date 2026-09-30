<!-- The practice desk: timed tests, word counts, quotes, adaptive lessons and trials. -->
<script lang="ts">
  import {
    advancePractice,
    createPractice,
    ghostPos,
    ghostTrack,
    LESSON_ORDER,
    lessonFocus,
    letterLearned,
    letterProgress,
    pressPractice,
    recordPractice,
    replayPractice,
    summarizePractice,
    testId,
    TRIALS,
    type GhostTrack,
    type PracticeAward,
    type PracticeConfig,
    type PracticeMode,
    type PracticeResult,
    type PracticeState,
    type ProphecyDef,
    type TrialDef,
  } from '@keycraft/engine';
  import { onMount, tick } from 'svelte';
  import { account, type SubmitResult } from '$lib/cloud/account.svelte';
  import * as sfx from '$lib/fx/audio';
  import { nav } from '$lib/nav';
  import SpeedChart from '$lib/practice/SpeedChart.svelte';
  import { page } from '$app/state';
  import { profile, readStore, writeStore } from '$lib/stores/profile.svelte';
  import Button from '$lib/ui/Button.svelte';
  import Frame from '$lib/ui/Frame.svelte';
  import Keyboard from '$lib/ui/Keyboard.svelte';

  const AMOUNTS: Record<'time' | 'words', number[]> = { time: [15, 30, 60, 120], words: [10, 25, 50, 100] };
  const meta = profile.meta;

  let mode = $state<PracticeMode>('time');
  let amount = $state(30);
  let punctuation = $state(false);
  let numbers = $state(false);
  let trial = $state<TrialDef | null>(null);
  let showTrials = $state(false);

  let test = $state.raw<PracticeState | null>(null);
  let rev = $state(0); // bumped on every keystroke so the view re-reads the mutable test
  let result = $state.raw<PracticeResult | null>(null);
  let award = $state.raw<PracticeAward | null>(null);
  let prophecies = $state.raw<ProphecyDef[]>([]);
  let unlockedLetter = $state<string | null>(null);
  let textEl = $state<HTMLElement>();
  let submission = $state.raw<SubmitResult | 'sending' | null>(null);
  let inputs: { k: string; at: number }[] = [];
  let caretTop = $state(0);
  let clockStart = 0;

  // ---------- ghosts ----------
  // Your best recording of each test, kept on this device, and any ghost you chose to race from a leaderboard.
  const GHOST_KEY = 'keycraft.ghosts.v1';
  interface Recording {
    config: PracticeConfig;
    inputs: { k: string; at: number }[];
    wpm: number;
  }
  interface Ghost {
    name: string;
    wpm: number;
    config: PracticeConfig;
    track: GhostTrack;
  }
  const recordings = () => readStore<Record<string, Recording>>(GHOST_KEY, () => ({}));
  const toGhost = (name: string, r: Recording): Ghost => ({
    name,
    wpm: r.wpm,
    config: r.config,
    track: ghostTrack(r.config, r.inputs),
  });

  let raceBest = $state(false);
  let remote = $state.raw<Ghost | null>(null);
  let ghostNote = $state<string | null>(null);
  /** The ghost for the test you're set up to take, if racing one. */
  let ghost = $state.raw<Ghost | null>(null);
  const bestRecording = $derived.by(() => {
    void rev;
    if (trial || mode === 'lesson') return null;
    return recordings()[testId({ mode, amount, punctuation, numbers, seed: 0 })] ?? null;
  });

  function pickGhost(): Ghost | null {
    if (trial || mode === 'lesson') return null;
    if (remote) return remote;
    return raceBest && bestRecording ? toGhost('Your best', bestRecording) : null;
  }

  function toggleBest() {
    if (remote) {
      remote = null;
      raceBest = false;
    } else raceBest = !raceBest;
    void restart();
  }

  /** Keep the recording of a new best so it can be raced later. */
  function keepRecording(r: PracticeResult, cfg: PracticeConfig) {
    if (trial || cfg.mode === 'lesson') return;
    const all = recordings();
    if ((all[r.testId]?.wpm ?? -1) >= r.wpm) return;
    all[r.testId] = { config: cfg, inputs: [...inputs], wpm: r.wpm };
    writeStore(GHOST_KEY, all);
  }

  const letters = $derived(LESSON_ORDER.slice(0, meta.practice.lessonLetters));
  const typing = $derived.by(() => {
    void rev;
    return !!test && test.startAt !== null && !test.done;
  });
  const view = $derived.by(() => {
    void rev;
    if (!test) return null;
    const elapsed = test.startAt === null ? 0 : test.now - test.startAt;
    const correct = test.keys.filter((k) => k.ok).length;
    return {
      text: test.text,
      pos: test.pos,
      missed: new Set(test.missedAt),
      left:
        test.config.mode === 'time'
          ? Math.max(0, Math.ceil(test.config.amount - elapsed / 1000))
          : test.text.split(' ').length - test.text.slice(0, test.pos).split(' ').length + 1,
      wpm: elapsed > 1000 ? Math.round(correct / 5 / (elapsed / 60000)) : 0,
      next: test.text[test.pos]?.toLowerCase() ?? null,
      ghost: ghost ? ghostPos(ghost.track, test.startAt === null ? -1 : elapsed) : null,
    };
  });

  function config(): PracticeConfig {
    ghost = pickGhost();
    // Racing a ghost means the same words: take its config, seed and all.
    if (ghost) return { ...ghost.config };
    const seed = (Math.random() * 2 ** 32) >>> 0;
    if (trial) return { mode: trial.mode, amount: trial.amount, punctuation: trial.punctuation, numbers: false, seed };
    if (mode === 'lesson')
      return {
        mode,
        amount: 25,
        punctuation: false,
        numbers: false,
        seed,
        letters,
        focus: lessonFocus(letters, profile.stats),
      };
    return { mode, amount, punctuation, numbers, seed };
  }

  async function restart() {
    test = createPractice(config());
    result = null;
    award = null;
    prophecies = [];
    unlockedLetter = null;
    submission = null;
    inputs = [];
    rev++;
    await tick();
    caretTop = 0;
  }

  function setMode(m: PracticeMode) {
    trial = null;
    remote = null;
    mode = m;
    if (m === 'time' && !AMOUNTS.time.includes(amount)) amount = 30;
    if (m === 'words' && !AMOUNTS.words.includes(amount)) amount = 25;
    void restart();
  }

  function startTrial(t: TrialDef) {
    remote = null;
    trial = t;
    showTrials = false;
    void restart();
  }

  function finish() {
    if (!test) return;
    const r = summarizePractice(test);
    result = r;
    keepRecording(r, test.config);
    profile.addStats(test.stats);
    const day = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
    award = recordPractice(meta, r, day, trial?.id ?? null);
    if (test.config.mode === 'lesson' && meta.practice.lessonLetters < 26) {
      const newest = letters[letters.length - 1];
      if (letterLearned(newest, profile.stats)) {
        meta.practice.lessonLetters++;
        unlockedLetter = LESSON_ORDER[meta.practice.lessonLetters - 1];
      }
    }
    prophecies = profile.checkProphecies({ mode: r.mode, seconds: r.seconds, wpm: r.wpm, accuracy: r.accuracy });
    if (account.user) {
      submission = 'sending';
      void account.submitPractice(test.config, inputs, trial?.id ?? null).then((s) => (submission = s));
    }
    profile.saveMeta();
    if (award.trials.length || prophecies.length || award.newBest) sfx.boon();
  }

  async function followCaret() {
    await tick();
    const caret = textEl?.querySelector<HTMLElement>('.caret');
    if (caret) caretTop = caret.offsetTop;
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape') {
      if (showTrials) showTrials = false;
      else if (typing) void restart();
      else nav('/');
      e.preventDefault();
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      void restart();
      return;
    }
    if (result) {
      if (e.key === 'Enter') {
        e.preventDefault();
        void restart();
      }
      return;
    }
    if (!test || showTrials || e.key.length !== 1 || e.repeat) return;
    e.preventDefault();
    const now = performance.now();
    if (test.startAt === null) clockStart = now;
    const at = Math.round(now - clockStart);
    inputs.push({ k: e.key, at });
    const ok = pressPractice(test, e.key, at);
    if (ok) sfx.keyClick(0);
    else sfx.miss();
    rev++;
    if (test.done) finish();
    else void followCaret();
  }

  /** `?ghost=<id>` races a ranked test from the leaderboards. */
  async function loadRemoteGhost(id: number) {
    const rec = await account.practiceGhost(id);
    const wpm = rec ? replayPractice(rec.config, rec.inputs)?.wpm : undefined;
    if (!rec || wpm === undefined) {
      ghostNote = 'That ghost could not be found.';
      return;
    }
    remote = toGhost(page.url.searchParams.get('name') ?? 'Ghost', { ...rec, wpm });
    mode = rec.config.mode;
    amount = rec.config.amount;
    punctuation = rec.config.punctuation;
    numbers = rec.config.numbers;
    await restart();
  }

  onMount(() => {
    const g = Number(page.url.searchParams.get('ghost'));
    if (g) void loadRemoteGhost(g);
    void restart();
    let raf = 0;
    const frame = () => {
      if (test && test.startAt !== null && !test.done) {
        advancePractice(test, Math.round(performance.now() - clockStart));
        rev++;
        if (test.done) finish();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  });

  const best = $derived(result ? meta.practice.best[result.testId] : null);
</script>

<svelte:window {onkeydown} />
<svelte:head><title>Practice · Keycraft</title></svelte:head>

<div class="practice" class:focus={typing} data-screen="practice">
  <header class="bar">
    <button class="back" onclick={() => nav('/')} type="button"><kbd>Esc</kbd> Scriptorium</button>
    <div class="modes" role="tablist" aria-label="Test type">
      {#each [['time', 'Time'], ['words', 'Words'], ['quote', 'Quote'], ['lesson', 'Lesson']] as const as [m, label] (m)}
        <button
          role="tab"
          aria-selected={!trial && mode === m}
          class:on={!trial && mode === m}
          onclick={() => setMode(m)}
          type="button">{label}</button
        >
      {/each}
      <button role="tab" aria-selected={!!trial} class:on={!!trial} onclick={() => (showTrials = true)} type="button"
        >Trials</button
      >
    </div>
    {#if !trial && (mode === 'time' || mode === 'words')}
      <div class="amounts">
        {#each AMOUNTS[mode] as a (a)}
          <button
            class:on={amount === a}
            onclick={() => {
              amount = a;
              void restart();
            }}
            type="button">{a}{mode === 'time' ? 's' : ''}</button
          >
        {/each}
        <span class="sep"></span>
        <button class:on={punctuation} onclick={() => ((punctuation = !punctuation), restart())} type="button"
          >punctuation</button
        >
        <button class:on={numbers} onclick={() => ((numbers = !numbers), restart())} type="button">numbers</button>
        {#if bestRecording || remote}
          <span class="sep"></span>
          <button
            class:on={!!ghost}
            onclick={toggleBest}
            title="Race a ghost of your best run at this test"
            type="button"
            >{remote ? `ghost: ${remote.name}` : `ghost${bestRecording ? ` ${bestRecording.wpm}` : ''}`}</button
          >
        {/if}
      </div>
    {/if}
    <p class="streak" title="Days in a row with practice">
      {meta.practice.streak ? `${meta.practice.streak}-day streak` : 'No streak yet'}. Ink today {meta.practice
        .inkToday} of 60.
    </p>
  </header>

  {#if trial}
    <p class="trial-banner">
      <b>{trial.name}.</b> Reach {trial.minWpm} wpm at {Math.round(trial.minAccuracy * 100)}% accuracy
      {trial.mode === 'time' ? `in ${trial.amount} seconds` : `over ${trial.amount} words`}{trial.punctuation
        ? ', with punctuation'
        : ''}.
    </p>
  {/if}

  {#if mode === 'lesson' && !trial && !result}
    <div class="lesson">
      {#each letters as k (k)}
        <span
          class="lk"
          class:focus={test?.config.focus === k}
          title="{Math.round(letterProgress(k, profile.stats) * 100)}% learned"
        >
          {k}<i style:width="{letterProgress(k, profile.stats) * 100}%"></i>
        </span>
      {/each}
      {#if meta.practice.lessonLetters < 26}<span class="lk locked">{LESSON_ORDER[meta.practice.lessonLetters]}</span
        >{/if}
    </div>
  {/if}

  {#if result && award}
    <section class="result">
      <div class="big">
        <div><span class="n">{result.wpm}</span><span class="u">wpm</span></div>
        <div><span class="n">{Math.round(result.accuracy * 100)}%</span><span class="u">accuracy</span></div>
      </div>
      <dl class="small">
        <div>
          <dt>Raw</dt>
          <dd>{result.raw}</dd>
        </div>
        <div>
          <dt>Consistency</dt>
          <dd>{result.consistency}%</dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd>{result.seconds}s</dd>
        </div>
        <div>
          <dt>Typos</dt>
          <dd>{result.errors}</dd>
        </div>
        <div>
          <dt>Best at this test</dt>
          <dd>{best ?? result.wpm}{award.newBest ? ' (new best)' : ''}</dd>
        </div>
      </dl>
      <SpeedChart series={result.series} />
      {#if result.slowLetters.length}
        <p class="slow">
          You slowed down on {result.slowLetters.map((l) => `${l.key.toUpperCase()} (${l.ms} ms)`).join(', ')}.
        </p>
      {/if}
      {#if result.source}<p class="source">— {result.source}</p>{/if}
      <p class="earned">
        +{award.ink} Ink{award.ink === 0 ? ' (today’s practice Ink is spent)' : ''}.
        {#each award.trials as t (t.id)}<b>
            {t.name} passed: +{t.leaf} Gold Leaf{t.raisesHeat ? ', and you may swear one more Heat' : ''}.</b
          >{/each}
        {#if trial && !award.trials.length && !meta.trialsPassed.includes(trial.id)}
          Not this time — the trial waits.{/if}
        {#if unlockedLetter}<b> New letter unlocked: {unlockedLetter.toUpperCase()}.</b>{/if}
        {#each prophecies as p (p.id)}<b> ✦ {p.name}.</b>{/each}
      </p>
      {#if ghost}
        {@const diff = result.wpm - ghost.wpm}
        <p class="earned ghost-line">
          {ghost.name} typed {ghost.wpm} wpm. {diff > 0
            ? `You beat the ghost by ${diff}.`
            : diff === 0
              ? 'A dead heat.'
              : `The ghost won by ${-diff}.`}
        </p>
      {/if}
      {#if submission && submission !== 'sending' && submission.ok}
        {@const st = Object.values(submission.standings)[0]}
        {#if st}<p class="earned">
            Verified and ranked: {st.rank ? `#${st.rank}` : ''}{st.improved ? ', a new best' : ''}.
          </p>{/if}
      {/if}
      <Button hotkey="Enter" onclick={() => restart()}>Next test</Button>
    </section>
  {:else if view}
    {#if ghostNote}<p class="hint">{ghostNote}</p>{/if}
    <div class="live">
      <span class="left">{view.left}{test?.config.mode === 'time' ? 's' : ' words'}</span>
      {#if ghost}<span class="ghost-name">racing {ghost.name} · {ghost.wpm} wpm</span>{/if}
      <span class="wpm">{view.wpm ? `${view.wpm} wpm` : ''}</span>
    </div>
    <div class="window">
      <p class="text" bind:this={textEl} style:transform="translateY({-Math.max(0, caretTop - 52)}px)" aria-live="off">
        {#each [...view.text] as ch, i (i)}<span
            class:done={i < view.pos}
            class:caret={i === view.pos}
            class:ghost={i === view.ghost && i !== view.pos}
            class:missed={view.missed.has(i)}>{ch}</span
          >{/each}
      </p>
    </div>
    <p class="hint">
      {#if !typing}Start typing to begin. <kbd>Tab</kbd> for new words. <kbd>Esc</kbd> to leave.{/if}
    </p>
    {#if mode === 'lesson' || profile.settings.keyboard !== 'hidden'}
      <div class="kb">
        <Keyboard
          layout={profile.settings.layout}
          next={view.next}
          size="compact"
          fingerHints={profile.settings.fingerHints}
        />
      </div>
    {/if}
  {/if}
</div>

{#if showTrials}
  <div class="scrim" role="dialog" aria-modal="true" aria-label="Trials" data-screen="trials">
    <Frame ornate>
      <div class="trials">
        <h2>Trials</h2>
        <p class="intro">Clear a trial to earn Gold Leaf. Most also let you swear one more Heat of Oaths.</p>
        <ul>
          {#each TRIALS as t (t.id)}
            {@const passed = meta.trialsPassed.includes(t.id)}
            <li>
              <button class:passed onclick={() => startTrial(t)} type="button">
                <span class="mark">{passed ? '✦' : '✧'}</span>
                <span class="tt"
                  ><b>{t.name}</b>
                  <span
                    >{t.minWpm} wpm at {Math.round(t.minAccuracy * 100)}%, {t.mode === 'time'
                      ? `${t.amount} seconds`
                      : `${t.amount} words`}{t.punctuation ? ', punctuation' : ''}</span
                  ></span
                >
                <span class="rw">{passed ? 'Passed' : `${t.leaf} Gold Leaf${t.raisesHeat ? ', +1 Heat' : ''}`}</span>
              </button>
            </li>
          {/each}
        </ul>
        <Button kind="quiet" hotkey="Esc" onclick={() => (showTrials = false)}>Close</Button>
      </div>
    </Frame>
  </div>
{/if}

<style>
  .practice {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-4) var(--space-6);
    overflow: auto;
  }
  .bar {
    width: min(1000px, 100%);
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-4);
    transition: opacity 0.4s;
  }
  .focus .bar,
  .focus .hint,
  .focus .lesson {
    opacity: 0.08;
  }
  .back {
    background: none;
    border: none;
    color: var(--moon-dim);
    cursor: pointer;
  }
  .modes,
  .amounts {
    display: flex;
    gap: 2px;
    background: var(--ink);
    padding: 3px;
    border: 1px solid var(--rule);
  }
  .modes button,
  .amounts button {
    background: none;
    border: none;
    padding: 4px 10px;
    color: var(--moon-faint);
    cursor: pointer;
    font-size: var(--t-sm);
  }
  .modes .on,
  .amounts .on {
    color: var(--gold-bright);
  }
  .sep {
    width: 1px;
    background: var(--rule);
    margin: 0 4px;
  }
  .streak {
    margin-left: auto;
    font-size: var(--t-xs);
    color: var(--moon-faint);
  }
  .trial-banner {
    color: var(--moon-dim);
  }
  .trial-banner b {
    color: var(--gold-bright);
  }
  .lesson {
    display: flex;
    gap: 6px;
  }
  .lk {
    position: relative;
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    font-family: var(--f-type);
    font-weight: 700;
    text-transform: uppercase;
    border: 1px solid var(--rule);
    overflow: hidden;
  }
  .lk i {
    position: absolute;
    left: 0;
    bottom: 0;
    height: 3px;
    background: var(--witchfire);
  }
  .lk.focus {
    border-color: var(--gold);
    color: var(--gold-bright);
  }
  .lk.locked {
    opacity: 0.3;
    border-style: dashed;
  }
  .live {
    width: min(1000px, 100%);
    display: flex;
    justify-content: space-between;
    font-family: var(--f-display);
    font-size: var(--t-xl);
    color: var(--gold);
    min-height: 2em;
  }
  .window {
    width: min(1000px, 100%);
    height: 156px;
    overflow: hidden;
  }
  .text {
    margin: 0;
    font-family: var(--f-type);
    font-size: 1.85rem;
    line-height: 52px;
    color: var(--moon-faint);
    transition: transform 0.15s var(--ease-out);
    word-break: keep-all;
  }
  .text span {
    white-space: pre-wrap;
  }
  .done {
    color: var(--moon);
  }
  .missed {
    color: var(--rose);
  }
  .done.missed {
    text-decoration: underline;
    text-decoration-color: var(--rose);
  }
  .caret {
    color: var(--moon);
    box-shadow: inset 2px 0 0 var(--gold-bright);
    animation: caret 1s steps(2) infinite;
  }
  .ghost {
    box-shadow: inset 2px 0 0 var(--witchfire);
  }
  .ghost-name {
    color: var(--witchfire);
    font-size: var(--t-sm);
  }
  .focus .caret {
    animation: none;
  }
  @keyframes caret {
    50% {
      box-shadow: inset 2px 0 0 transparent;
    }
  }
  .hint {
    font-size: var(--t-sm);
    color: var(--moon-faint);
    min-height: 1.4em;
    transition: opacity 0.4s;
  }
  .kb {
    margin-top: var(--space-2);
  }
  .result {
    width: min(820px, 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
  }
  .big {
    display: flex;
    gap: var(--space-7);
  }
  .big div {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
  }
  .big .n {
    font-family: var(--f-display);
    font-weight: 700;
    font-size: 4rem;
    color: var(--gold-bright);
    line-height: 1;
  }
  .big .u {
    color: var(--moon-dim);
  }
  .small {
    display: flex;
    gap: var(--space-5);
    margin: 0;
  }
  dt {
    font-size: var(--t-xs);
    color: var(--moon-faint);
  }
  dd {
    margin: 0;
    font-weight: 700;
  }
  .slow,
  .source,
  .earned {
    color: var(--moon-dim);
    font-size: var(--t-sm);
    text-align: center;
  }
  .earned b {
    color: var(--gold-bright);
  }
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 84;
    display: grid;
    place-items: center;
    background: rgba(12, 9, 20, 0.84);
  }
  .trials {
    width: min(640px, 92vw);
    padding: var(--space-5) var(--space-6);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
  }
  .trials h2 {
    font-size: var(--t-2xl);
    color: var(--gold-bright);
  }
  .intro {
    color: var(--moon-dim);
  }
  .trials ul {
    width: 100%;
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .trials li button {
    width: 100%;
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: var(--space-3);
    align-items: center;
    text-align: left;
    padding: var(--space-2) var(--space-3);
    background: var(--ink);
    border: 1px solid var(--rule);
    cursor: pointer;
  }
  .trials li button:hover {
    border-color: var(--gold);
  }
  .mark {
    color: var(--moon-faint);
  }
  .passed .mark {
    color: var(--gold-bright);
  }
  .tt {
    display: flex;
    flex-direction: column;
  }
  .tt span {
    font-size: var(--t-xs);
    color: var(--moon-dim);
  }
  .rw {
    font-size: var(--t-xs);
    color: var(--gold);
  }
</style>
