import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'engine', root: './packages/engine', include: ['tests/**/*.test.ts'], environment: 'node' } },
      { test: { name: 'web', root: './apps/web', include: ['src/**/*.test.ts'], environment: 'node' } },
      // Needs a local Supabase; run with `npm run test:cloud`.
      ...(process.env.SUPABASE_ANON_KEY
        ? [{ test: { name: 'cloud', include: ['tests/cloud/**/*.test.ts'], environment: 'node', testTimeout: 60_000 } }]
        : []),
    ],
  },
});
