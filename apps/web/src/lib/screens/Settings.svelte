<script lang="ts">
  import { profile, type KeyboardLayout, type Settings } from '../stores/profile.svelte';
  import Button from '../ui/Button.svelte';
  import Frame from '../ui/Frame.svelte';

  let { onclose }: { onclose: () => void } = $props();
  const s = profile.settings;

  function set<K extends keyof Settings>(k: K, v: Settings[K]) {
    s[k] = v;
    profile.saveSettings();
  }

  export function onKey(k: string): boolean {
    if (k === 'Escape') {
      onclose();
      return true;
    }
    return false;
  }

  const layouts: KeyboardLayout[] = ['qwerty', 'dvorak', 'colemak', 'azerty'];
</script>

<div class="scrim" role="dialog" aria-modal="true" aria-labelledby="settings-title">
  <Frame ornate>
    <form class="inner" onsubmit={(e) => e.preventDefault()}>
      <h2 id="settings-title">Settings</h2>

      <fieldset>
        <legend>Sound</legend>
        {#each [['volume', 'Master'], ['sfx', 'Effects'], ['music', 'Music']] as const as [k, label] (k)}
          <label class="slider">
            <span>{label}</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={s[k]}
              oninput={(e) => set(k, Number(e.currentTarget.value))}
            />
            <output>{Math.round(s[k] * 100)}%</output>
          </label>
        {/each}
      </fieldset>

      <fieldset>
        <legend>Keyboard</legend>
        <label>
          <span>Layout</span>
          <select value={s.layout} onchange={(e) => set('layout', e.currentTarget.value as KeyboardLayout)}>
            {#each layouts as l (l)}<option value={l}
                >{l === 'qwerty' ? 'QWERTY' : l[0].toUpperCase() + l.slice(1)}</option
              >{/each}
          </select>
        </label>
        <label>
          <span>On-screen keyboard in fights</span>
          <select value={s.keyboard} onchange={(e) => set('keyboard', e.currentTarget.value as Settings['keyboard'])}>
            <option value="full">Full size</option>
            <option value="compact">Compact</option>
            <option value="hidden">Hidden</option>
          </select>
        </label>
        <label class="check">
          <input
            type="checkbox"
            checked={s.fingerHints}
            onchange={(e) => set('fingerHints', e.currentTarget.checked)}
          />
          <span>Color keys by the finger that should press them</span>
        </label>
      </fieldset>

      <fieldset>
        <legend>Comfort</legend>
        <label>
          <span>Reduce motion</span>
          <select
            value={s.reducedMotion}
            onchange={(e) => set('reducedMotion', e.currentTarget.value as Settings['reducedMotion'])}
          >
            <option value="system">Follow my system</option>
            <option value="on">Always</option>
            <option value="off">Never</option>
          </select>
        </label>
        <label class="check">
          <input
            type="checkbox"
            checked={s.powerSymbols}
            onchange={(e) => set('powerSymbols', e.currentTarget.checked)}
          />
          <span>Show power symbols above letters, not just color</span>
        </label>
        <label>
          <span>Text size</span>
          <select value={String(s.fontScale)} onchange={(e) => set('fontScale', Number(e.currentTarget.value))}>
            <option value="1">Standard</option>
            <option value="1.1">Large</option>
            <option value="1.2">Larger</option>
          </select>
        </label>
      </fieldset>

      <Button hotkey="Esc" onclick={onclose}>Done</Button>
    </form>
  </Frame>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 85;
    display: grid;
    place-items: center;
    background: rgba(12, 9, 20, 0.8);
    backdrop-filter: blur(3px);
    overflow: auto;
  }
  .inner {
    width: min(520px, 92vw);
    padding: var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  h2 {
    font-size: var(--t-2xl);
    color: var(--gold-bright);
    text-align: center;
  }
  fieldset {
    border: none;
    border-top: 1px solid var(--rule);
    padding: var(--space-3) 0 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  legend {
    font-family: var(--f-display);
    color: var(--gold);
    padding-right: var(--space-2);
  }
  label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    color: var(--moon-dim);
  }
  .slider input {
    flex: 1;
    accent-color: var(--gold);
  }
  output {
    width: 3.5ch;
    text-align: right;
    color: var(--moon);
  }
  .check {
    justify-content: flex-start;
  }
  .check input {
    accent-color: var(--gold);
    width: 18px;
    height: 18px;
  }
  select {
    font: inherit;
    color: var(--moon);
    background: var(--ink);
    border: 1px solid var(--rule);
    padding: 4px 8px;
  }
</style>
