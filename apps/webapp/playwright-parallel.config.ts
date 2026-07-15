import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'src/test/e2e/tests',

  // Enable full parallelization
  fullyParallel: true,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 0 : 0,

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
    trace: process.env.CI ? 'retain-on-failure' : 'on-first-retry',
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
      // PR matrix = green track only: specs rewritten against the V2 IA.
      // The full legacy matrix is expected to be partially red mid-redesign
      // (Testing Transition Plan §4) — src/test/e2e/e2e-migration.md is the
      // health signal and tracks every excluded spec below.
      testMatch: [
        '**/stake.spec.ts',
        '**/stake-onchain.spec.ts',
        '**/unstake-repay.spec.ts',
        '**/capped-osm-unstake.spec.ts',
        '**/landing.spec.ts'
        // '**/vaults-spark.spec.ts' — nav already fixed, but the mainnet fork
        // container predates the sUSDT vault deployment (no code on-chain);
        // re-enable once the container is refreshed.
        // needs-V2-rewrite / parked (see e2e-migration.md; re-enable per spec
        // as it is rewritten — owner: QA):
        // '**/mainnet-savings.spec.ts',
        // '**/base-savings.spec.ts',
        // '**/arbitrum-savings.spec.ts',
        // '**/optimism-savings.spec.ts',
        // '**/unichain-savings.spec.ts',
        // '**/base-trade.spec.ts',
        // '**/arbitrum-trade.spec.ts',
        // '**/optimism-trade.spec.ts',
        // '**/unichain-trade.spec.ts',
        // '**/mainnet-psm.spec.ts',
        // '**/base-psm.spec.ts',
        // '**/arbitrum-psm.spec.ts',
        // '**/optimism-psm.spec.ts',
        // '**/unichain-psm.spec.ts',
        // '**/sequential-tx.spec.ts',
        // '**/upgrade.spec.ts'
      ]
    }
    // {
    //   name: 'chromium-alternate',
    //   use: {
    //     ...devices['Desktop Chrome'],
    //     viewport: { width: 1920, height: 1080 }
    //   }
    //   // Alternate VNet tests - for tests requiring a different fork state
    //   // Add test patterns here when you need tests to run on alternate VNet
    //   // testMatch: ['**/expert-morpho.spec.ts', '**/vaults-morpho.spec.ts']
    // }
  ],

  webServer: {
    // VITE_SUSDT_VAULT_ENABLED unhides the Spark Tether Savings vault so
    // vaults-spark.spec.ts has a surface to drive.
    command: `VITE_PARALLEL_TEST=true VITE_SUSDT_VAULT_ENABLED=true ${process.env.USE_ALTERNATE_VNET === 'true' ? 'VITE_USE_ALTERNATE_VNET=true ' : ''}pnpm dev:mock`,
    port: 3000,
    timeout: 120000,
    reuseExistingServer: !process.env.CI,
    // Wait for the server to be fully ready
    stdout: 'pipe',
    stderr: 'pipe'
  }
});
