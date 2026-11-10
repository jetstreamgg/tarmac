import { defineConfig, devices } from '@playwright/test';

/**
 * Terms /check failure E2E: requires the real terms flow (VITE_SKIP_AUTH_CHECK=false).
 * Default dev .env often sets SKIP_AUTH; this config starts the dev server with auth + terms enabled.
 *
 * Run from apps/webapp: pnpm e2e:terms-check-failure
 */
export default defineConfig({
  testDir: 'src/test/e2e/tests',
  testMatch: '**/terms-check-failure.spec.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  timeout: 120000,
  expect: { timeout: 25000 },
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    ...devices['Desktop Chrome'],
    viewport: { width: 1920, height: 1080 }
  },
  webServer: {
    command: 'VITE_SKIP_AUTH_CHECK=false VITE_USE_MOCK_WALLET=true pnpm dev',
    port: 3000,
    timeout: 120000,
    reuseExistingServer: !process.env.CI
  }
});
