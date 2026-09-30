import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'engine', root: './packages/engine', include: ['tests/**/*.test.ts'], environment: 'node' } },
      { test: { name: 'web', root: './apps/web', include: ['src/**/*.test.ts'], environment: 'node' } },
    ],
  },
});
