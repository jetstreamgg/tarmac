import { test } from '../fixtures.ts';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.ts';
import { switchToL2 } from '../utils/switchToL2.ts';
import { NetworkName } from '../utils/constants.ts';
import { approveOrPerformAction, performAction } from '../utils/approveOrPerformAction.ts';

export const runL2TradeTests = async ({ networkName }: { networkName: NetworkName }) => {
  test('trade usdc to usds, then trade usds back to usdc', async ({ page }) => {
    await page.goto('/');
    await connectMockWalletAndAcceptTerms(page);
    await switchToL2(page, networkName);

    await page.getByRole('tab', { name: 'Trade' }).click();

    //select usds for target token; usdc is origin by default
    await page.getByRole('button', { name: 'Select token' }).click();
    await page.getByRole('button', { name: 'USDS USDS USDS' }).click();

    await page.getByTestId('trade-input-origin').click();
    await page.getByTestId('trade-input-origin').fill('10');

    await approveOrPerformAction(page, 'Trade');

    await page.locator('button', { hasText: 'Add USDS to wallet' }).first().click();

    //select usds for target token then use the switcher to select usdc
    await page.getByRole('button', { name: 'Select token' }).click();
    await page.getByRole('button', { name: 'USDS USDS USDS' }).click();

    await page.getByTestId('trade-input-target').click();
    await page.getByTestId('trade-input-target').fill('10');
    await page.waitForTimeout(2000);
    await page.getByLabel('Switch token inputs').click();

    await approveOrPerformAction(page, 'Trade');

    await page.locator('button', { hasText: 'Add USDC to wallet' }).first().click();
  });

  test('trade usdc to susds, then trade susds back to usdc', async ({ page }) => {
    await page.goto('/');
    await connectMockWalletAndAcceptTerms(page);
    await switchToL2(page, networkName);

    await page.getByRole('tab', { name: 'Trade' }).click();

    //select sUsds for target token; usdc is origin by default
    await page.getByRole('button', { name: 'Select token' }).click();
    await page.getByRole('button', { name: 'sUSDS sUSDS sUSDS' }).click();

    await page.getByTestId('trade-input-origin').click();
    await page.getByTestId('trade-input-origin').fill('10');

    await approveOrPerformAction(page, 'Trade');

    await page.locator('button', { hasText: 'Add sUSDS to wallet' }).first().click();

    //select sUsds for target token then use the switcher to select usdc
    await page.getByRole('button', { name: 'Select token' }).click();
    await page.getByRole('button', { name: 'sUSDS sUSDS sUSDS' }).click();

    await page.getByTestId('trade-input-target').click();
    await page.getByTestId('trade-input-target').fill('9');
    await page.waitForTimeout(2000);

    await page.getByLabel('Switch token inputs').click();

    await approveOrPerformAction(page, 'Trade');

    await page.locator('button', { hasText: 'Add USDC to wallet' }).first().click();
  });

  test('trade usds to susds, then trade susds back to usds', async ({ page }) => {
    await page.goto('/');
    await connectMockWalletAndAcceptTerms(page);
    await switchToL2(page, networkName);

    await page.getByRole('tab', { name: 'Trade' }).click();

    //select usds for origin token
    await page.getByRole('button', { name: 'USDC USDC' }).click();
    await page.getByRole('button', { name: 'USDS USDS USDS' }).click();

    //select sUsds for target token
    await page.getByRole('button', { name: 'Select token' }).click();
    await page.getByRole('button', { name: 'sUSDS sUSDS sUSDS' }).click();

    //specify target amount
    await page.getByTestId('trade-input-target').click();
    await page.getByTestId('trade-input-target').fill('10');

    await approveOrPerformAction(page, 'Trade');

    await page.locator('button', { hasText: 'Add sUSDS to wallet' }).first().click();

    // USDS remain as the origin token after the trade

    //select sUsds for target token (will be switched)
    await page.getByRole('button', { name: 'Select token' }).click();
    await page.getByRole('button', { name: 'sUSDS sUSDS sUSDS' }).click();

    await page.getByLabel('Switch token inputs').click();
    await page.waitForTimeout(1000);
    await page.getByTestId('trade-input-origin').click();
    await page.getByTestId('trade-input-origin').fill('5');

    await approveOrPerformAction(page, 'Trade');

    await page.locator('button', { hasText: 'Add USDS to wallet' }).first().click();
  });

  test('Batch - trade usdc to usds', async ({ page }) => {
    await page.goto('/');
    await connectMockWalletAndAcceptTerms(page, { batch: true });
    await switchToL2(page, networkName);

    await page.getByRole('tab', { name: 'Trade' }).click();

    //select usds for target token; usdc is origin by default
    await page.getByRole('button', { name: 'Select token' }).click();
    await page.getByRole('button', { name: 'USDS USDS USDS' }).click();

    await page.getByTestId('trade-input-origin').click();
    await page.getByTestId('trade-input-origin').fill('10');

    await performAction(page, 'Trade');

    await page.locator('button', { hasText: 'Add USDS to wallet' }).first().click();
  });
};
