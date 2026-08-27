import { expect, test } from '../fixtures-parallel';
import { earnMarketplaceDefaultContract } from '../contracts/earn-marketplace-default.contract';
import { earnMarketplaceDrilldownContract } from '../contracts/earn-marketplace-drilldown.contract';
import { earnMarketplaceFilterContract } from '../contracts/earn-marketplace-filter.contract';
import { EarnMarketplacePage } from '../pages/EarnMarketplacePage';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms';

/**
 * Earn marketplace smoke suite (V2).
 * Contracts: earn-marketplace-default, earn-marketplace-filter, earn-marketplace-drilldown
 */
test.describe('Earn marketplace — shell', () => {
  test('smoke: default view renders featured cards and opportunities table', async ({ isolatedPage }) => {
    const earn = new EarnMarketplacePage(isolatedPage);
    await earn.goto();
    await earn.expectDefaultShell();
    expect(earnMarketplaceDefaultContract.id).toBe('earn-marketplace-default');
  });

  test('smoke: token URL filter shows clear-filters control', async ({ isolatedPage }) => {
    const earn = new EarnMarketplacePage(isolatedPage);
    // Lowercase matches normalizeUrlParam in EarnPage.
    await earn.goto('token=usdc');
    await earn.expectTokenFilterActive();
    expect(earnMarketplaceFilterContract.id).toBe('earn-marketplace-filter');
  });
});

test.describe('Earn marketplace — drill-down', () => {
  test.beforeEach(async ({ isolatedPage }) => {
    await isolatedPage.goto('/earn');
    await isolatedPage.evaluate(() => {
      localStorage.setItem('governance-migration-notice-shown', 'true');
    });
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
    // App loader may sort a funded wallet to Portfolio — return to Earn for row drill-down.
    await isolatedPage.goto('/earn');
  });

  test('smoke: savings row opens product detail', async ({ isolatedPage }) => {
    const earn = new EarnMarketplacePage(isolatedPage);
    await expect(earn.opportunitiesTable()).toBeVisible({ timeout: 30_000 });

    await earn.row('savings').click();
    await expect(isolatedPage).toHaveURL(/\/earn\/savings(\?|$)/, { timeout: 15_000 });
    await expect(isolatedPage.getByTestId('product-detail')).toBeVisible({ timeout: 15_000 });
    expect(earnMarketplaceDrilldownContract.id).toBe('earn-marketplace-drilldown');
  });
});
