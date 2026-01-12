import { expect, test } from '../fixtures-chatbot';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.ts';

/**
 * Wallet Terms Association E2E Tests
 *
 * These tests verify that the frontend correctly associates wallet addresses
 * with chatbot terms acceptance.
 *
 * Important distinction:
 * - App Terms: General application terms (accepted during wallet connection)
 * - Chatbot Terms: Separate terms for chatbot feature (checked via /chatbot/terms/check)
 *
 * The wallet association links a wallet address to chatbot terms acceptance.
 */

test.describe('Wallet Terms Association', () => {
  /**
   * Scenario 1: Returning user
   * User has already accepted chatbot terms and connects wallet
   * → Association should trigger automatically on page load
   */
  test('associates wallet automatically when chatbot terms already accepted', async ({ page }) => {
    const walletAssociationRequests: { wallet: string }[] = [];

    // Setup API mocks
    await page.route('**/chat', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ response: 'Hello!', actions: [] })
        });
      } else {
        await route.continue();
      }
    });

    await page.route('**/ip/status', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ isRestrictedRegion: false, isConnectedToVpn: false })
      });
    });

    // Chatbot terms already accepted
    await page.route('**/chatbot/terms/check', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ accepted: true, acceptanceId: 'existing-id' })
      });
    });

    // Capture wallet association requests
    await page.route('**/chatbot/terms/wallet', async route => {
      const body = route.request().postDataJSON();
      walletAssociationRequests.push(body);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, alreadyRecorded: false })
      });
    });

    // Navigate and connect wallet
    await page.goto('/?chat=true', { waitUntil: 'networkidle' });
    await connectMockWalletAndAcceptTerms(page, { batch: true });

    // Wait for association to trigger
    await page.waitForTimeout(2000);

    // Verify wallet association was called
    expect(walletAssociationRequests.length).toBeGreaterThan(0);
    expect(walletAssociationRequests[0].wallet).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  /**
   * Scenario 2: Chatbot terms first, wallet later
   * User accepts chatbot terms WITHOUT wallet connected,
   * then connects wallet afterwards
   * → Association should trigger when wallet connects
   */
  test('associates wallet when connected after chatbot terms were accepted', async ({ page }) => {
    const walletAssociationRequests: { wallet: string }[] = [];

    // Setup API mocks
    await page.route('**/chat', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ response: 'Hello!', actions: [] })
        });
      } else {
        await route.continue();
      }
    });

    await page.route('**/ip/status', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ isRestrictedRegion: false, isConnectedToVpn: false })
      });
    });

    // Chatbot terms already accepted (simulates user accepted before connecting wallet)
    await page.route('**/chatbot/terms/check', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ accepted: true, acceptanceId: 'pre-wallet-acceptance' })
      });
    });

    // Capture wallet association requests
    await page.route('**/chatbot/terms/wallet', async route => {
      const body = route.request().postDataJSON();
      walletAssociationRequests.push(body);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, alreadyRecorded: false })
      });
    });

    // Navigate WITHOUT wallet first
    await page.goto('/?chat=true', { waitUntil: 'networkidle' });

    // Verify no association yet (no wallet)
    await page.waitForTimeout(1000);
    expect(walletAssociationRequests.length).toBe(0);

    // Now connect wallet - this should trigger association
    await connectMockWalletAndAcceptTerms(page, { batch: true });

    // Wait for association to trigger
    await page.waitForTimeout(2000);

    // Verify wallet association was called after wallet connected
    expect(walletAssociationRequests.length).toBeGreaterThan(0);
    expect(walletAssociationRequests[0].wallet).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  /**
   * Scenario 3: No wallet connected
   * Chatbot terms accepted but no wallet connected
   * → No association should happen (nothing to associate)
   */
  test('does not call association when no wallet is connected', async ({ page }) => {
    const walletAssociationRequests: { wallet: string }[] = [];

    // Setup API mocks
    await page.route('**/chat', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ response: 'Hello!', actions: [] })
        });
      } else {
        await route.continue();
      }
    });

    await page.route('**/ip/status', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ isRestrictedRegion: false, isConnectedToVpn: false })
      });
    });

    // Chatbot terms accepted
    await page.route('**/chatbot/terms/check', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ accepted: true })
      });
    });

    // Capture any wallet association requests
    await page.route('**/chatbot/terms/wallet', async route => {
      const body = route.request().postDataJSON();
      walletAssociationRequests.push(body);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });

    // Navigate WITHOUT connecting wallet
    await page.goto('/?chat=true', { waitUntil: 'networkidle' });

    // Wait to ensure no association is triggered
    await page.waitForTimeout(2000);

    // Verify wallet association was NOT called
    expect(walletAssociationRequests.length).toBe(0);
  });

  /**
   * Scenario 4: Already recorded
   * Backend returns alreadyRecorded: true
   * → Should handle gracefully, chat continues to work
   */
  test('handles alreadyRecorded response gracefully', async ({ page }) => {
    const walletAssociationRequests: { wallet: string }[] = [];

    // Setup API mocks
    await page.route('**/chat', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ response: 'Chat works!', actions: [] })
        });
      } else {
        await route.continue();
      }
    });

    await page.route('**/ip/status', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ isRestrictedRegion: false, isConnectedToVpn: false })
      });
    });

    await page.route('**/chatbot/terms/check', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ accepted: true })
      });
    });

    // Return alreadyRecorded: true (wallet already associated)
    await page.route('**/chatbot/terms/wallet', async route => {
      const body = route.request().postDataJSON();
      walletAssociationRequests.push(body);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, alreadyRecorded: true })
      });
    });

    // Navigate and connect wallet
    await page.goto('/?chat=true', { waitUntil: 'networkidle' });
    await connectMockWalletAndAcceptTerms(page, { batch: true });
    await page.waitForTimeout(2000);

    // Verify association was attempted
    expect(walletAssociationRequests.length).toBeGreaterThan(0);

    // Verify chat still works normally after alreadyRecorded response
    await page.waitForSelector('textarea[placeholder]');
    const chatInput = page.locator('textarea');
    await chatInput.fill('Test message');
    await chatInput.press('Enter');

    await expect(page.getByText('Chat works!')).toBeVisible({ timeout: 5000 });
  });

  /**
   * Scenario 5: No duplicate calls
   * Cache should prevent multiple association calls in same session
   */
  test('does not make duplicate association calls on same page', async ({ page }) => {
    const walletAssociationRequests: { wallet: string }[] = [];

    // Setup API mocks
    await page.route('**/chat', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ response: 'Response', actions: [] })
        });
      } else {
        await route.continue();
      }
    });

    await page.route('**/ip/status', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ isRestrictedRegion: false, isConnectedToVpn: false })
      });
    });

    await page.route('**/chatbot/terms/check', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ accepted: true })
      });
    });

    await page.route('**/chatbot/terms/wallet', async route => {
      const body = route.request().postDataJSON();
      walletAssociationRequests.push(body);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, alreadyRecorded: false })
      });
    });

    // Navigate and connect wallet
    await page.goto('/?chat=true', { waitUntil: 'networkidle' });
    await connectMockWalletAndAcceptTerms(page, { batch: true });
    await page.waitForTimeout(2000);

    // Record count after initial association
    const initialCount = walletAssociationRequests.length;
    expect(initialCount).toBeGreaterThan(0);

    // Interact with chat multiple times
    const chatInput = page.locator('textarea');
    await chatInput.fill('Message 1');
    await chatInput.press('Enter');
    await page.waitForTimeout(1000);

    await chatInput.fill('Message 2');
    await chatInput.press('Enter');
    await page.waitForTimeout(1000);

    // Verify no additional association calls were made
    expect(walletAssociationRequests.length).toBe(initialCount);
  });
});
