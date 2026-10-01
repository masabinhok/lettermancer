<!-- Sign in with an emailed link, GitHub or Google. Playing as a guest always works. -->
<script lang="ts">
  import { account } from '$lib/cloud/account.svelte';
  import { cloudEnabled } from '$lib/cloud/client';
  import { nav } from '$lib/nav';
  import Button from '$lib/ui/Button.svelte';
  import Frame from '$lib/ui/Frame.svelte';

  let email = $state('');
  let sent = $state(false);
  let error = $state<string | null>(null);
  let busy = $state(false);

  $effect(() => {
    if (account.user) nav('/profile');
  });

  async function send(e: SubmitEvent) {
    e.preventDefault();
    busy = true;
    error = await account.sendMagicLink(email.trim());
    busy = false;
    sent = !error;
  }

  async function social(p: 'github' | 'google') {
    error = await account.signInWith(p);
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') nav('/');
  }
</script>

<svelte:window {onkeydown} />
<svelte:head><title>Sign in · Lettermancer</title></svelte:head>

<div class="page" data-screen="login">
  <Frame ornate>
    <div class="inner">
      <h1>Sign in</h1>
      {#if !cloudEnabled}
        <p>Accounts aren't set up on this copy of Lettermancer. Your progress is saved in this browser.</p>
      {:else if sent}
        <p>Check <b>{email}</b> for a sign-in link. You can close this tab once you've used it.</p>
        {#if import.meta.env.DEV}<p class="dev">
            Running locally? The email is in Mailpit at http://127.0.0.1:54324.
          </p>{/if}
      {:else}
        <p>Keep your progress on every device and join the leaderboards. Your guest progress comes with you.</p>
        <form onsubmit={send}>
          <label for="email">Email</label>
          <input
            id="email"
            type="email"
            required
            autocomplete="email"
            bind:value={email}
            placeholder="you@example.com"
          />
          <Button type="submit" disabled={busy || !email}>Email me a sign-in link</Button>
        </form>
        <div class="or"><span>or</span></div>
        <div class="social">
          <Button kind="quiet" onclick={() => social('github')}>Continue with GitHub</Button>
          <Button kind="quiet" onclick={() => social('google')}>Continue with Google</Button>
        </div>
      {/if}
      {#if error}<p class="error" role="alert">{error}</p>{/if}
      <button class="guest" onclick={() => nav('/')} type="button"><kbd>Esc</kbd> Keep playing as a guest</button>
      <button class="guest" onclick={() => nav('/privacy')} type="button">What we store: privacy notice</button>
    </div>
  </Frame>
</div>

<style>
  .page {
    height: 100%;
    display: grid;
    place-items: center;
    padding: var(--space-5);
  }
  .inner {
    width: min(460px, 90vw);
    padding: var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    text-align: center;
  }
  h1 {
    font-size: var(--t-2xl);
    color: var(--gold-bright);
  }
  p {
    color: var(--moon-dim);
  }
  form {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    text-align: left;
  }
  label {
    font-size: var(--t-sm);
    color: var(--moon-dim);
  }
  input {
    font: inherit;
    padding: 10px 12px;
    color: var(--moon);
    background: var(--night-deep);
    border: 1px solid var(--rule);
  }
  input:focus {
    border-color: var(--gold);
    outline: none;
  }
  form :global(.btn) {
    justify-content: center;
    margin-top: var(--space-2);
  }
  .or {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    color: var(--moon-faint);
    font-size: var(--t-sm);
  }
  .or::before,
  .or::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--rule);
  }
  .social {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .social :global(.btn) {
    justify-content: center;
  }
  .error {
    color: var(--rose);
  }
  .dev {
    font-size: var(--t-xs);
    color: var(--moon-faint);
  }
  .guest {
    background: none;
    border: none;
    color: var(--moon-faint);
    cursor: pointer;
  }
</style>
