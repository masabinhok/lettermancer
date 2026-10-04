<script lang="ts">
  // Legend for heatmap keyboards.
</script>

<p class="legend">
  <span class="item"><span>comfortable</span><i class="scale"></i><span>slow or error-prone</span></span>
  <span class="item"><i class="none"></i><span>not enough data yet</span></span>
</p>

<style>
  .legend {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 4px var(--space-4);
    margin: 0;
    font-size: var(--t-xs);
    color: var(--moon-faint);
  }
  i {
    display: inline-block;
    height: 0.706rem;
    border: 1px solid var(--rule);
    border-radius: 2px;
  }
  .scale {
    width: 3.294rem;
    background: linear-gradient(90deg, var(--ink), color-mix(in oklab, var(--rose) 85%, var(--ink)));
  }
  .item {
    display: inline-flex;
    align-items: center;
    gap: 0.353rem;
  }
  .none {
    width: 0.706rem;
    background: repeating-linear-gradient(135deg, var(--ink) 0 3px, var(--ink-2) 3px 6px);
  }
</style>
