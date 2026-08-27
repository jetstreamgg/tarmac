import { expect, test } from '../fixtures-parallel';
import { shellMobileNavContract } from '../contracts/shell-mobile-nav.contract';
import { ROUTES } from '@/lib/routes';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms';
import { MOBILE_VIEWPORT, ShellPage } from '../pages/ShellPage';

/**
 * G3 — Mobile shell pass (replaces retired pane-visibility.spec.ts).
 * Contract: shell-mobile-nav · Figma 536:26374 / 5153:25322
 */
test.describe('Shell — mobile navbar (G3)', () => {
  test.beforeEach(async ({ isolatedPage }) => {
    const shell = new ShellPage(isolatedPage);
    await shell.setMobileViewport();
    await shell.suppressNavBlockers();
    await isolatedPage.goto('/portfolio');
    await shell.suppressGovernanceMigrationToast();
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  });

  test('renders the bottom navbar at 393px with desktop pills hidden', async ({ isolatedPage }) => {
    const shell = new ShellPage(isolatedPage);
    await shell.expectMobileNavVisible();
    await expect(isolatedPage.getByTestId('mobile-nav-active-pill')).toBeVisible();
  });

  test('navigates all four destinations', async ({ isolatedPage }) => {
    const shell = new ShellPage(isolatedPage);
    const destinations = [
      { testId: 'mobile-nav-portfolio', url: /\/portfolio(\?|$)/, path: ROUTES.PORTFOLIO },
      { testId: 'mobile-nav-earn', url: /\/earn(\?|$)/, path: ROUTES.EARN },
      { testId: 'mobile-nav-stake', url: /\/stake(\?|$)/, path: ROUTES.STAKE },
      { testId: 'mobile-nav-convert', url: /\/convert(\?|$)/, path: ROUTES.CONVERT }
    ] as const;

    for (const { testId, url } of destinations) {
      await isolatedPage.getByTestId(testId).click();
      await expect(isolatedPage).toHaveURL(url, { timeout: 15_000 });
      await expect(isolatedPage.getByTestId('mobile-nav-active-pill')).toBeVisible();
    }

    // Repair context is embedded in the page object if these ever break:
    expect(shellMobileNavContract.id).toBe('shell-mobile-nav');
  });

  test('viewport matches comp width', async ({ isolatedPage }) => {
    const box = await isolatedPage.getByTestId('mobile-navbar').boundingBox();
    expect(box?.width).toBeLessThanOrEqual(MOBILE_VIEWPORT.width);
  });
});
