import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: vitePreprocess(),
  kit: {
    // Static SPA: the game runs fully in the browser; Supabase is the only backend.
    adapter: adapter({ fallback: 'index.html' }),
  },
};
