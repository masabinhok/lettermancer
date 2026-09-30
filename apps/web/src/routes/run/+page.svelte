<script lang="ts">
  import { page } from '$app/state';
  import { STARTER_IDS, type StarterId } from '@keycraft/engine';
  import { onMount } from 'svelte';
  import { startMusic, stopMusic } from '$lib/fx/audio';
  import { runBonuses } from '$lib/game/progression';
  import { Session } from '$lib/game/session.svelte';
  import { nav } from '$lib/nav';
  import Build from '$lib/screens/Build.svelte';
  import Challenge from '$lib/screens/Challenge.svelte';
  import Combat from '$lib/screens/Combat.svelte';
  import Doors from '$lib/screens/Doors.svelte';
  import Event from '$lib/screens/Event.svelte';
  import Install from '$lib/screens/Install.svelte';
  import Intro from '$lib/screens/Intro.svelte';
  import Pause from '$lib/screens/Pause.svelte';
  import Results from '$lib/screens/Results.svelte';
  import Reward from '$lib/screens/Reward.svelte';
  import Settings from '$lib/screens/Settings.svelte';
  import Shop from '$lib/screens/Shop.svelte';
  import { profile } from '$lib/stores/profile.svelte';

  type KeyTarget = { onKey(k: string): boolean };

  let session = $state<Session | null>(null);
  let settingsOpen = $state(false);
  let buildOpen = $state(false);
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
    const starter = q && STARTER_IDS.includes(q) ? q : profile.meta.lastStarter;
    begin(
      Session.start({
        starter,
        oaths: profile.meta.oaths,
        gentle: profile.meta.gentle,
        bonuses: runBonuses(profile.meta),
      }),
    );
  }

  function openBuild() {
    session?.pause();
    buildOpen = true;
  }

  function closeBuild() {
    buildOpen = false;
    // Opened from a room (not the pause menu): nothing else is paused, so carry on.
    if (session?.view.kind !== 'combat' && session?.view.kind !== 'challenge') session?.unpause();
  }

  /** Move keyboard focus between the buttons, doors and cards on a room screen. */
  function moveFocus(dir: 1 | -1) {
    const items = [
      ...document.querySelectorAll<HTMLElement>('[data-screen] :is(.card, .btn, .door, .option):not(:disabled)'),
    ];
    if (!items.length) return;
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + dir + items.length) % items.length].focus();
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
    const k = e.key;
    if (e.repeat && k.length > 1) return;
    const kind = session.view.kind;
    const typing = (kind === 'combat' || kind === 'challenge') && !session.intro;
    const focusedButton = document.activeElement instanceof HTMLButtonElement;
    let handled: boolean;

    if (settingsOpen || buildOpen || (session.paused && overlay)) {
      handled = overlay?.onKey(k) ?? false;
    } else if (session.intro) {
      handled = screen?.onKey(k) ?? false;
    } else if (typing) {
      handled = true;
      if (k === 'Escape') session.pause();
      else if (k === 'Tab') session.untarget();
      else if (k === 'Backspace') session.backspace();
      else if (k.length === 1 && !e.repeat) session.key(k);
      else handled = false;
    } else if (k === 'Escape' && kind !== 'over' && kind !== 'install') {
      session.pause();
      handled = true;
    } else if (k === 'b' && kind !== 'install' && kind !== 'over') {
      openBuild();
      handled = true;
    } else if (k.startsWith('Arrow') && kind !== 'over') {
      moveFocus(k === 'ArrowRight' || k === 'ArrowDown' ? 1 : -1);
      handled = true;
    } else if (k === 'Enter' && focusedButton) {
      // Let the focused card or button take the Enter natively.
      return;
    } else {
      handled = screen?.onKey(k.length === 1 ? k.toLowerCase() : k) ?? false;
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
    {:else if session.view.kind === 'doors'}
      <Doors {session} onbuild={openBuild} bind:this={screen} />
    {:else if session.view.kind === 'combat'}
      <Combat {session} onbuild={openBuild} />
    {:else if session.view.kind === 'challenge'}
      <Challenge {session} />
    {:else if session.view.kind === 'reward'}
      <Reward {session} onbuild={openBuild} bind:this={screen} />
    {:else if session.view.kind === 'install'}
      <Install {session} onbuild={openBuild} bind:this={screen} />
    {:else if session.view.kind === 'shop'}
      <Shop {session} onbuild={openBuild} bind:this={screen} />
    {:else if session.view.kind === 'event'}
      <Event {session} onbuild={openBuild} bind:this={screen} />
    {:else}
      <Results {session} bind:this={screen} onagain={newRun} onhome={() => nav('/')} />
    {/if}
  {/key}

  {#if settingsOpen}
    <Settings bind:this={overlay} onclose={() => (settingsOpen = false)} />
  {:else if buildOpen}
    <Build
      bind:this={overlay}
      keyMods={session.run.keyMods}
      relics={session.run.relics}
      blessings={session.run.blessings}
      onclose={closeBuild}
    />
  {:else if session.paused}
    <Pause
      bind:this={overlay}
      onresume={() => session?.unpause()}
      onsettings={() => (settingsOpen = true)}
      onbuild={() => (buildOpen = true)}
      onabandon={() => {
        session?.abandon();
        nav('/');
      }}
    />
  {/if}
{/if}
