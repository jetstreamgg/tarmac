import { expect, test } from '../fixtures-parallel';
import { approveOrPerformAction } from '../utils/approveOrPerformAction.ts';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.ts';
import { interceptAndMockCowApiCalls } from '../utils/interceptAndMockCowApiCalls.ts';
import { NetworkName } from '../utils/constants.ts';
import { switchToL2 } from '../utils/switchToL2.ts';

export const runCowTradeTests = async ({ networkName }: { networkName: NetworkName }) => {
  test.beforeEach(async ({ isolatedPage }) => {
    await interceptAndMockCowApiCalls(isolatedPage);
    await isolatedPage.goto('/');
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
    if (networkName !== NetworkName.mainnet) {
      await switchToL2(isolatedPage, networkName);
    }
    await isolatedPage.getByRole('tab', { name: 'Trade' }).click();
  });

  test('Trade DAI for sUSDS', async ({ isolatedPage }) => {
    await expect(isolatedPage.getByRole('button', { name: 'Transaction overview' })).not.toBeVisible();

    await isolatedPage.getByTestId('undefined-menu-button').first().click();
    await isolatedPage.getByRole('button', { name: 'DAI DAI DAI' }).click();
    await isolatedPage.getByRole('button', { name: 'Select token' }).click();
    await isolatedPage.getByRole('button', { name: 'sUSDS sUSDS sUSDS' }).click();

    await isolatedPage.getByTestId('trade-input-origin').click();
    await isolatedPage.getByTestId('trade-input-origin').fill('100');

    await expect(isolatedPage.getByText('Fetching price')).toBeVisible();
    await expect(isolatedPage.getByText('Fetching price')).not.toBeVisible();

    await expect(isolatedPage.getByRole('button', { name: 'Transaction overview' })).toBeVisible();

    await approveOrPerformAction(isolatedPage, 'Trade');

    await isolatedPage.getByTestId('widget-button').getByText('Continue').first().click();

    await isolatedPage.locator('button', { hasText: 'Add sUSDS to wallet' }).first().click();
  });

  test('Trade is blocked if costs exceed the traded amount', async ({ isolatedPage }) => {
    await isolatedPage.getByTestId('undefined-menu-button').first().click();
    await isolatedPage.getByRole('button', { name: 'USDC USDC USDC' }).click();
    await isolatedPage.getByRole('button', { name: 'Select token' }).click();
    await isolatedPage.getByRole('button', { name: 'USDS USDS USDS' }).click();

    await isolatedPage.getByTestId('trade-input-origin').click();
    await isolatedPage.getByTestId('trade-input-origin').fill('0.0001');

    await expect(isolatedPage.getByText('Fetching price')).toBeVisible();
    await expect(isolatedPage.getByText('Fetching price')).not.toBeVisible();

    await expect(isolatedPage.getByText('Costs exceed the amount you want to trade')).toBeVisible();
    await expect(isolatedPage.getByTestId('widget-button')).not.toBeEnabled();
  });

  test('Trade ETH for sUSDS', async ({ isolatedPage }) => {
    await isolatedPage.getByTestId('undefined-menu-button').first().click();
    await isolatedPage.getByRole('button', { name: 'Ether Ether ETH' }).click();
    await isolatedPage.getByRole('button', { name: 'Select token' }).click();
    await isolatedPage.getByRole('button', { name: 'sUSDS sUSDS sUSDS' }).click();

    await isolatedPage.getByTestId('trade-input-origin').click();
    await isolatedPage.getByTestId('trade-input-origin').fill('0.05');

    await expect(isolatedPage.getByText('Fetching price')).toBeVisible();
    await expect(isolatedPage.getByText('Fetching price')).not.toBeVisible();

    await approveOrPerformAction(isolatedPage, 'Trade');
    await isolatedPage.getByRole('button', { name: 'Back to Trade' }).click();
  });
};
