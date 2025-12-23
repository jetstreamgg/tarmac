import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'src/test/e2e/tests',

  // Enable full parallelization
  fullyParallel: true,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,

  // Set number of parallel workers (configurable, default 6)
  workers: process.env.TEST_WORKERS ? parseInt(process.env.TEST_WORKERS) : 6,

  timeout: 120000,

  expect: {
    timeout: 15000
  },

  // Global setup and teardown for account pool management
  globalSetup: './src/test/e2e/global-setup-parallel.ts',

  reporter: [['html', { open: 'never' }], ['line'], ['json', { outputFile: 'test-results.json' }]],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    video: process.env.RECORD_VIDEO ? 'on' : 'off',
    // Add explicit viewport for all tests
    viewport: { width: 1920, height: 1080 },
    // Wait for network to be idle
    actionTimeout: 30000,
    navigationTimeout: 30000,
    screenshot: 'only-on-failure'
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 }
      },
      // Test match patterns - include only converted parallel tests
      testMatch: [
        '**/mainnet-savings.spec.ts',
        '**/base-trade.spec.ts',
        '**/arbitrum-trade.spec.ts',
        '**/optimism-trade.spec.ts',
        '**/unichain-trade.spec.ts',
        '**/base-savings.spec.ts',
        '**/arbitrum-savings.spec.ts',
        '**/optimism-savings.spec.ts',
        '**/unichain-savings.spec.ts',
        '**/reward-1.spec.ts',
        '**/reward-2.spec.ts',
        '**/la-u-r.spec.ts',
        '**/la-u-s.spec.ts',
        '**/stake.spec.ts',
        '**/landing.spec.ts',
        '**/expert-stusds.spec.ts',
        '**/upgrade.spec.ts',
        '**/unstake-repay.spec.ts',
        '**/chatbot.spec.ts',
        '**/pane-visibility.spec.ts'
        // Add more test patterns as we convert them
      ]
    }
  ],

  webServer: {
    command: 'VITE_PARALLEL_TEST=true pnpm dev:mock',
    port: 3000,
    timeout: 120000,
    reuseExistingServer: !process.env.CI,
    // Wait for the server to be fully ready
    stdout: 'pipe',
    stderr: 'pipe'
  }
});
