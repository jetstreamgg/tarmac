import { test as playwrightTest, expect, Browser, Page } from '@playwright/test';
import { mockRpcCalls } from './mock-rpc-call';
import { mockVpnCheck } from './mock-vpn-check';

/**
 * Simplified fixtures for chatbot tests that don't need the account pool.
 * These tests mock all API calls and don't require Tenderly VNets.
 *
 * Unlike fixtures-parallel, this doesn't use the account pool - it just
 * injects a static test account for the mock wallet to use.
 */

// Static test account for chatbot tests (doesn't need real funds)
const CHATBOT_TEST_ACCOUNT = '0x1234567890123456789012345678901234567890' as const;

type TestFixtures = {
  page: Page;
};

export const test = playwrightTest.extend<TestFixtures>({
  page: async ({ browser }: { browser: Browser }, use: (page: Page) => Promise<void>) => {
    // Create a new context
    const context = await browser.newContext();

    // Inject test account BEFORE any page loads (required for mock wallet)
    await context.addInitScript(
      (data: { account: string }) => {
        (window as unknown as { __TEST_ACCOUNT__: string }).__TEST_ACCOUNT__ = data.account;
      },
      { account: CHATBOT_TEST_ACCOUNT }
    );

    // Create page from context
    const page = await context.newPage();

    // Mock RPC calls (in case any slip through)
    await page.route('https://virtual.**.rpc.tenderly.co/**', mockRpcCalls);

    // Mock VPN check
    await page.route('**/ip/status', mockVpnCheck);

    await use(page);

    // Cleanup
    await context.close();
  }
});

export { expect };
