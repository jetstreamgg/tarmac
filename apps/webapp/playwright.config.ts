import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Look for test files in the "tests" directory, relative to this configuration file.
  testDir: 'src/test/e2e/tests',

  // Run all tests in parallel.
  fullyParallel: false,

  // Fail the build on CI if you accidentally left test.only in the source code.
  forbidOnly: !!process.env.CI,

  // Retry on CI only.
  retries: process.env.CI ? 2 : 0,

  // Set number of parallel workers (5 on CI, default on local)
  workers: process.env.CI ? 3 : 1,

  // Set test timeout
  timeout: 120000,

  //timeout for all assertions
  expect: {
    timeout: 15000
  },

  // Reporter to use
  reporter: 'html',

  use: {
    // Base URL to use in actions like `await page.goto('/')`.
    baseURL: 'http:localhost:3000',

    // Collect trace when retrying the failed test.
    trace: 'on-first-retry',

    // Recording off by default, but can be set to 'on' for debugging
    video: 'off'
  },
  // Configure projects for major browsers.
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],

        // Set viewport for all tests
        viewport: { width: 1920, height: 1080 }
      }
    }
  ],
  // Run your local dev server before starting the tests.
  webServer: {
    // The terms endpoint matches the parallel suite. Specs in this directory that
    // force the compliance checks on (terms-check-failure) only issue /check
    // when it is a well-formed URL.
    command:
      'VITE_SKIP_AUTH_CHECK=true VITE_TERMS_ENDPOINT=https://staging-api.sky.money/terms-acceptance pnpm dev:mock',
    //running dev:mock is faster, but building and serving like below more closely mimics the production environment
    //command: 'pnpm build:mock && pnpm exec serve dist -sL -p 3000',
    port: 3000,
    timeout: 120000,
    reuseExistingServer: !process.env.CI
  }
});
