import { test as playwrightTest, expect, Browser, TestInfo, Page } from '@playwright/test';
import { accountPool } from './utils/accountPoolManager';
import { mockRpcCalls } from './mock-rpc-call';
import { mockVpnCheck } from './mock-vpn-check';

type TestFixtures = {
  testAccount: `0x${string}`;
  isolatedPage: Page;
};

/**
 * Parallel test fixtures with account pool management.
 * Each test gets a fresh account from the pool, ensuring complete isolation.
 * This bypasses the base fixtures to avoid individual balance setup.
 */
export const test = playwrightTest.extend<TestFixtures>({
  /**
   * Provides a unique test account from the pool for each test.
   * The account is permanently claimed - never released.
   * With 150 accounts for ~108 tests, each test gets its own dedicated account.
   */
  // eslint-disable-next-line no-empty-pattern
  testAccount: async ({}, use, testInfo) => {
    // Generate a unique holder ID for debugging
    const holderId = `${testInfo.workerIndex}-${testInfo.testId?.substring(0, 8) || 'unknown'}`;

    let accountIndex: number | null = null;
    let account: `0x${string}` | null = null;

    try {
      // Claim an account from the pool - NEVER RELEASE IT
      // With 150 accounts and ~108 tests, we have buffer for retries
      accountIndex = await accountPool.claimAccount(holderId);
      account = accountPool.getAccountAddress(accountIndex);

      console.log(`Test "${testInfo.title}" permanently claimed account ${accountIndex}: ${account}`);

      // Provide the account to the test
      await use(account);
    } catch (error) {
      console.error(`Failed to claim account for test "${testInfo.title}":`, error);
      throw error;
    }
    // NO FINALLY BLOCK - WE NEVER RELEASE THE ACCOUNT
    // Each test gets its own account for the entire test run
  },

  /**
   * Provides an isolated page configured with the test account.
   * Injects the test account and sets up RPC mocking.
   */
  isolatedPage: async (
    { browser, testAccount }: { browser: Browser; testAccount: `0x${string}` },
    use: (page: Page) => Promise<void>,
    testInfo: TestInfo
  ) => {
    // Create a new context with the account pre-injected
    const context = await browser.newContext({
      // Inject the test account BEFORE any page loads
      storageState: {
        cookies: [],
        origins: []
      }
    });

    // Add init script to context so it runs before any page JavaScript
    await context.addInitScript(
      (data: { account: string }) => {
        (window as any).__TEST_ACCOUNT__ = data.account;
        console.log('Test account injected before page load:', data.account);
      },
      { account: testAccount }
    );

    // Create page from context
    const page = await context.newPage();

    // Set up RPC call mocking (from base fixtures)
    await page.route('https://virtual.**.rpc.tenderly.co/**', mockRpcCalls);

    // Set up VPN check mocking (from base fixtures)
    await page.route('https://vpnapi.io/**', mockVpnCheck);

    // Set environment variable for server-side access (if needed)
    process.env.VITE_TEST_ACCOUNT = testAccount;
    process.env.VITE_TEST_WORKER_INDEX = testInfo.workerIndex.toString();

    await use(page);

    // Cleanup
    delete process.env.VITE_TEST_ACCOUNT;
    delete process.env.VITE_TEST_WORKER_INDEX;

    // Close context
    await context.close();
  }
});

export { expect };
