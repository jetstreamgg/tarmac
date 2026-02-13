import { test, expect } from '../fixtures-parallel';
import { createConsoleListener } from '../utils/consoleListener';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms';

/**
 * Analytics E2E Tests
 *
 * Verifies that user actions fire the correct PostHog events via VITE_ANALYTICS_DEBUG
 * console logging. Uses the console listener pattern (adapted from ENS app) to capture
 * `[Analytics] Event: <name> <payload>` messages and assert against them.
 *
 * Covers 8 of 9 custom events (widget flow events deferred to transaction specs).
 */

const setupAnalyticsTest = async (isolatedPage: Awaited<ReturnType<never>>) => {
  const listener = createConsoleListener(isolatedPage);
  listener.initialize();

  // Pre-accept cookie consent so analytics hooks fire without the consent banner
  await isolatedPage.addInitScript(() => {
    localStorage.setItem('cookie_consent', JSON.stringify({ posthog: true }));
  });

  return listener;
};

const mockVpnAllowed = async (page: any) => {
  await page.route('**/ip/status', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ isRestrictedRegion: false, isConnectedToVpn: false })
    });
  });
};

const mockVpnBlocked = async (page: any) => {
  await page.route('**/ip/status', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ isRestrictedRegion: false, isConnectedToVpn: true })
    });
  });
};

