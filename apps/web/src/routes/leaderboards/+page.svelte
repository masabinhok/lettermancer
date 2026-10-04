<!-- Leaderboards: verified runs and practice tests, ranked. -->
<script lang="ts">
  import { dailyLabel, STARTERS, weeklyLabel, type StarterId } from '@lettermancer/engine';
  import { account, type BoardRow } from '$lib/cloud/account.svelte';
  import { cloudEnabled } from '$lib/cloud/client';
  import { nav } from '$lib/nav';
  import Frame from '$lib/ui/Frame.svelte';

  const now = new Date();
  const BOARDS = [
    { id: dailyLabel(now), name: 'Today', unit: 'score', about: "Today's daily rite. One attempt each." },
    { id: weeklyLabel(now), name: 'This week', unit: 'score', about: "This week's challenge. Best run counts." },
    { id: 'all-time', name: 'All time', unit: 'score', about: 'Best verified run of any kind.' },
    { id: 'heat', name: 'Heat', unit: 'Heat', about: 'The highest Heat each scribe has won at.' },
    {
      id: 'practice:time-15',
      name: 'Practice 15s',
      unit: 'wpm',
      about: 'Fifteen-second tests, 90% accuracy or better.',
    },
    { id: 'practice:time-60', name: 'Practice 60s', unit: 'wpm', about: 'Sixty-second tests, 90% accuracy or better.' },
  ] as const;

  let tab = $state(0);
  let data = $state<{ rows: BoardRow[]; you: BoardRow | null } | null | 'loading'>('loading');
  const board = $derived(BOARDS[tab]);
  const practice = $derived(board.id.startsWith('practice:'));

  $effect(() => {
    const id = board.id;
    // Refetch when you sign in, so "you" shows up.
    void account.user;
    data = 'loading';
    void account.board(id).then((d) => {
      if (board.id === id) data = d;
    });
  });

  function describe(r: BoardRow): string {
    const d = r.detail as { result?: string; act?: number; heat?: number; starter?: StarterId; accuracy?: number };
    if (d.accuracy !== undefined) return `${Math.round(d.accuracy * 100)}% accuracy`;
    const parts = [d.result === 'won' ? 'Won' : `Fell in Act ${d.act}`];
    if (d.starter && STARTERS[d.starter]) parts.push(STARTERS[d.starter].name);
    if (d.heat && board.id !== 'heat') parts.push(`Heat ${d.heat}`);
    return parts.join(' · ');
  }

  const race = (r: BoardRow) => nav(`/practice?ghost=${r.practice_id}&name=${encodeURIComponent(r.username)}`);

  function onkeydown(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape') nav('/');
    else if (e.key === 'ArrowRight') tab = (tab + 1) % BOARDS.length;
    else if (e.key === 'ArrowLeft') tab = (tab + BOARDS.length - 1) % BOARDS.length;
    else if (/^[1-6]$/.test(e.key)) tab = Number(e.key) - 1;
    else return;
    e.preventDefault();
  }
</script>

<svelte:window {onkeydown} />
<svelte:head><title>Leaderboards · Lettermancer</title></svelte:head>

