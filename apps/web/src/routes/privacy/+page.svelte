<!-- What Keycraft stores, where, and how to take it back. -->
<script lang="ts">
  import { nav } from '$lib/nav';
  import Frame from '$lib/ui/Frame.svelte';

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') nav('/');
  }
</script>

<svelte:window {onkeydown} />
<svelte:head><title>Privacy · Keycraft</title></svelte:head>

<div class="page" data-screen="privacy">
  <header>
    <button class="back" onclick={() => nav('/')} type="button"><kbd>Esc</kbd> Scriptorium</button>
    <h1>Privacy</h1>
  </header>

  <Frame>
    <article>
      <p class="lead">
        Keycraft collects as little as it can. There are no ads, no trackers and no analytics. Fonts and sounds are
        served with the game, so no third party sees you play.
      </p>

      <h2>Playing as a guest</h2>
      <p>
        Everything stays in your browser's local storage: your progress, settings, per-key typing speeds, a save of the
        run in progress, and recordings of your best practice tests (for ghosts). Nothing is sent anywhere. Clearing
        your browser's site data erases it.
      </p>

      <h2>If you sign in</h2>
      <p>We store the following in our database, which is hosted by Supabase:</p>
      <ul>
        <li>your email address, or the account ID from GitHub or Google if you use one of them to sign in;</li>
        <li>the username you choose, if any;</li>
        <li>your progress, settings and per-key typing statistics, so they follow you between devices;</li>
        <li>
          runs and practice tests you finish. This includes their keystroke timings, so the server can check them and so
          they can be replayed.
        </li>
      </ul>

      <h2>What is public</h2>
      <p>
        Leaderboards show your username (or “Scribe” and four characters of your account ID), your score, and a short
        summary. The keystrokes of a ranked practice test can be raced as a ghost by anyone. Your email is never shown.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li><b>Download everything</b> we hold about you, as JSON, from your profile.</li>
        <li>
          <b>Delete your account</b> from your profile. That removes your account and every row tied to it, including leaderboard
          entries. It can't be undone. Progress on this device stays unless you clear it.
        </li>
        <li>Keep playing as a guest. Every part of the game works without an account.</li>
      </ul>

      <h2>Cookies</h2>
      <p>
        We don't set cookies. When you're signed in, your session token is kept in local storage so you stay signed in.
      </p>

      <h2>Contact</h2>
      <p>
        Questions or requests: open an issue on the project's GitHub. For anything private, use the email on the
        maintainer's GitHub profile.
      </p>
      <p class="note">Last updated 30 September 2026.</p>
    </article>
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
    width: min(760px, 100%);
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
  article {
    padding: var(--space-5) var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    line-height: 1.55;
  }
  h2 {
    font-size: var(--t-lg);
    color: var(--gold);
    margin-top: var(--space-3);
  }
  p,
  li {
    color: var(--moon-dim);
  }
  .lead {
    color: var(--moon);
    font-size: var(--t-lg);
  }
  ul {
    padding-left: 1.2em;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  b {
    color: var(--moon);
  }
  .note {
    font-size: var(--t-xs);
    color: var(--moon-faint);
  }
</style>
