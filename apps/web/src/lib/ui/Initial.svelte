<!--
  A historiated initial: the glyph set inside a gold-ruled square on a colored field with
  faint vine work — how an illuminated manuscript opens a chapter. Enemies and the logo use it.
-->
<script lang="ts">
  let {
    glyph,
    size = 96,
    field = '#3a2458',
    ink = 'var(--gold-bright)',
    mirrored = false,
  }: { glyph: string; size?: number; field?: string; ink?: string; mirrored?: boolean } = $props();
  const id = `vine-${Math.random().toString(36).slice(2, 8)}`;
</script>

<div class="initial" style:width="{size}px" style:height="{size}px" style:--field={field} style:--ink={ink}>
  <svg class="vines" viewBox="0 0 100 100" aria-hidden="true" preserveAspectRatio="none">
    <defs>
      <pattern {id} width="25" height="25" patternUnits="userSpaceOnUse">
        <path
          d="M0 12.5 q6 -8 12.5 0 t12.5 0 M12.5 12.5 q2 -5 6 -4 M6 10 q-3 -4 1 -6"
          fill="none"
          stroke="currentColor"
          stroke-width="0.8"
        />
        <circle cx="19" cy="8" r="1.1" fill="currentColor" />
      </pattern>
    </defs>
    <rect width="100" height="100" fill="url(#{id})" />
  </svg>
  <span class="glyph" class:mirrored style:font-size="{size * 0.66}px">{glyph}</span>
</div>

<style>
  .initial {
    position: relative;
    display: grid;
    place-items: center;
    flex: none;
    background: radial-gradient(
      circle at 50% 40%,
      color-mix(in oklab, var(--field) 80%, white 8%),
      var(--field) 60%,
      color-mix(in oklab, var(--field) 70%, black)
    );
    /* double gold rule */
    border: 2px solid var(--gold);
    outline: 1px solid var(--gold-deep);
    outline-offset: 3px;
    box-shadow: 0 10px 30px -12px rgba(0, 0, 0, 0.9);
  }
  .vines {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    color: var(--gold);
    opacity: 0.16;
  }
  .glyph {
    position: relative;
    font-family: var(--f-glyph);
    font-weight: 600;
    line-height: 1;
    color: var(--ink);
    text-shadow:
      0 1px 0 rgba(0, 0, 0, 0.8),
      0 0 18px color-mix(in oklab, var(--ink) 40%, transparent);
    transition: color var(--dur);
  }
  .mirrored {
    transform: scaleX(-1);
  }
</style>
