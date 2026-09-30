<script lang="ts">
  import { nav } from '$lib/nav';
  import { page } from '$app/state';
  import { STARTER_IDS, type StarterId } from '@keycraft/engine';
  import { onMount } from 'svelte';
  import { startMusic, stopMusic } from '$lib/fx/audio';
  import { Session } from '$lib/game/session.svelte';
  import Combat from '$lib/screens/Combat.svelte';
  import Install from '$lib/screens/Install.svelte';
  import Intro from '$lib/screens/Intro.svelte';
  import Pause from '$lib/screens/Pause.svelte';
  import Results from '$lib/screens/Results.svelte';
  import Reward from '$lib/screens/Reward.svelte';
  import Settings from '$lib/screens/Settings.svelte';
  import Shop from '$lib/screens/Shop.svelte';

  type KeyTarget = { onKey(k: string): boolean };

  let session = $state<Session | null>(null);
  let settingsOpen = $state(false);
  let screen = $state<KeyTarget>();
  let overlay = $state<KeyTarget>();

  function begin(s: Session | null) {
    session?.unmount();
    session = s;
    if (!s) {
      nav('/');
      return;
    }
    s.mount();
  }

  function newRun() {
    const q = page.url.searchParams.get('starter') as StarterId | null;
    const starter = q && STARTER_IDS.includes(q) ? q : 'apprentice';
    begin(Session.start(starter));
  }

  onMount(() => {
    if (page.url.searchParams.has('resume')) begin(Session.resume());
    else newRun();
    startMusic();
    const blur = () => session?.pause();
    addEventListener('blur', blur);
    return () => {
      removeEventListener('blur', blur);
      session?.unmount();
      stopMusic();
    };
  });

  function onkeydown(e: KeyboardEvent) {
    if (!session || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.length === 1 && /[A-Z]/.test(e.key) ? e.key.toLowerCase() : e.key;
    if (e.repeat && k.length > 1) return;
    let handled: boolean;

    if (settingsOpen || (session.paused && overlay)) {
      handled = overlay?.onKey(k) ?? false;
    } else if (session.intro) {
      handled = screen?.onKey(k) ?? false;
    } else if (session.view.kind === 'combat') {
      handled = true;
      if (k === 'Escape') session.pause();
      else if (k === 'Tab') session.untarget();
      else if (k === 'Backspace') session.backspace();
      else if (k.length === 1 && !e.repeat) session.key(k);
      else handled = false;
    } else if (k === 'Escape' && session.view.kind !== 'over' && session.view.kind !== 'install') {
      session.pause();
      handled = true;
    } else {
      handled = screen?.onKey(k) ?? false;
    }
    if (handled || k === 'Tab' || k === ' ' || k === "'" || k === '/') e.preventDefault();
  }
</script>

<svelte:window {onkeydown} />
<svelte:head><title>Keycraft</title></svelte:head>

{#if session}
  {#key session}
    {#if session.intro}
      <Intro {session} bind:this={screen} />
    {:else if session.view.kind === 'combat'}
      <Combat {session} />
    {:else if session.view.kind === 'reward'}
      <Reward {session} bind:this={screen} />
    {:else if session.view.kind === 'install'}
      <Install {session} bind:this={screen} />
    {:else if session.view.kind === 'shop'}
      <Shop {session} bind:this={screen} />
    {:else}
      <Results {session} bind:this={screen} onagain={newRun} onhome={() => nav('/')} />
    {/if}
  {/key}

  {#if settingsOpen}
    <Settings bind:this={overlay} onclose={() => (settingsOpen = false)} />
  {:else if session.paused}
    <Pause
      bind:this={overlay}
      onresume={() => session?.unpause()}
      onsettings={() => (settingsOpen = true)}
      onabandon={() => {
        session?.abandon();
        nav('/');
      }}
    />
  {/if}
{/if}
