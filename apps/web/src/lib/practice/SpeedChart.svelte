<!--
  Speed over a practice test: average wpm (solid gold) and raw wpm per second (dashed violet),
  with typos marked. One shared axis (both are wpm). Hover for the exact numbers.
-->
<script lang="ts">
  import type { SecondSample } from '@keycraft/engine';

  let { series }: { series: SecondSample[] } = $props();

  const W = 720;
  const H = 220;
  const pad = { l: 40, r: 64, t: 12, b: 28 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;

  // Colors validated for the dark surface (dataviz validator: lightness, chroma, CVD, contrast all pass).
  const WPM = '#b08830';
  const RAW = '#8a70d0';

  const max = $derived(Math.max(20, ...series.map((s) => Math.max(s.wpm, s.raw))));
  const top = $derived(Math.ceil(max / 20) * 20);
  const x = (i: number) => pad.l + (series.length > 1 ? (i / (series.length - 1)) * iw : iw / 2);
  const y = (v: number) => pad.t + ih - (v / top) * ih;
  const line = (key: 'wpm' | 'raw') =>
    series.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(s[key]).toFixed(1)}`).join(' ');
  const ticks = $derived([0, 1, 2, 3, 4].map((i) => (top / 4) * i));
  let hover = $state<number | null>(null);
  let showTable = $state(false);

  function onmove(e: MouseEvent) {
    const svg = e.currentTarget as SVGSVGElement;
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - pad.l) / iw) * (series.length - 1));
    hover = i >= 0 && i < series.length ? i : null;
  }
  const last = $derived(series[series.length - 1]);
</script>

<figure class="chart">
  <figcaption>
    <span class="key"><i style:background={WPM}></i>Speed (wpm)</span>
    <span class="key"><i class="dash" style:border-color={RAW}></i>Raw, per second</span>
    <span class="key"><i class="dot"></i>Typos</span>
    <button type="button" class="toggle" onclick={() => (showTable = !showTable)}
      >{showTable ? 'Show chart' : 'Show as table'}</button
    >
  </figcaption>

  {#if showTable}
    <table>
      <thead><tr><th>Second</th><th>Speed</th><th>Raw</th><th>Typos</th></tr></thead>
      <tbody>
        {#each series as s (s.second)}<tr><td>{s.second}</td><td>{s.wpm}</td><td>{s.raw}</td><td>{s.errors}</td></tr
          >{/each}
      </tbody>
    </table>
  {:else}
    <svg
      viewBox="0 0 {W} {H}"
      role="img"
      aria-label="Speed over the test, ending at {last?.wpm ?? 0} wpm"
      onmousemove={onmove}
      onmouseleave={() => (hover = null)}
    >
      {#each ticks as t (t)}
        <line class="grid" x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} />
        <text class="axis" x={pad.l - 8} y={y(t) + 4} text-anchor="end">{t}</text>
      {/each}
      {#each series as s, i (s.second)}
        {#if series.length <= 30 || i % Math.ceil(series.length / 12) === 0}
          <text class="axis" x={x(i)} y={H - 8} text-anchor="middle">{s.second}s</text>
        {/if}
      {/each}
      <path d={line('raw')} fill="none" stroke={RAW} stroke-width="2" stroke-dasharray="5 4" stroke-linejoin="round" />
      <path d={line('wpm')} fill="none" stroke={WPM} stroke-width="2.5" stroke-linejoin="round" />
      {#each series as s, i (s.second)}
        {#if s.errors}
          <circle cx={x(i)} cy={y(s.raw)} r="5" class="err" />
        {/if}
      {/each}
      {#if last}
        <text class="label" x={x(series.length - 1) + 8} y={y(last.wpm) + 4}>{last.wpm} wpm</text>
      {/if}
      {#if hover !== null}
        {@const s = series[hover]}
        <line class="cross" x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} />
        <circle cx={x(hover)} cy={y(s.wpm)} r="4" fill={WPM} />
        <g transform="translate({Math.min(x(hover) + 10, W - pad.r - 110)}, {pad.t + 4})">
          <rect width="110" height="58" rx="3" class="tip" />
          <text x="8" y="18" class="tipt">{s.second}s</text>
          <text x="8" y="34" class="tipv">{s.wpm} wpm, raw {s.raw}</text>
          <text x="8" y="50" class="tipv">{s.errors} typo{s.errors === 1 ? '' : 's'}</text>
        </g>
      {/if}
    </svg>
  {/if}
</figure>

<style>
  .chart {
    margin: 0;
    width: 100%;
  }
  figcaption {
    display: flex;
    gap: var(--space-4);
    align-items: center;
    font-size: var(--t-xs);
    color: var(--moon-dim);
    margin-bottom: var(--space-2);
  }
  .key {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .key i {
    width: 16px;
    height: 3px;
    display: inline-block;
  }
  .key i.dash {
    height: 0;
    border-top: 2px dashed;
  }
  .key i.dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--rose);
  }
  .toggle {
    margin-left: auto;
    background: none;
    border: 1px solid var(--rule);
    color: var(--moon-dim);
    padding: 2px 8px;
    cursor: pointer;
    font-size: var(--t-xs);
  }
  svg {
    width: 100%;
    height: auto;
    display: block;
  }
  .grid {
    stroke: var(--rule);
    stroke-width: 1;
    opacity: 0.5;
  }
  .axis {
    fill: var(--moon-faint);
    font-size: 11px;
    font-family: var(--f-text);
  }
  .label {
    fill: var(--moon);
    font-size: 12px;
    font-weight: 700;
    font-family: var(--f-text);
  }
  .err {
    fill: var(--rose);
    stroke: var(--ink);
    stroke-width: 2;
  }
  .cross {
    stroke: var(--moon-faint);
    stroke-width: 1;
  }
  .tip {
    fill: var(--night-deep);
    stroke: var(--rule);
  }
  .tipt {
    fill: var(--moon);
    font-size: 12px;
    font-weight: 700;
    font-family: var(--f-text);
  }
  .tipv {
    fill: var(--moon-dim);
    font-size: 11px;
    font-family: var(--f-text);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--t-sm);
  }
  th,
  td {
    text-align: right;
    padding: 2px 8px;
    border-bottom: 1px solid var(--rule);
  }
</style>
