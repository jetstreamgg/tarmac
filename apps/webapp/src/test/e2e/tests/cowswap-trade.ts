import { expect, test } from '../fixtures.ts';
import { approveOrPerformAction } from '../utils/approveOrPerformAction.ts';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.ts';
import { interceptAndMockCowApiCalls } from '../utils/interceptAndMockCowApiCalls.ts';
import { NetworkName } from '../utils/constants.ts';
import { switchToL2 } from '../utils/switchToL2.ts';

export const runCowTradeTests = async ({ networkName }: { networkName: NetworkName }) => {
  test.beforeEach(async ({ page }) => {
    await interceptAndMockCowApiCalls(page);
    await page.goto('/');
    await connectMockWalletAndAcceptTerms(page);
    if (networkName !== NetworkName.mainnet) {
      await switchToL2(page, networkName);
    }
    await page.getByRole('tab', { name: 'Trade' }).click();
  });

  test('Trade DAI for sUSDS', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Transaction overview' })).not.toBeVisible();

    await page.getByTestId('undefined-menu-button').first().click();
    await page.getByRole('button', { name: 'DAI DAI DAI' }).click();
    await page.getByRole('button', { name: 'Select token' }).click();
    await page.getByRole('button', { name: 'sUSDS sUSDS sUSDS' }).click();

    await page.getByTestId('trade-input-origin').click();
    await page.getByTestId('trade-input-origin').fill('100');

    await expect(page.getByText('Fetching price')).toBeVisible();
    await expect(page.getByText('Fetching price')).not.toBeVisible();

    await expect(page.getByRole('button', { name: 'Transaction overview' })).toBeVisible();

    await approveOrPerformAction(page, 'Trade');
    await page.getByTestId('widget-button').getByText('Continue').first().click();

    await page.locator('button', { hasText: 'Add sUSDS to wallet' }).first().click();
  });

  test('Trade is blocked if costs exceed the traded amount', async ({ page }) => {
    await page.getByTestId('undefined-menu-button').first().click();
    await page.getByRole('button', { name: 'USDC USDC USDC' }).click();
    await page.getByRole('button', { name: 'Select token' }).click();
    await page.getByRole('button', { name: 'USDS USDS USDS' }).click();

    await page.getByTestId('trade-input-origin').click();
    await page.getByTestId('trade-input-origin').fill('0.0001');

    await expect(page.getByText('Fetching price')).toBeVisible();
    await expect(page.getByText('Fetching price')).not.toBeVisible();

    await expect(page.getByText('Costs exceed the amount you want to trade')).toBeVisible();
    await expect(page.getByTestId('widget-button')).not.toBeEnabled();
  });

  test('Trade ETH for sUSDS', async ({ page }) => {
    await page.getByTestId('undefined-menu-button').first().click();
    await page.getByRole('button', { name: 'Ether Ether ETH' }).click();
    await page.getByRole('button', { name: 'Select token' }).click();
    await page.getByRole('button', { name: 'sUSDS sUSDS sUSDS' }).click();

    await page.getByTestId('trade-input-origin').click();
    await page.getByTestId('trade-input-origin').fill('0.05');

    await expect(page.getByText('Fetching price')).toBeVisible();
    await expect(page.getByText('Fetching price')).not.toBeVisible();

    await approveOrPerformAction(page, 'Trade');
    await page.locator('button', { hasText: 'Add sUSDS to wallet' }).first().click();
  });
};