<div class="page" data-screen="leaderboards">
  <header>
    <button class="back" onclick={() => nav('/')} type="button"><kbd>Esc</kbd> Scriptorium</button>
    <h1>Leaderboards</h1>
  </header>

  <div class="tabs" role="tablist" aria-label="Boards">
    {#each BOARDS as b, i (b.id)}
      <button role="tab" aria-selected={tab === i} class:on={tab === i} onclick={() => (tab = i)} type="button">
        <kbd>{i + 1}</kbd>
        {b.name}
      </button>
    {/each}
  </div>

  <Frame>
    <div class="board" role="tabpanel" aria-label={board.name}>
      <p class="about">{board.about} Every entry was replayed and checked by the server.</p>
      {#if !cloudEnabled}
        <p>Leaderboards need an online build. This copy saves everything in your browser only.</p>
      {:else if data === 'loading'}
        <p class="muted">Unrolling the scroll…</p>
      {:else if data === null}
        <p>The leaderboards can't be reached right now. Check your connection and try again.</p>
      {:else if !data.rows.length}
        <p class="muted">No one is on this board yet. Be the first.</p>
      {:else}
        <table>
          <thead>
            <tr>
              <th class="num">#</th>
              <th>Scribe</th>
              <th class="num">{board.unit === 'score' ? 'Score' : board.unit === 'wpm' ? 'WPM' : 'Heat'}</th>
              <th>Detail</th>
              {#if practice}<th></th>{/if}
            </tr>
          </thead>
          <tbody>
            {#each data.you ? [...data.rows, data.you] : data.rows as r (r.user_id)}
              <tr class:you={r.user_id === account.user?.id} class:gap={r === data.you}>
                <td class="num rank" class:podium={r.rank <= 3}>{r.rank}</td>
                <td>{r.username}{r.user_id === account.user?.id ? ' (you)' : ''}</td>
                <td class="num score">{Number(r.score).toLocaleString()}</td>
                <td class="muted">{describe(r)}</td>
                {#if practice}
                  <td>
                    {#if r.practice_id}<button class="race" onclick={() => race(r)} type="button">Race ghost</button
                      >{/if}
                  </td>
                {/if}
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
      {#if cloudEnabled && !account.user}
        <p class="note">
          <button class="link" onclick={() => nav('/login')} type="button">Sign in</button> to post your own runs and tests.
        </p>
      {/if}
    </div>
  </Frame>
</div>

<style>
  .page {
    height: 100%;
    overflow: auto;
    padding: var(--space-4) var(--space-6) var(--space-7);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    align-items: center;
  }
  .page > :global(*) {
    width: min(52.941rem, 100%);
  }
  header {
    display: flex;
    align-items: center;
    gap: var(--space-5);
  }
  .back {
    background: none;
    border: none;
    color: var(--moon-dim);
    cursor: pointer;
  }
  h1 {
    font-size: var(--t-2xl);
    color: var(--gold-bright);
  }
  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .tabs button {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: 0.353rem 0.706rem;
    background: var(--ink);
    border: 1px solid var(--rule);
    color: var(--moon-dim);
    cursor: pointer;
  }
  .tabs button.on {
    border-color: var(--gold);
    color: var(--gold-bright);
  }
  .board {
    padding: var(--space-4) var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .about,
  p {
    color: var(--moon-dim);
    font-size: var(--t-sm);
  }
  .muted {
    color: var(--moon-faint);
  }
  .note {
    font-size: var(--t-xs);
    color: var(--moon-faint);
  }
  .link {
    background: none;
    border: none;
    padding: 0;
    color: var(--gold);
    text-decoration: underline;
    cursor: pointer;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--t-sm);
  }
  th {
    text-align: left;
    font-weight: 400;
    color: var(--moon-faint);
    padding: 4px 0.471rem;
    border-bottom: 1px solid var(--rule);
  }
  td {
    padding: 0.353rem 0.471rem;
    border-bottom: 1px solid color-mix(in oklab, var(--rule) 50%, transparent);
  }
  .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .rank {
    color: var(--moon-faint);
    width: 3ch;
  }
  .podium {
    color: var(--gold-bright);
    font-weight: 700;
  }
  .score {
    font-family: var(--f-display);
    text-transform: uppercase;
    letter-spacing: 0.03em;
    font-weight: 700;
  }
  tr.you td {
    background: color-mix(in oklab, var(--gold-deep) 18%, transparent);
  }
  tr.gap td {
    border-top: 2px dashed var(--rule);
  }
  .race {
    background: none;
    border: 1px solid var(--rule);
    color: var(--moon-dim);
    padding: 2px 0.471rem;
    cursor: pointer;
    font-size: var(--t-xs);
  }
  .race:hover {
    border-color: var(--gold);
    color: var(--moon);
  }
</style>
