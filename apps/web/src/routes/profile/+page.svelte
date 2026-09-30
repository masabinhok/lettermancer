<!-- Your profile: account, sync, history, and your data. -->
<script lang="ts">
  import { keyMastery, PROPHECIES } from '@keycraft/engine';
  import { account } from '$lib/cloud/account.svelte';
  import { cloudEnabled, supabase } from '$lib/cloud/client';
  import { nav } from '$lib/nav';
  import { profile } from '$lib/stores/profile.svelte';
  import Button from '$lib/ui/Button.svelte';
  import Frame from '$lib/ui/Frame.svelte';
  import Keyboard from '$lib/ui/Keyboard.svelte';

  interface RunRow {
    id: number;
    created_at: string;
    result: string;
    act: number;
    score: number;
    heat: number;
    mode: string;
    verified: boolean;
  }
  interface PracticeRow {
    id: number;
    created_at: string;
    test_id: string;
    wpm: number;
    accuracy: number;
  }

  const meta = profile.meta;
  // Editable, but follows the account's saved name when that changes.
  let name = $derived(account.username ?? '');
  let nameMsg = $state<string | null>(null);
  let runs = $state<RunRow[]>([]);
  let practice = $state<PracticeRow[]>([]);
  let confirmDelete = $state('');
  let deleting = $state(false);
  let deleteMsg = $state<string | null>(null);

  $effect(() => {
    const user = account.user;
    if (!supabase || !user) return;
    void supabase
      .from('runs')
      .select('id, created_at, result, act, score, heat, mode, verified')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(15)
      .then(({ data }) => (runs = (data ?? []) as RunRow[]));
    void supabase
      .from('practice_results')
      .select('id, created_at, test_id, wpm, accuracy')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => (practice = (data ?? []) as PracticeRow[]));
  });

  const bests = $derived(Object.entries(meta.practice.best).sort((a, b) => b[1] - a[1]));
  const localRuns = $derived(profile.analytics.slice(0, 15));

  async function saveName(e: SubmitEvent) {
    e.preventDefault();
    nameMsg = (await account.setUsername(name.trim())) ?? 'Saved.';
  }

  async function exportData() {
    const blob = await account.exportData();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `keycraft-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function del() {
    deleting = true;
    deleteMsg = await account.deleteAccount();
    deleting = false;
    if (!deleteMsg) nav('/');
  }

  const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && !(e.target instanceof HTMLInputElement)) nav('/');
  }
</script>

<svelte:window {onkeydown} />
<svelte:head><title>Profile · Keycraft</title></svelte:head>

<div class="page" data-screen="profile">
  <header>
    <button class="back" onclick={() => nav('/')} type="button"><kbd>Esc</kbd> Scriptorium</button>
    <h1>{account.username ?? (account.user ? 'Your profile' : 'Guest')}</h1>
  </header>

  <div class="grid">
    <Frame>
      <section class="card">
        <h2>Account</h2>
        {#if !cloudEnabled}
          <p>Accounts aren't set up on this copy. Everything is saved in this browser.</p>
        {:else if !account.user}
          <p>
            You're playing as a guest; progress is saved in this browser. Sign in to keep it on every device and to join
            the leaderboards.
          </p>
          <Button onclick={() => nav('/login')}>Sign in</Button>
        {:else}
          <p class="muted">{account.user.email}</p>
          <form onsubmit={saveName}>
            <label for="name">Name on the leaderboards</label>
            <div class="row">
              <input id="name" bind:value={name} maxlength="20" placeholder="quill_master" />
              <Button type="submit" kind="quiet">Save</Button>
            </div>
            {#if nameMsg}<p class="note">{nameMsg}</p>{/if}
          </form>
          <p class="muted">
            {account.syncing
              ? 'Syncing…'
              : account.lastSync
                ? `Synced ${new Date(account.lastSync).toLocaleString()}`
                : 'Not synced yet'}
            {#if account.error}<span class="error"> {account.error}</span>{/if}
          </p>
          <div class="row">
            <Button kind="quiet" onclick={() => account.pull()}>Sync now</Button>
            <Button kind="quiet" onclick={() => account.signOut()}>Sign out</Button>
          </div>
        {/if}
      </section>
    </Frame>

    <Frame>
      <section class="card">
        <h2>Record</h2>
        <dl>
          <div>
            <dt>Runs</dt>
            <dd>{meta.runs}</dd>
          </div>
          <div>
            <dt>Won</dt>
            <dd>{meta.wins}</dd>
          </div>
          <div>
            <dt>Best score</dt>
            <dd>{meta.bestScore.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Highest Heat won</dt>
            <dd>{meta.maxHeatWon}</dd>
          </div>
          <div>
            <dt>Prophecies</dt>
            <dd>{Object.keys(meta.prophecies).length} / {PROPHECIES.length}</dd>
          </div>
          <div>
            <dt>Practice streak</dt>
            <dd>{meta.practice.streak} days</dd>
          </div>
        </dl>
        {#if bests.length}
          <h3>Practice bests</h3>
          <p class="bests">
            {#each bests as [id, wpm] (id)}<span>{id.replace('-', ' ')}: <b>{wpm}</b></span>{/each}
          </p>
        {/if}
      </section>
    </Frame>

    <Frame>
      <section class="card">
        <h2>Key mastery</h2>
        <Keyboard mastery={keyMastery(profile.stats)} layout={profile.settings.layout} size="compact" />
      </section>
    </Frame>

    <Frame>
      <section class="card">
        <h2>Recent runs</h2>
        {#if runs.length}
          <table>
            <thead><tr><th>Date</th><th>Result</th><th>Heat</th><th>Score</th><th></th></tr></thead>
            <tbody>
              {#each runs as r (r.id)}
                <tr>
                  <td>{when(r.created_at)}</td>
                  <td
                    >{r.result === 'won' ? 'Won' : `Fell in act ${r.act}`}{r.mode !== 'standard'
                      ? ` (${r.mode})`
                      : ''}</td
                  >
                  <td>{r.heat}</td>
                  <td>{r.score.toLocaleString()}</td>
                  <td>{r.verified ? '✦' : ''}</td>
                </tr>
              {/each}
            </tbody>
          </table>
          <p class="note">✦ verified by the server and ranked</p>
        {:else if localRuns.length}
          <table>
            <thead><tr><th>Date</th><th>Result</th><th>Heat</th><th>Score</th></tr></thead>
            <tbody>
              {#each localRuns as r, i (i)}
                <tr>
                  <td>{when(r.date)}</td>
                  <td>{r.result === 'won' ? 'Won' : `Fell in act ${r.act}`}</td>
                  <td>{r.heat}</td>
                  <td>{(r.score ?? 0).toLocaleString()}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {:else}
          <p class="muted">No runs yet.</p>
        {/if}
        {#if practice.length}
          <h3>Recent practice</h3>
          <table>
            <tbody>
              {#each practice as p (p.id)}
                <tr
                  ><td>{when(p.created_at)}</td><td>{p.test_id}</td><td>{p.wpm} wpm</td><td
                    >{Math.round(p.accuracy * 100)}%</td
                  ></tr
                >
              {/each}
            </tbody>
          </table>
        {/if}
      </section>
    </Frame>

    <Frame>
      <section class="card">
        <h2>Your data</h2>
        <p>Download everything Keycraft holds about you: progress, stats, settings and history.</p>
        <Button kind="quiet" onclick={exportData}>Download my data</Button>
        {#if account.user}
          <h3>Delete account</h3>
          <p>
            This permanently deletes your account, cloud progress, runs and leaderboard entries. Progress saved in this
            browser stays.
          </p>
          <label for="confirm">Type <b>delete</b> to confirm</label>
          <div class="row">
            <input id="confirm" bind:value={confirmDelete} autocomplete="off" />
            <Button kind="quiet" disabled={confirmDelete !== 'delete' || deleting} onclick={del}
              >Delete my account</Button
            >
          </div>
          {#if deleteMsg}<p class="error" role="alert">{deleteMsg}</p>{/if}
        {/if}
      </section>
    </Frame>
  </div>
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
  header {
    width: min(1100px, 100%);
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
  .grid {
    width: min(1100px, 100%);
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4);
  }
  .card {
    padding: var(--space-4) var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    align-items: flex-start;
  }
  h2 {
    font-size: var(--t-lg);
    color: var(--gold);
  }
  h3 {
    font-size: var(--t-md);
    color: var(--moon-dim);
    margin-top: var(--space-2);
  }
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
  .error {
    color: var(--rose);
  }
  form {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    width: 100%;
  }
  label {
    font-size: var(--t-sm);
    color: var(--moon-dim);
  }
  .row {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }
  input {
    font: inherit;
    padding: 6px 10px;
    color: var(--moon);
    background: var(--night-deep);
    border: 1px solid var(--rule);
  }
  dl {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-3) var(--space-5);
    margin: 0;
  }
  dt {
    font-size: var(--t-xs);
    color: var(--moon-faint);
  }
  dd {
    margin: 0;
    font-family: var(--f-display);
    font-weight: 700;
    font-size: var(--t-lg);
  }
  .bests {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
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
    font-size: var(--t-xs);
  }
  td,
  th {
    padding: 3px 6px;
    border-bottom: 1px solid color-mix(in oklab, var(--rule) 60%, transparent);
  }
  @media (max-width: 900px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>
