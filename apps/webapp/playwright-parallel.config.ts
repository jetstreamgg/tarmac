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
      // All E2E tests - unified VNet fork (has Curve pool configured)
      // PR matrix = green track only: specs that pass against the V2 IA.
      // Excluded specs are tracked in src/test/e2e/e2e-migration.md and come
      // back one by one as they are rewritten (lockstep rule).
      testMatch: [
        '**/stake.spec.ts',
        '**/stake-mobile.spec.ts',
        '**/stake-onchain.spec.ts',
        '**/unstake-repay.spec.ts',
        '**/capped-osm-unstake.spec.ts',
        '**/app-loader.spec.ts',
        '**/landing.spec.ts',
        '**/network-switching.spec.ts',
        '**/shell-mobile.spec.ts',
        '**/portfolio.spec.ts',
        '**/earn-marketplace.spec.ts',
        '**/mainnet-psm.spec.ts',
        '**/base-psm.spec.ts',
        '**/arbitrum-psm.spec.ts',
        '**/optimism-psm.spec.ts',
        '**/unichain-psm.spec.ts',
        '**/mainnet-savings.spec.ts',
        '**/mainnet-savings-parallel.spec.ts',
        '**/rewards.spec.ts',
        '**/vaults-morpho.spec.ts',
        '**/pendle.spec.ts',
        '**/stusds.spec.ts',
        '**/terms-signature-gate.spec.ts',
        '**/base-savings.spec.ts',
        '**/arbitrum-savings.spec.ts',
        '**/optimism-savings.spec.ts',
        '**/unichain-savings.spec.ts',
        '**/sequential-tx.spec.ts'
        // needs-V2-rewrite / parked (see e2e-migration.md):
        // '**/vaults-spark.spec.ts' — legacy widget UI; enable when fork has sUSDT vault + flag
        //
        // The trade and upgrade specs are gone, not parked: their widgets were
        // deleted, so there is nothing left to rewrite them against.
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
    // Match CI: skip auth/ip checks so WalletChip doesn't block on unmocked /ip/status.
    // VITE_SUSDT_VAULT_ENABLED unhides the Spark Tether Savings vault so
    // vaults-spark.spec.ts has a surface to drive once it is re-enabled.
    command: `VITE_PARALLEL_TEST=true VITE_SKIP_AUTH_CHECK=true VITE_SUSDT_VAULT_ENABLED=true ${process.env.USE_ALTERNATE_VNET === 'true' ? 'VITE_USE_ALTERNATE_VNET=true ' : ''}pnpm dev:mock`,
    port: 3000,
    timeout: 120000,
    reuseExistingServer: !process.env.CI,
    // Wait for the server to be fully ready
    stdout: 'pipe',
    stderr: 'pipe'
  }
});
