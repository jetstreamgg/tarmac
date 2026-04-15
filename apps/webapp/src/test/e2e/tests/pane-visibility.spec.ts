import { test, expect } from '@playwright/test';

/**
 * Pane Visibility E2E Tests
 *
 * Tests Widget and Details pane visibility across breakpoints.
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
  });

  test.describe('Small screens (sm < 768px)', () => {
    test.use({ viewport: VIEWPORTS.sm });

    test('shows widget with details nested inside', async ({ page }) => {
      await page.goto('/');

      // At sm, widget shows a hamburger menu button (bpi < lg)
      const menuButton = page.getByRole('button', { name: /toggle menu/i });
      await expect(menuButton).toBeVisible();

      // Details should be nested inside widget at this breakpoint
      const detailsPane = page.locator('.details-pane');
      await expect(detailsPane).toBeVisible();
    });
  });

  test.describe('Medium screens (md 768-911px)', () => {
    test.use({ viewport: VIEWPORTS.md });

    test('shows widget and details side by side', async ({ page }) => {
      await page.goto('/');

      const menuButton = page.getByRole('button', { name: /toggle menu/i });
      await expect(menuButton).toBeVisible();

      const detailsPane = page.locator('.details-pane');
      await expect(detailsPane).toBeVisible();
    });
  });

  test.describe('Large screens (lg 912-1279px)', () => {
    test.use({ viewport: VIEWPORTS.lg });

    test('shows widget navigation and details side by side', async ({ page }) => {
      await page.goto('/');

      const widgetNav = page.getByTestId('widget-navigation');
      await expect(widgetNav).toBeVisible();

      const detailsPane = page.locator('.details-pane');
      await expect(detailsPane).toBeVisible();
    });
  });

  test.describe('Extra large screens (xl 1280-1399px)', () => {
    test.use({ viewport: VIEWPORTS.xl });

    test('shows widget navigation and details', async ({ page }) => {
      await page.goto('/');

      const widgetNav = page.getByTestId('widget-navigation');
      const detailsPane = page.locator('.details-pane');

      await expect(widgetNav).toBeVisible();
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
