<!--
  A glowing medallion for doors and boons: turning light rays, a beveled metal rim tinted by rarity,
  a faceted gem in the offer's color, and the glyph embossed on top. Pure SVG, so it stays crisp at any size.
-->
<script lang="ts">
  let {
    glyph,
    color,
    size = 120,
    /** 0 common, 1 rare, 2 epic, 3 heroic: brighter rims and stronger rays */
    tier = 0,
    rays = true,
    bob = false,
  }: {
    glyph: string;
    color: string;
    /** pixels, or any CSS length such as '9rem' so it grows with the text */
    size?: number | string;
    tier?: number;
    rays?: boolean;
    bob?: boolean;
  } = $props();
  const length = $derived(typeof size === 'number' ? `${size}px` : size);

  const id = $props.id();
  // Rim metals, from worn bronze to heroic gold.
  const METALS = [
    ['#e3c3a0', '#9a6a43', '#4a2f1d'],
    ['#e6f1ff', '#7f9fc4', '#2c3d58'],
    ['#f3e2ff', '#a77fd6', '#3d2560'],
    ['#fff4c9', '#d9b45b', '#6b4a14'],
  ] as const;
  const metal = $derived(METALS[Math.max(0, Math.min(3, tier))]);
  const beams = Array.from({ length: 16 }, (_, i) => i * 22.5);
</script>

<span class="emblem" class:bob style:--c={color} style:--size={length} style:--ray-o={0.35 + tier * 0.15}>
  <svg viewBox="0 0 200 200" aria-hidden="true">
    <defs>
      <radialGradient id="{id}-gem" cx="38%" cy="32%" r="75%">
        <stop offset="0%" stop-color="white" stop-opacity="0.9" />
        <stop offset="18%" style:stop-color={color} />
        <stop offset="70%" style:stop-color={color} stop-opacity="0.75" />
        <stop offset="100%" stop-color="#0c0914" />
      </radialGradient>
      <linearGradient id="{id}-rim" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color={metal[0]} />
        <stop offset="45%" stop-color={metal[1]} />
        <stop offset="100%" stop-color={metal[2]} />
      </linearGradient>
      <linearGradient id="{id}-rim2" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stop-color={metal[0]} />
        <stop offset="60%" stop-color={metal[1]} />
        <stop offset="100%" stop-color={metal[2]} />
      </linearGradient>
      <radialGradient id="{id}-ray" cx="50%" cy="50%" r="50%">
        <stop offset="30%" style:stop-color={color} stop-opacity="0.9" />
        <stop offset="100%" style:stop-color={color} stop-opacity="0" />
      </radialGradient>
      <filter id="{id}-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <filter id="{id}-soft"><feGaussianBlur stdDeviation="4" /></filter>
    </defs>

    {#if rays}
      <g class="rays" fill="url(#{id}-ray)">
        {#each beams as a (a)}
          <path d="M100 100 L{100 - 7} 4 L{100 + 7} 4 Z" transform="rotate({a} 100 100)" opacity={a % 45 ? 0.5 : 1} />
        {/each}
      </g>
    {/if}

    <!-- shadow, rim (two bevels), engraved ring, gem, highlight, glyph -->
    <ellipse cx="100" cy="176" rx="46" ry="8" fill="black" opacity="0.45" filter="url(#{id}-soft)" />
    <circle cx="100" cy="100" r="68" fill="url(#{id}-rim)" />
    <circle cx="100" cy="100" r="61" fill="url(#{id}-rim2)" />
    <circle
      cx="100"
      cy="100"
      r="64.5"
      fill="none"
      stroke={metal[2]}
      stroke-width="1"
      stroke-dasharray="2 4"
      opacity="0.7"
    />
    <circle cx="100" cy="100" r="55" fill="url(#{id}-gem)" />
    <circle cx="100" cy="100" r="55" fill="none" stroke="black" stroke-opacity="0.35" stroke-width="2" />
    <ellipse cx="82" cy="72" rx="26" ry="14" fill="white" opacity="0.28" transform="rotate(-28 82 72)" />
    <text x="100" y="102" text-anchor="middle" dominant-baseline="central" class="glyph" filter="url(#{id}-glow)"
      >{glyph}</text
    >
  </svg>
</span>

<style>
  .emblem {
    display: inline-grid;
    place-items: center;
    width: var(--size);
    height: var(--size);
    flex-shrink: 0;
    filter: drop-shadow(0 0 calc(var(--size) * 0.12) color-mix(in oklab, var(--c) 45%, transparent));
  }
  svg {
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .rays {
    transform-origin: 100px 100px;
    opacity: var(--ray-o);
    animation: turn 18s linear infinite;
  }
  .glyph {
    font-family: var(--f-glyph);
    font-size: 64px;
    font-weight: 700;
    fill: white;
    paint-order: stroke;
    stroke: rgba(0, 0, 0, 0.45);
    stroke-width: 3px;
  }
  .bob {
    animation: bob 3.2s ease-in-out infinite;
  }
  @keyframes turn {
    to {
      transform: rotate(360deg);
    }
  }
  @keyframes bob {
    50% {
      transform: translateY(-6px);
    }
  }
</style>
