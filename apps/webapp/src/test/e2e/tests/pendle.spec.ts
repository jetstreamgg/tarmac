import { expect, test } from '../fixtures-parallel.ts';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.ts';

// E2E scaffold for the Pendle product-detail page (E1 — /earn/fixed/:slug on
// ProductDetailTemplate, V2 selector contract). Write-path cases stay skipped
// pending vnet wiring for the Pendle quote API (mainnet-only) + router writes;
// unit/component V2 specs cover buy/sell/redeem + slippage persistence +
// maturity gating in the meantime (see modules/pendle/**.test.tsx).

test.describe('Pendle (scaffold — write actions stubbed)', () => {
  test.beforeEach(async ({ isolatedPage }) => {
    await isolatedPage.goto('/');
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  });

  test.skip('opens a market detail page via its slug deeplink', async ({ isolatedPage }) => {
    await isolatedPage.goto('/earn/fixed/pt-susds');
    await expect(isolatedPage.getByTestId('product-detail')).toBeVisible();
    await expect(isolatedPage.getByTestId('pendle-supply-card')).toBeVisible();
  });

  test.skip('redirects the legacy market/:address path to the slug route', async ({ isolatedPage }) => {
    await isolatedPage.goto('/earn/fixed/market/0x9c560ebaf78e596cbcc27411d633a74d628dd7dc');
    await expect(isolatedPage).toHaveURL(/\/earn\/fixed\/pt-susds/);
  });

  test.skip('falls back to the fixed overview for an unknown slug', async ({ isolatedPage }) => {
    await isolatedPage.goto('/earn/fixed/pt-does-not-exist');
    await expect(isolatedPage.getByText('All markets')).toBeVisible();
  });

  test.skip('supply modal opens with the slippage gear and persists a custom slippage', async ({
    isolatedPage
  }) => {
    await isolatedPage.goto('/earn/fixed/pt-susds');
    await isolatedPage.getByTestId('pendle-supply-cta').click();
    await isolatedPage.getByTestId('pendle-slippage-menu-trigger').click();
    // Custom slippage set here must survive a reload (pendle-buy-slippage).
  });

  test.skip('matured markets never render a detail page', async () => {
    // Requires Tenderly evm_increaseTime past PENDLE_MARKETS[0].expiry. Defer to
    // the follow-up PR that ships matured-state coverage end-to-end.
  });
});
