<!-- A gold corner flourish: a ruled angle with a curl and a leaf-diamond. Rotated per corner. -->
<script lang="ts">
  let { pos, size = 26 }: { pos: 'tl' | 'tr' | 'bl' | 'br'; size?: number } = $props();
  const rot = $derived({ tl: 0, tr: 90, br: 180, bl: 270 }[pos]);
</script>

<svg
  class="corner {pos}"
  width={size}
  height={size}
  viewBox="0 0 26 26"
  aria-hidden="true"
  style="transform: rotate({rot}deg)"
>
  <path d="M1 25 V6 Q1 1 6 1 H25" fill="none" stroke="currentColor" stroke-width="1.4" />
  <path d="M5 21 V9 Q5 5 9 5 H21" fill="none" stroke="currentColor" stroke-width="0.7" opacity="0.6" />
  <path d="M9 9 q5 -1 6 3 q-4 1 -6 -3z" fill="currentColor" opacity="0.85" />
  <rect x="3" y="3" width="3" height="3" transform="rotate(45 4.5 4.5)" fill="currentColor" />
</svg>

<style>
  .corner {
    position: absolute;
    color: var(--gold);
    pointer-events: none;
  }
  .tl {
    top: -2px;
    left: -2px;
  }
  .tr {
    top: -2px;
    right: -2px;
  }
  .bl {
    bottom: -2px;
    left: -2px;
  }
  .br {
    bottom: -2px;
    right: -2px;
  }
</style>
