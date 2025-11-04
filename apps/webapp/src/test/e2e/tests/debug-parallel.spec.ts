import { test, expect } from '../fixtures-parallel';

test.describe('Debug parallel setup', () => {
  test('Check page loads correctly', async ({ isolatedPage, testAccount }) => {
    console.log(`Debug test using account: ${testAccount}`);

    // Navigate with full wait
    await isolatedPage.goto('/', { waitUntil: 'networkidle' });

    // Wait for React to fully mount
    await isolatedPage.waitForTimeout(2000);

    // Take a screenshot for debugging
    await isolatedPage.screenshot({
      path: `debug-${testAccount.slice(0, 8)}.png`,
      fullPage: true
    });

    // Check if the main app container exists
    const appContainer = await isolatedPage.locator('#root, .App, [data-testid="app"]').first();
    await expect(appContainer).toBeVisible({ timeout: 10000 });

    // Check viewport size
    const viewportSize = isolatedPage.viewportSize();
    console.log(`Viewport size: ${viewportSize?.width}x${viewportSize?.height}`);

    // Check if styles are loaded
    const hasStyles = await isolatedPage.evaluate(() => {
      const stylesheets = document.styleSheets;
      console.log(`Found ${stylesheets.length} stylesheets`);
      return stylesheets.length > 0;
    });
    expect(hasStyles).toBe(true);

    // Check for Tailwind CSS classes
    const hasTailwind = await isolatedPage.evaluate(() => {
      const body = document.body;
      const computedStyle = window.getComputedStyle(body);
      // Check if any Tailwind-like styles are applied
      return computedStyle.fontFamily !== '' || body.classList.length > 0;
    });
    console.log(`Tailwind CSS loaded: ${hasTailwind}`);

    // Check for mock wallet button
    const mockWalletButton = isolatedPage.getByRole('button', { name: /Connect Mock Wallet/i }).first();
    const isButtonVisible = await mockWalletButton.isVisible().catch(() => false);
    console.log(`Mock wallet button visible: ${isButtonVisible}`);

    if (isButtonVisible) {
      // Get button position to check if it's in viewport
      const buttonBox = await mockWalletButton.boundingBox();
      console.log(`Button position: ${JSON.stringify(buttonBox)}`);
    }

    // Log page URL and title
    const url = isolatedPage.url();
    const title = await isolatedPage.title();
    console.log(`Page URL: ${url}`);
    console.log(`Page title: ${title}`);
  });

  test('Check parallel execution with delays', async ({ isolatedPage, testAccount }) => {
    console.log(`Worker ${testAccount.slice(-4)} starting at ${new Date().toISOString()}`);

    await isolatedPage.goto('/', { waitUntil: 'networkidle' });
    await isolatedPage.waitForTimeout(3000); // Simulate work

    console.log(`Worker ${testAccount.slice(-4)} finished at ${new Date().toISOString()}`);
  });
});
