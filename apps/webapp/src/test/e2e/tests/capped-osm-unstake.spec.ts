import { expect, test } from '../fixtures-parallel';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.ts';
import { BORROW_SPEC_SKY, gotoManagePosition, openStakePosition } from '../utils/stakeV2.ts';
import { getOsmSpotPrice, restoreOsmSpotPrice, triggerCappedOsmError } from '../utils/setOsmSpotPrice.ts';
import { updateStakeModuleDebtCeiling } from '../utils/updateStakeDebtCeiling.ts';
import { parseUnits } from 'viem';

/**
 * Validates the guard that blocks unstaking when the resulting liquidation
 * price would exceed the capped OSM SKY price (preventing an immediately
 * liquidatable position). V2 rewrite (F7): the check lives on the manage
 * sheet's Withdraw card (ManagePositionTakeover), same error copy as legacy.
 */

test.describe('Capped OSM SKY Price - Unstake Blocking', () => {
  // The trigger rewrites the ilk's GLOBAL vat spot — on the shared fork,
  // every borrow-gated spec running after it would see a 100× lower capped
  // price (the min-collateral gate becomes unsatisfiable). Restore what we
  // broke, pass or fail.
  let originalSpot: bigint | undefined;
  test.afterEach(async () => {
    if (originalSpot !== undefined) {
      await restoreOsmSpotPrice('LSEV2-SKY-A', originalSpot);
      originalSpot = undefined;
    }
  });

  test.beforeEach(async ({ isolatedPage }) => {
    // Ensure debt ceiling is high enough (other tests may have lowered it).
    const highCeiling = parseUnits('1000000000', 45);
    await updateStakeModuleDebtCeiling(highCeiling);

    await isolatedPage.goto('/');
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
    await isolatedPage.waitForTimeout(1000);
  });

  test('should block unstake when liquidation price exceeds capped OSM price', async ({ isolatedPage }) => {
    // Step 1: a position with SKY staked and USDS borrowed.
    await openStakePosition(isolatedPage, { sky: BORROW_SPEC_SKY, usds: '38000' });

    // Step 2: withdraw works normally before the OSM price is manipulated.
    await gotoManagePosition(isolatedPage, 0);
    await isolatedPage.getByTestId('stake-manage-menu-withdraw').click();
    await expect(isolatedPage.getByTestId('stake-manage-takeover')).toBeVisible();

    await isolatedPage.getByTestId('stake-manage-stake-amount').fill('100000');
    await expect(
      isolatedPage.getByText('Liquidation price is higher than the capped OSM SKY price')
    ).not.toBeVisible();
    await expect(isolatedPage.getByTestId('stake-manage-confirm')).toBeEnabled({ timeout: 30_000 });

    // Step 3: lower the OSM spot price so the cap binds (LSEV2-SKY-A is the
    // staking engine ilk). Capture the pre-trigger spot for the afterEach
    // restore.
    originalSpot = (await getOsmSpotPrice('LSEV2-SKY-A')).spot;
    await triggerCappedOsmError('LSEV2-SKY-A');

    // Step 4: fresh page load for fresh price reads (a plain reload would keep
    // the manage-flow params in the URL and mount an overlay over the connect
    // buttons while disconnected), reconnect, deep-link back in.
    await isolatedPage.goto('/');
    await isolatedPage.waitForTimeout(2000);
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });

    await gotoManagePosition(isolatedPage, 0);
    await isolatedPage.getByTestId('stake-manage-menu-withdraw').click();
    await expect(isolatedPage.getByTestId('stake-manage-takeover')).toBeVisible();
    await isolatedPage.getByTestId('stake-manage-stake-amount').fill('100000');

    // Step 5: the capped OSM guard blocks the withdrawal.
    await expect(
      isolatedPage.getByText('Liquidation price is higher than the capped OSM SKY price')
    ).toBeVisible({ timeout: 10_000 });
    await expect(isolatedPage.getByTestId('stake-manage-confirm')).toBeDisabled();
  });
});
