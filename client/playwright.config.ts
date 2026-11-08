import { defineConfig, devices } from '@playwright/test';

// E2E tests need both servers running against a migrated and seeded database:
//   Terminal 1: npm run dev:server     (from the repo root)
//   Terminal 2: npm run dev:client     (from the repo root)
//   Terminal 3: npm run test:e2e -w client
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
