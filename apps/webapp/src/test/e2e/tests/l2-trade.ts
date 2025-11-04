import { test } from '../fixtures-parallel';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.ts';
import { switchToL2 } from '../utils/switchToL2.ts';
import { NetworkName } from '../utils/constants.ts';
import { performAction } from '../utils/approveOrPerformAction.ts';

export const runL2TradeTests = async ({ networkName }: { networkName: NetworkName }) => {
  test('trade usdc to usds, then trade usds back to usdc', async ({ isolatedPage }) => {
    await isolatedPage.goto('/');
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
    await isolatedPage.waitForTimeout(1000);
    await switchToL2(isolatedPage, networkName);

    await isolatedPage.getByRole('tab', { name: 'Trade' }).click();

    //select usds for target token; usdc is origin by default
    await isolatedPage.getByRole('button', { name: 'Select token' }).click();
    await isolatedPage.getByRole('button', { name: 'USDS USDS USDS' }).click();

    await isolatedPage.getByTestId('trade-input-origin').click();
    await isolatedPage.getByTestId('trade-input-origin').fill('10');

    await performAction(isolatedPage, 'Trade');

    await isolatedPage.locator('button', { hasText: 'Add USDS to wallet' }).first().click();

    //select usds for target token then use the switcher to select usdc
    await isolatedPage.getByRole('button', { name: 'Select token' }).click();
    await isolatedPage.getByRole('button', { name: 'USDS USDS USDS' }).click();

    await isolatedPage.getByTestId('trade-input-target').click();
    await isolatedPage.getByTestId('trade-input-target').fill('10');
    await isolatedPage.waitForTimeout(2000);

    // Switch clears inputs, so we need to re-enter the amount
    await isolatedPage.getByLabel('Switch token inputs').click();

    // Verify both inputs are cleared after switch
    await test.expect(isolatedPage.getByTestId('trade-input-origin')).toHaveValue('');
    await test.expect(isolatedPage.getByTestId('trade-input-target')).toHaveValue('');

    await isolatedPage.getByTestId('trade-input-origin').click();
    await isolatedPage.getByTestId('trade-input-origin').fill('10');

    await performAction(isolatedPage, 'Trade');

    await isolatedPage.locator('button', { hasText: 'Add USDC to wallet' }).first().click();
  });

  test('trade usdc to susds, then trade susds back to usdc', async ({ isolatedPage }) => {
    await isolatedPage.goto('/');
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
    await isolatedPage.waitForTimeout(1000);
    await switchToL2(isolatedPage, networkName);

    await isolatedPage.getByRole('tab', { name: 'Trade' }).click();

    //select sUsds for target token; usdc is origin by default
    await isolatedPage.getByRole('button', { name: 'Select token' }).click();
    await isolatedPage.getByRole('button', { name: 'sUSDS sUSDS sUSDS' }).click();

    await isolatedPage.getByTestId('trade-input-origin').click();
    await isolatedPage.getByTestId('trade-input-origin').fill('10');

    await performAction(isolatedPage, 'Trade');

    await isolatedPage.locator('button', { hasText: 'Add sUSDS to wallet' }).first().click();

    //select sUsds for target token then use the switcher to select usdc
    await isolatedPage.getByRole('button', { name: 'Select token' }).click();
    await isolatedPage.getByRole('button', { name: 'sUSDS sUSDS sUSDS' }).click();

    await isolatedPage.getByTestId('trade-input-target').click();
    await isolatedPage.getByTestId('trade-input-target').fill('9');
    await isolatedPage.waitForTimeout(2000);

    // Switch clears inputs, so we need to re-enter the amount
    await isolatedPage.getByLabel('Switch token inputs').click();

    // Verify both inputs are cleared after switch
    await test.expect(isolatedPage.getByTestId('trade-input-origin')).toHaveValue('');
    await test.expect(isolatedPage.getByTestId('trade-input-target')).toHaveValue('');

    await isolatedPage.getByTestId('trade-input-origin').click();
    await isolatedPage.getByTestId('trade-input-origin').fill('9');

    await performAction(isolatedPage, 'Trade');

    await isolatedPage.locator('button', { hasText: 'Add USDC to wallet' }).first().click();
  });

  test('trade usds to susds, then trade susds back to usds', async ({ isolatedPage }) => {
    await isolatedPage.goto('/');
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
    await isolatedPage.waitForTimeout(1000);
    await switchToL2(isolatedPage, networkName);

    await isolatedPage.getByRole('tab', { name: 'Trade' }).click();

    //select usds for origin token
    await isolatedPage.getByRole('button', { name: 'USDC USDC' }).click();
    await isolatedPage.getByRole('button', { name: 'USDS USDS USDS' }).click();

    //select sUsds for target token
    await isolatedPage.getByRole('button', { name: 'Select token' }).click();
    await isolatedPage.getByRole('button', { name: 'sUSDS sUSDS sUSDS' }).click();

    //specify target amount
    await isolatedPage.getByTestId('trade-input-target').click();
    await isolatedPage.getByTestId('trade-input-target').fill('10');

    await performAction(isolatedPage, 'Trade');

    await isolatedPage.locator('button', { hasText: 'Add sUSDS to wallet' }).first().click();

    // USDS remain as the origin token after the trade

    //select sUsds for target token (will be switched)
    await isolatedPage.getByRole('button', { name: 'Select token' }).click();
    await isolatedPage.getByRole('button', { name: 'sUSDS sUSDS sUSDS' }).click();

    // Switch clears inputs, tokens are swapped
    await isolatedPage.getByLabel('Switch token inputs').click();
    await isolatedPage.waitForTimeout(1000);

    // Verify both inputs are cleared after switch
    await test.expect(isolatedPage.getByTestId('trade-input-origin')).toHaveValue('');
    await test.expect(isolatedPage.getByTestId('trade-input-target')).toHaveValue('');

    await isolatedPage.getByTestId('trade-input-origin').click();
    await isolatedPage.getByTestId('trade-input-origin').fill('5');

    await performAction(isolatedPage, 'Trade');

    await isolatedPage.locator('button', { hasText: 'Add USDS to wallet' }).first().click();
  });

  test('Batch - trade usdc to usds', async ({ isolatedPage }) => {
    await isolatedPage.goto('/');
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
    await isolatedPage.waitForTimeout(1000);
    await switchToL2(isolatedPage, networkName);

    await isolatedPage.getByRole('tab', { name: 'Trade' }).click();

    //select usds for target token; usdc is origin by default
    await isolatedPage.getByRole('button', { name: 'Select token' }).click();
    await isolatedPage.getByRole('button', { name: 'USDS USDS USDS' }).click();

    await isolatedPage.getByTestId('trade-input-origin').click();
    await isolatedPage.getByTestId('trade-input-origin').fill('10');

    await performAction(isolatedPage, 'Trade');

    await isolatedPage.locator('button', { hasText: 'Add USDS to wallet' }).first().click();
  });
};
