<script lang="ts">
  let {
    value,
    max,
    tone = 'hp',
    height = 10,
    label = null,
  }: {
    value: number;
    max: number;
    tone?: 'hp' | 'foe' | 'threat' | 'danger' | 'shield';
    /** in pixels at the reference scale (1280×720); scales with the window */
    height?: number;
    label?: string | null;
  } = $props();
  const pct = $derived(Math.max(0, Math.min(1, max ? value / max : 0)) * 100);
</script>

<div
  class="bar {tone}"
  style:height="{height / 17}rem"
  role="meter"
  aria-valuenow={value}
  aria-valuemin={0}
  aria-valuemax={max}
>
  <i style:width="{pct}%"></i>
  {#if label !== null}<span>{label}</span>{/if}
</div>

<style>
  .bar {
    position: relative;
    width: 100%;
    background: rgba(0, 0, 0, 0.45);
    border: 1px solid var(--rule);
    border-radius: 2px;
    overflow: hidden;
  }
  i {
    position: absolute;
    inset: 0 auto 0 0;
    transition: width 0.15s var(--ease-out);
  }
  .hp i {
    background: linear-gradient(90deg, #8e1f3f, var(--rose));
  }
  .foe i {
    background: linear-gradient(90deg, #6d2a2a, #b04a4a);
  }
  .threat i {
    background: var(--moon-faint);
    transition: none;
  }
  .danger i {
    background: var(--rose);
    transition: none;
  }
  .shield i {
    background: var(--witchfire);
  }
  span {
    position: relative;
    text-align: center;
    font-weight: 700;
    font-size: 0.78rem;
    line-height: 1;
    height: 100%;
    display: grid;
    place-items: center;
    text-shadow: 0 1px 2px #000;
  }
</style>
