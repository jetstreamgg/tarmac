import { test, expect } from '@playwright/test';

/**
 * Pane Visibility E2E Tests
 *
 * Tests Widget, Details, and Chat pane visibility and interactions across breakpoints.
 * Covers toggle behavior, close buttons, and the 2-pane vs 3-pane layout constraints.
 * Uses base Playwright test since no blockchain interaction is required.
 *
 * Breakpoint values from useBreakpointIndex.ts:
 * - sm: < 768px (mobile)
 * - md: 768-911px (tablet portrait)
 * - lg: 912-1279px (tablet landscape)
 * - xl: 1280-1399px (small desktop)
 * - 2xl: 1400-1679px (medium desktop)
 * - 3xl: >= 1680px (large desktop)
 *
 * Panel class selectors:
 * - Widget: data-testid="widget-navigation" (lg+) or hamburger menu button (sm-md)
 * - Details: .details-pane
 * - Chat: .chat-pane
 *
 * Run with: pnpm e2e pane-visibility.spec.ts
 */

// Representative viewport widths for each breakpoint
const VIEWPORTS = {
  sm: { width: 640, height: 800 },
  md: { width: 800, height: 900 },
  lg: { width: 1000, height: 900 },
  xl: { width: 1350, height: 900 },
  '2xl': { width: 1500, height: 900 },
  '3xl': { width: 1920, height: 1080 }
} as const;

