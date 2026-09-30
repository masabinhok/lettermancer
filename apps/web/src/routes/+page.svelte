<script lang="ts">
  import { onMount } from 'svelte';

  onMount(() => {
    void import('$lib/legacy/main');
  });
</script>

<svelte:head><title>Keycraft</title></svelte:head>

<canvas id="fx"></canvas>
<div id="app"></div>