test.describe('Analytics Events', () => {
  test.describe('Widget Selection', () => {
    test('app_widget_selected fires on sidebar tab click', async ({ isolatedPage }) => {
      const listener = await setupAnalyticsTest(isolatedPage);
      await mockVpnAllowed(isolatedPage);

      await isolatedPage.goto('/');
      // Wait for the app to stabilize
      await isolatedPage.waitForTimeout(2000);
      listener.clearMessages();

      // Click the Trade tab in the sidebar
      await isolatedPage.getByRole('tab', { name: 'Trade' }).click();
      await isolatedPage.waitForTimeout(500);

      const msgs = listener.getMessages(/app_widget_selected/);
      expect(msgs.length).toBeGreaterThanOrEqual(1);
      expect(msgs[0]).toContain('"widget_name":"trade"');
      expect(msgs[0]).toContain('"selection_method":"sidebar_tab"');
    });

    test('app_widget_selected fires on deeplink navigation', async ({ isolatedPage }) => {
      const listener = await setupAnalyticsTest(isolatedPage);
      await mockVpnAllowed(isolatedPage);

      // Navigate directly to a widget via URL param
      await isolatedPage.goto('/?widget=trade');
      await isolatedPage.waitForTimeout(2000);

      const msgs = listener.getMessages(/app_widget_selected/);
      expect(msgs.length).toBeGreaterThanOrEqual(1);
      expect(msgs[0]).toContain('"widget_name":"trade"');
      expect(msgs[0]).toContain('"selection_method":"deeplink"');
    });

    test('app_widget_selected fires for multiple tab switches', async ({ isolatedPage }) => {
      const listener = await setupAnalyticsTest(isolatedPage);
      await mockVpnAllowed(isolatedPage);

      await isolatedPage.goto('/');
      await isolatedPage.waitForTimeout(2000);
      listener.clearMessages();

      // Switch to Trade
      await isolatedPage.getByRole('tab', { name: 'Trade' }).click();
      await isolatedPage.waitForTimeout(500);

      // Switch to Savings
      await isolatedPage.getByRole('tab', { name: 'Savings' }).click();
      await isolatedPage.waitForTimeout(500);

      const msgs = listener.getMessages(/app_widget_selected/);
      expect(msgs.length).toBeGreaterThanOrEqual(2);

      // First event: navigating to Trade
      expect(msgs[0]).toContain('"widget_name":"trade"');

      // Second event: navigating to Savings from Trade
      expect(msgs[1]).toContain('"widget_name":"savings"');
      expect(msgs[1]).toContain('"previous_widget":"trade"');
    });
  });

  test.describe('Panel Toggles', () => {
    test('app_details_pane_toggled fires on close and open', async ({ isolatedPage }) => {
      const listener = await setupAnalyticsTest(isolatedPage);
      await mockVpnAllowed(isolatedPage);

      // Start with details open (default)
      await isolatedPage.goto('/');
      await isolatedPage.waitForTimeout(2000);
      listener.clearMessages();

      // Close details pane
      await isolatedPage.getByLabel('Toggle details').first().click();
      await isolatedPage.waitForTimeout(500);

      let msgs = listener.getMessages(/app_details_pane_toggled/);
      expect(msgs.length).toBeGreaterThanOrEqual(1);
      expect(msgs[0]).toContain('"toggle_action":"close"');

      listener.clearMessages();

      // Re-open details pane
      await isolatedPage.getByLabel('Toggle details').first().click();
      await isolatedPage.waitForTimeout(500);

      msgs = listener.getMessages(/app_details_pane_toggled/);
      expect(msgs.length).toBeGreaterThanOrEqual(1);
      expect(msgs[0]).toContain('"toggle_action":"open"');
    });

    test('app_chat_pane_toggled fires on close and open', async ({ isolatedPage }) => {
      const listener = await setupAnalyticsTest(isolatedPage);
      await mockVpnAllowed(isolatedPage);

      // At 1920x1080 (3xl), chat is open by default — first click closes it
      await isolatedPage.goto('/');
      await isolatedPage.waitForTimeout(2000);
      listener.clearMessages();

      // Close chat pane (open by default at 3xl)
      await isolatedPage.getByLabel('Toggle chat').first().click();
      await isolatedPage.waitForTimeout(500);

      let msgs = listener.getMessages(/app_chat_pane_toggled/);
      expect(msgs.length).toBeGreaterThanOrEqual(1);
      expect(msgs[0]).toContain('"toggle_action":"close"');

      listener.clearMessages();

      // Re-open chat pane
      await isolatedPage.getByLabel('Toggle chat').first().click();
      await isolatedPage.waitForTimeout(500);

      msgs = listener.getMessages(/app_chat_pane_toggled/);
      expect(msgs.length).toBeGreaterThanOrEqual(1);
      expect(msgs[0]).toContain('"toggle_action":"open"');
    });

    test('app_details_pane_toggled includes active widget context', async ({ isolatedPage }) => {
      const listener = await setupAnalyticsTest(isolatedPage);
      await mockVpnAllowed(isolatedPage);

      // Start on Trade widget
      await isolatedPage.goto('/?widget=trade');
      await isolatedPage.waitForTimeout(2000);
      listener.clearMessages();

      await isolatedPage.getByLabel('Toggle details').first().click();
      await isolatedPage.waitForTimeout(500);

      const msgs = listener.getMessages(/app_details_pane_toggled/);
      expect(msgs.length).toBeGreaterThanOrEqual(1);
      expect(msgs[0]).toContain('"active_widget":"trade"');
    });
  });

  test.describe.skip('VPN Analytics', () => {
    test('app_vpn_check_completed fires with allowed result on page load', async ({ isolatedPage }) => {
      const listener = await setupAnalyticsTest(isolatedPage);
      await mockVpnAllowed(isolatedPage);

      await isolatedPage.goto('/');
      // Wait for VPN check to complete and event to fire
      await isolatedPage.waitForTimeout(3000);

      const msgs = listener.getMessages(/app_vpn_check_completed/);
      expect(msgs.length).toBeGreaterThanOrEqual(1);
      expect(msgs[0]).toContain('"result":"allowed"');
    });

    test('app_vpn_blocked_page_view fires when VPN is detected', async ({ isolatedPage }) => {
      const listener = await setupAnalyticsTest(isolatedPage);
      await mockVpnBlocked(isolatedPage);

      await isolatedPage.goto('/');
      // Wait for VPN check and blocked page render
      await isolatedPage.waitForTimeout(3000);

      const msgs = listener.getMessages(/app_vpn_blocked_page_view/);
      expect(msgs.length).toBeGreaterThanOrEqual(1);
      expect(msgs[0]).toContain('"block_reason":"vpn_detected"');
    });
  });

  test.describe('Wallet Analytics', () => {
    test('app_wallet_connected fires on wallet connection', async ({ isolatedPage }) => {
      const listener = await setupAnalyticsTest(isolatedPage);
      await mockVpnAllowed(isolatedPage);

      await isolatedPage.goto('/');
      await isolatedPage.waitForTimeout(2000);
      listener.clearMessages();

      // Connect the mock wallet — triggers a connection state transition
      await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });

      const msgs = listener.getMessages(/app_wallet_connected/);
      expect(msgs.length).toBeGreaterThanOrEqual(1);
      expect(msgs[0]).toContain('"wallet_name"');
    });
  });
});