test.describe('Pane Visibility', () => {
  test.beforeEach(async ({ page }) => {
    // Mock VPN check to avoid network issues
    await page.route('**/ip/status', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ isRestrictedRegion: false, isConnectedToVpn: false })
      });
    });

    // Mock chatbot terms check
    await page.route('**/chatbot/terms/check', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ accepted: true })
      });
    });

    // Mock chat endpoint
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
  });

  test.describe('Small screens (sm < 768px)', () => {
    test.use({ viewport: VIEWPORTS.sm });

    test('shows widget and details without chat', async ({ page }) => {
      await page.goto('/');

      // At sm, widget shows a hamburger menu button (bpi < lg)
      const menuButton = page.getByRole('button', { name: /toggle menu/i });
      await expect(menuButton).toBeVisible();

      // Details should be nested inside widget at this breakpoint
      const detailsPane = page.locator('.details-pane');
      await expect(detailsPane).toBeVisible();

      // Chat pane should not be visible
      const chatPane = page.locator('.chat-pane');
      await expect(chatPane).not.toBeVisible();
    });

    test('hides widget when chat is opened', async ({ page }) => {
      await page.goto('/?chat=true');

      // Widget pane (including menu button) should be hidden at sm when chat is open
      const menuButton = page.getByRole('button', { name: /toggle menu/i });
      await expect(menuButton).not.toBeVisible();

      // Chat pane should take full space
      const chatPane = page.locator('.chat-pane');
      await expect(chatPane).toBeVisible();
    });
  });

  test.describe('Medium screens (md 768-911px)', () => {
    test.use({ viewport: VIEWPORTS.md });

    test('shows widget and details side by side without chat', async ({ page }) => {
      await page.goto('/');

      // At md, still shows hamburger menu (bpi < lg)
      const menuButton = page.getByRole('button', { name: /toggle menu/i });
      await expect(menuButton).toBeVisible();

      // Details should be visible
      const detailsPane = page.locator('.details-pane');
      await expect(detailsPane).toBeVisible();

      // Chat should not be visible
      const chatPane = page.locator('.chat-pane');
      await expect(chatPane).not.toBeVisible();
    });

    test('shows widget and chat (hides details) when chat opened', async ({ page }) => {
      await page.goto('/?chat=true');

      // Widget should remain visible (menu button)
      const menuButton = page.getByRole('button', { name: /toggle menu/i });
      await expect(menuButton).toBeVisible();

      // Chat should be visible
      const chatPane = page.locator('.chat-pane');
      await expect(chatPane).toBeVisible();

      // Details should be hidden (chat replaces it at this breakpoint)
      const detailsPane = page.locator('.details-pane');
      await expect(detailsPane).not.toBeVisible();
    });
  });

  test.describe('Large screens (lg 912-1279px)', () => {
    test.use({ viewport: VIEWPORTS.lg });

    test('shows widget navigation and details side by side without chat', async ({ page }) => {
      await page.goto('/');

      // At lg, shows vertical tabs navigation instead of hamburger menu
      const widgetNav = page.getByTestId('widget-navigation');
      await expect(widgetNav).toBeVisible();

      const detailsPane = page.locator('.details-pane');
      await expect(detailsPane).toBeVisible();

      const chatPane = page.locator('.chat-pane');
      await expect(chatPane).not.toBeVisible();
    });

    test('shows widget and chat (hides details) when chat opened', async ({ page }) => {
      await page.goto('/?chat=true');

      const widgetNav = page.getByTestId('widget-navigation');
      const chatPane = page.locator('.chat-pane');
      const detailsPane = page.locator('.details-pane');

      await expect(widgetNav).toBeVisible();
      await expect(chatPane).toBeVisible();
      // Details hidden at lg when chat is open
      await expect(detailsPane).not.toBeVisible();
    });
  });

  test.describe('Extra large screens (xl 1280-1399px)', () => {
    test.use({ viewport: VIEWPORTS.xl });

    test('shows widget navigation and details without chat', async ({ page }) => {
      await page.goto('/');

      const widgetNav = page.getByTestId('widget-navigation');
      const detailsPane = page.locator('.details-pane');

      await expect(widgetNav).toBeVisible();
      await expect(detailsPane).toBeVisible();

      const chatPane = page.locator('.chat-pane');
      await expect(chatPane).not.toBeVisible();
    });

    test('shows all three panes when chat is opened', async ({ page }) => {
      await page.goto('/?chat=true');

      // At xl and above, all three panes can be visible simultaneously
      const widgetNav = page.getByTestId('widget-navigation');
      const detailsPane = page.locator('.details-pane');
      const chatPane = page.locator('.chat-pane');

      await expect(widgetNav).toBeVisible();
      await expect(detailsPane).toBeVisible();
      await expect(chatPane).toBeVisible();
    });
  });

  test.describe('2x large screens (2xl 1400-1679px)', () => {
    test.use({ viewport: VIEWPORTS['2xl'] });

    test('shows all three panes when chat is opened', async ({ page }) => {
      await page.goto('/?chat=true');

      const widgetNav = page.getByTestId('widget-navigation');
      const detailsPane = page.locator('.details-pane');
      const chatPane = page.locator('.chat-pane');

      await expect(widgetNav).toBeVisible();
      await expect(detailsPane).toBeVisible();
      await expect(chatPane).toBeVisible();
    });
  });

  test.describe('3x large screens (3xl >= 1680px)', () => {
    test.use({ viewport: VIEWPORTS['3xl'] });

    test('shows all three panes by default (chat auto-opens)', async ({ page }) => {
      // At 3xl, chat opens by default (no ?chat=true needed)
      await page.goto('/');

      const widgetNav = page.getByTestId('widget-navigation');
      const detailsPane = page.locator('.details-pane');
      const chatPane = page.locator('.chat-pane');

      await expect(widgetNav).toBeVisible();
      await expect(detailsPane).toBeVisible();
      await expect(chatPane).toBeVisible();
    });

    test('can hide chat with explicit parameter', async ({ page }) => {
      await page.goto('/?chat=false');

      const widgetNav = page.getByTestId('widget-navigation');
      const detailsPane = page.locator('.details-pane');
      const chatPane = page.locator('.chat-pane');

      await expect(widgetNav).toBeVisible();
      await expect(detailsPane).toBeVisible();
      await expect(chatPane).not.toBeVisible();
    });
  });

  test.describe('Chat switcher behavior', () => {
    test('chat switcher toggles chat visibility at md', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.md);
      await page.goto('/');

      // Initially chat is hidden at md
      const chatPane = page.locator('.chat-pane');
      await expect(chatPane).not.toBeVisible();

      // Click the chat switcher (use .first() since there may be multiple DualSwitchers)
      await page.getByLabel('Toggle chat').first().click();

      // Chat should now be visible
      await expect(chatPane).toBeVisible();

      // Click again to hide
      await page.getByLabel('Toggle chat').first().click();
      await expect(chatPane).not.toBeVisible();
    });

    test('chat switcher toggles chat visibility at 3xl (starts open)', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS['3xl']);
      await page.goto('/');

      // At 3xl, chat is open by default
      const chatPane = page.locator('.chat-pane');
      await expect(chatPane).toBeVisible();

      // Click the chat switcher to hide
      await page.getByLabel('Toggle chat').first().click();

      // Chat should now be hidden
      await expect(chatPane).not.toBeVisible();

      // Click again to show
      await page.getByLabel('Toggle chat').first().click();
      await expect(chatPane).toBeVisible();
    });
  });

  test.describe('Details switcher behavior', () => {
    test('details switcher hides chat and shows details at md', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.md);
      // Start with chat=true AND details=false so the details toggle is OFF
      // (detailsParam defaults to true when not specified, so toggle would be ON already)
      await page.goto('/?chat=true&details=false');

      // Initially chat is visible and details is hidden at md
      const chatPane = page.locator('.chat-pane');
      const detailsPane = page.locator('.details-pane');
      await expect(chatPane).toBeVisible();
      await expect(detailsPane).not.toBeVisible();

      // Click the details switcher to show details (which should hide chat at md)
      // Use .first() since there may be multiple DualSwitchers at some breakpoints
      await page.getByLabel('Toggle details').first().click();

      // Details should now be visible and chat hidden
      await expect(chatPane).not.toBeVisible();
      await expect(detailsPane).toBeVisible();
    });

    test('details switcher hides chat and shows details at lg', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.lg);
      // Start with chat=true AND details=false so the details toggle is OFF
      await page.goto('/?chat=true&details=false');

      // Initially chat is visible and details is hidden at lg
      const chatPane = page.locator('.chat-pane');
      const detailsPane = page.locator('.details-pane');
      await expect(chatPane).toBeVisible();
      await expect(detailsPane).not.toBeVisible();

      // Click the details switcher to show details (which should hide chat at lg)
      await page.getByLabel('Toggle details').first().click();

      // Details should now be visible and chat hidden
      await expect(detailsPane).toBeVisible();
      await expect(chatPane).not.toBeVisible();
    });

    test('details switcher does NOT hide chat at xl (3 panes fit)', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS['3xl']);
      await page.goto('/?chat=true&details=false');

      // Initially chat is visible and details is hidden
      const chatPane = page.locator('.chat-pane');
      const detailsPane = page.locator('.details-pane');
      await expect(chatPane).toBeVisible();
      await expect(detailsPane).not.toBeVisible();

      // Click the details switcher to show details
      await page.getByLabel('Toggle details').first().click();

      // At xl, both can be visible simultaneously
      await expect(detailsPane).toBeVisible();
      await expect(chatPane).toBeVisible();
    });
  });

  test.describe('Mobile chat close behavior', () => {
    test.use({ viewport: VIEWPORTS.sm });

    test('back button closes chat and shows widget on mobile', async ({ page }) => {
      await page.goto('/?chat=true');

      // Chat should be visible
      const chatPane = page.locator('.chat-pane');
      await expect(chatPane).toBeVisible();

      // Widget should be hidden on mobile when chat is open
      const menuButton = page.getByRole('button', { name: /toggle menu/i });
      await expect(menuButton).not.toBeVisible();

      // Find the back button (chevron left) in the mobile chat header
      // It's inside the mobile-only header (block md:hidden)
      const backButton = chatPane.locator('button:has(svg.lucide-chevron-left)');
      await expect(backButton).toBeVisible();
      await backButton.click();

      // After clicking back, chat should be hidden and widget should be visible
      await expect(chatPane).not.toBeVisible();
      await expect(menuButton).toBeVisible();

      // Details should also be visible (back button sets details=true)
      const detailsPane = page.locator('.details-pane');
      await expect(detailsPane).toBeVisible();
    });
  });

  test.describe('Desktop chat close behavior', () => {
    test('close button (X) hides chat at md', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.md);
      await page.goto('/?chat=true');

      // Chat should be visible
      const chatPane = page.locator('.chat-pane');
      await expect(chatPane).toBeVisible();

      // Find the close button (X icon) using the container id from ChatHeader.tsx
      // This container is only visible at md+ (hidden md:block)
      const closeButton = chatPane.locator('#chat-header-close button');
      await expect(closeButton).toBeVisible();
      await closeButton.click();

      // After clicking close, chat should be hidden
      await expect(chatPane).not.toBeVisible();

      // Details should be visible (close button sets details=true)
      const detailsPane = page.locator('.details-pane');
      await expect(detailsPane).toBeVisible();
    });

    test('close button (X) hides chat at lg', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.lg);
      await page.goto('/?chat=true');

      // Chat should be visible
      const chatPane = page.locator('.chat-pane');
      await expect(chatPane).toBeVisible();

      // Find and click the close button in the desktop header
      const closeButton = chatPane.locator('#chat-header-close button');
      await expect(closeButton).toBeVisible();
      await closeButton.click();

      // After clicking close, chat should be hidden and details visible
      await expect(chatPane).not.toBeVisible();
      const detailsPane = page.locator('.details-pane');
      await expect(detailsPane).toBeVisible();
    });

    test('close button (X) hides chat at xl (details stays visible)', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.xl);
      await page.goto('/?chat=true');

      // All three panes visible at xl with chat
      const chatPane = page.locator('.chat-pane');
      const detailsPane = page.locator('.details-pane');
      await expect(chatPane).toBeVisible();
      await expect(detailsPane).toBeVisible();

      // Find and click the close button in the desktop header
      const closeButton = chatPane.locator('#chat-header-close button');
      await expect(closeButton).toBeVisible();
      await closeButton.click();

      // After clicking close, only chat should be hidden
      await expect(chatPane).not.toBeVisible();
      await expect(detailsPane).toBeVisible();
    });
  });

  test.describe('Details can be hidden with parameter', () => {
    test('details=false hides details pane at xl', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.xl);
      await page.goto('/?details=false');

      const widgetNav = page.getByTestId('widget-navigation');
      const detailsPane = page.locator('.details-pane');

      await expect(widgetNav).toBeVisible();
      await expect(detailsPane).not.toBeVisible();
    });
  });
});
