import { type Page } from '@playwright/test';

/**
 * Toggle the bundle transactions switch in the transaction overview/review screen
 * @param page - The Playwright page object
 * @param enabled - True to enable bundled transactions, false to disable
 */
export const toggleBundleTransactions = async (page: Page, enabled: boolean): Promise<void> => {
  // Find the bundle transactions switch
  const bundleSwitch = page.locator('button[role="switch"][data-slot="switch"]');

  // Check current state
  const currentState = await bundleSwitch.getAttribute('aria-checked');
  const isCurrentlyEnabled = currentState === 'true';

  // Only toggle if we need to change the state
  if (isCurrentlyEnabled !== enabled) {
    await bundleSwitch.click();
    await page.waitForTimeout(500); // Wait for toggle animation
  }
};
