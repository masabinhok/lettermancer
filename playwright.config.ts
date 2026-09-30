import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  // Cloud tests need a local Supabase; they run only with CLOUD=1 (npm run test:e2e:cloud).
  testIgnore: process.env.CLOUD ? [] : ['cloud/**'],
  timeout: 60_000,
  use: { baseURL: 'http://localhost:4173', viewport: { width: 1280, height: 720 } },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
