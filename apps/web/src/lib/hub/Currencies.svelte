<script lang="ts">
  let { ink, leaf, seals }: { ink: number; leaf: number; seals: number } = $props();
</script>

<ul class="purse" aria-label="Your currencies">
  <li title="Ink: earned from every run and from practice. Spend it in the Codex of Hands.">
    <span class="g ink" aria-hidden="true">✒</span><b>{ink}</b> Ink
  </li>
  <li title="Gold Leaf: earned by beating bosses and winning under Oaths. Buys the rarest upgrades.">
    <span class="g leaf" aria-hidden="true">❧</span><b>{leaf}</b> Gold Leaf
  </li>
  <li title="Seals: earned by fulfilling prophecies. The Archivist trades them for Gold Leaf.">
    <span class="g seal" aria-hidden="true">✪</span><b>{seals}</b> Seals
  </li>
</ul>

<style>
  .purse {
    display: flex;
    gap: var(--space-5);
    list-style: none;
    margin: 0;
    padding: 0;
    font-size: var(--t-sm);
    color: var(--moon-dim);
  }
  li {
    display: flex;
    align-items: baseline;
    gap: 6px;
    cursor: help;
  }
  b {
    font-family: var(--f-display);
    font-size: var(--t-lg);
    color: var(--moon);
  }
  .g {
    font-family: var(--f-glyph);
    font-size: 1.2rem;
  }
  .ink {
    color: var(--echo);
  }
  .leaf {
    color: var(--gold-bright);
  }
  .seal {
    color: var(--rose);
  }
</style>
