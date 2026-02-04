import { expect, test } from '../fixtures-parallel';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.js';
import { triggerCappedOsmError } from '../utils/setOsmSpotPrice.js';
import { updateStakeModuleDebtCeiling } from '../utils/updateSealDebtCeiling.js';
import { parseUnits } from 'viem';

/**
 * This test validates the feature that blocks unstaking when the capped OSM SKY price
 * would cause the liquidation price to exceed the capped price.
 *
 * The feature prevents users from putting their position in an immediately liquidatable state
 * due to the OSM price cap.
 */

test.describe('Capped OSM SKY Price - Unstake Blocking', () => {
  test.beforeEach(async ({ isolatedPage }) => {
    console.log('Starting beforeEach - Capped OSM test');

    // Ensure debt ceiling is high enough (other tests may have lowered it)
    // Set to 1 billion USDS in RAD (45 decimals)
    const highCeiling = parseUnits('1000000000', 45);
    await updateStakeModuleDebtCeiling(highCeiling);
    console.log('✅ Debt ceiling reset to high value');

    await isolatedPage.goto('/');
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
    await isolatedPage.waitForTimeout(1000);
    await isolatedPage.getByRole('tab', { name: 'Stake & Borrow' }).click();
    console.log('Setup complete');
  });

  test('should block unstake when liquidation price exceeds capped OSM price', async ({ isolatedPage }) => {
    // Step 1: Create a position with SKY staked and USDS borrowed
    const SKY_AMOUNT_TO_LOCK = '2400000'; // 2.4M SKY
    const USDS_AMOUNT_TO_BORROW = '38000'; // 38K USDS

    console.log('Step 1: Creating position with borrowed USDS...');

    await isolatedPage.getByTestId('supply-first-input-lse').fill(SKY_AMOUNT_TO_LOCK);
    await isolatedPage.getByTestId('borrow-input-lse').first().fill(USDS_AMOUNT_TO_BORROW);
    await isolatedPage.waitForTimeout(2000); // Wait for simulation

    // Verify capped OSM price is displayed in the position overview
    await expect(isolatedPage.getByText('Capped OSM SKY price')).toBeVisible();

    await expect(isolatedPage.getByTestId('widget-button').first()).toBeEnabled({ timeout: 20000 });
    await isolatedPage.getByTestId('widget-button').first().click();

    // Select rewards
    // await expect(isolatedPage.getByText('Choose your reward token')).toBeVisible();
    // await isolatedPage.getByTestId('stake-reward-card').first().click();
    // await isolatedPage.getByTestId('widget-button').first().click();

    // Confirm position
    await expect(isolatedPage.getByText('Confirm your position').nth(0)).toBeVisible();
    await isolatedPage.getByTestId('widget-button').first().click();

    await expect(isolatedPage.getByRole('heading', { name: 'Success!' })).toBeVisible({
      timeout: 20000
    });

    console.log('Position created successfully');

    // Step 2: Navigate to Manage Position
    await isolatedPage.getByRole('button', { name: 'Manage your position(s)' }).click();
    await expect(isolatedPage.getByText('Position 1')).toBeVisible();
    await isolatedPage.getByRole('button', { name: 'Manage Position' }).last().click();

    // Step 3: Switch to "Unstake and pay back" tab
    await isolatedPage.getByRole('tab', { name: 'Unstake and pay back' }).click();

    // Verify we can unstake initially (before manipulating OSM price)
    const unstakeInput = isolatedPage.getByTestId('supply-first-input-lse');
    await unstakeInput.fill('100000'); // Try to unstake 100K SKY
    await isolatedPage.waitForTimeout(2000);

    // Should not have error initially
    const errorTextBefore = await unstakeInput.locator('..').locator('..').textContent();
    expect(errorTextBefore).not.toContain('Liquidation price is higher than the capped OSM SKY price');

    console.log('Unstaking works normally before OSM manipulation');

    // Step 4: Manipulate the OSM spot price to trigger the cap
    console.log('Step 4: Triggering capped OSM error by lowering spot price...');

    // LSEV2-SKY-A is the staking engine ilk name
    await triggerCappedOsmError('LSEV2-SKY-A');

    console.log('OSM spot price manipulated');

    // // Step 5: Refresh the page to get updated prices
    await isolatedPage.reload();
    await isolatedPage.waitForTimeout(2000);
    // connect wallet and accept terms
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });

    // Step 6: Try to unstake again - should now show error
    console.log('Step 6: Attempting to unstake after OSM manipulation...');

    await isolatedPage.getByTestId('supply-first-input-lse').fill('100000');
    await isolatedPage.waitForTimeout(2000); // Wait for simulation

    // Verify the capped OSM error appears
    const errorMessage = isolatedPage.getByText('Liquidation price is higher than the capped OSM SKY price');
    await expect(errorMessage).toBeVisible({ timeout: 10000 });

    console.log('Capped OSM error displayed correctly');

    // Verify the button is disabled due to the error
    const continueButton = isolatedPage.getByTestId('widget-button').first();
    await expect(continueButton).toBeDisabled();

    console.log('Continue button is disabled when capped OSM error occurs');
  });
});
