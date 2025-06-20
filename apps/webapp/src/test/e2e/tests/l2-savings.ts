import { expect, test } from '../fixtures.ts';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.ts';
import { switchToL2 } from '../utils/switchToL2.ts';
import { approveOrPerformAction, performAction } from '../utils/approveOrPerformAction.ts';
import { NetworkName } from '../utils/constants.ts';

export const runL2SavingsTests = async ({ networkName }: { networkName: NetworkName }) => {
  test(`Go to ${networkName} Savings, deposit usds and usdc, withdraw usdc and usds`, async ({ page }) => {
    await page.goto('/');
    await connectMockWalletAndAcceptTerms(page);
    await page.getByRole('tab', { name: 'Savings' }).click();
    await switchToL2(page, networkName);

    await expect(page.getByRole('button', { name: 'Transaction overview' })).not.toBeVisible();

    //supply usds
    await page.getByTestId('l2-savings-supply-input').click();
    await page.getByTestId('l2-savings-supply-input').fill('10');

    await expect(page.getByRole('button', { name: 'Transaction overview' })).toBeVisible();

    await approveOrPerformAction(page, 'Supply');

    await page.getByRole('button', { name: 'Back to Savings' }).click();

    //supply usdc
    await page.getByTestId('undefined-menu-button').click();
    await page.getByRole('button', { name: 'USDC USDC USDC' }).click();

    await page.getByTestId('l2-savings-supply-input').click();
    await page.getByTestId('l2-savings-supply-input').fill('10');

    await expect(page.getByRole('button', { name: 'Transaction overview' })).toBeVisible();

    await approveOrPerformAction(page, 'Supply');

    await page.getByRole('button', { name: 'Back to Savings' }).click();

    await page.getByRole('tab', { name: 'Withdraw' }).click();

    //withdraw usdc
    await page.getByTestId('l2-savings-withdraw-input').click();
    await page.getByTestId('l2-savings-withdraw-input').fill('10');
    await expect(page.getByRole('button', { name: 'Transaction overview' })).toBeVisible();

    await approveOrPerformAction(page, 'Withdraw');

    await page.getByRole('button', { name: 'Back to Savings' }).click();

    //withdraw usds
    await page.getByTestId('undefined-menu-button').click();
    await page.getByRole('button', { name: 'USDS USDS USDS' }).click();

    await page.getByTestId('l2-savings-withdraw-input').click();
    await page.getByTestId('l2-savings-withdraw-input').fill('10');
    // Due to rounding, sometimes there's not enough sUSDS balance to withdraw the full amount of 10 USDS
    await page.getByTestId('l2-savings-withdraw-input').fill('9');

    await expect(page.getByRole('button', { name: 'Transaction overview' })).toBeVisible();

    await approveOrPerformAction(page, 'Withdraw');

    await page.getByRole('button', { name: 'Back to Savings' }).click();
  });

  test(`Batch - Go to ${networkName} Savings and perform a batch deposit and a batch withdrawal`, async ({
    page
  }) => {
    await page.goto('/');
    await connectMockWalletAndAcceptTerms(page, { batch: true });
    await page.getByRole('tab', { name: 'Savings' }).click();
    await switchToL2(page, networkName);

    //supply USDS
    await page.getByTestId('l2-savings-supply-input').click();
    await page.getByTestId('l2-savings-supply-input').fill('10');
    await expect(page.getByRole('button', { name: 'Transaction overview' })).toBeVisible();
    // This expects to perform the Supply step directly without needing to do the Approve USDS step
    await performAction(page, 'Supply');
    await page.getByRole('button', { name: 'Back to Savings' }).click();

    //withdraw USDS
    await page.getByRole('tab', { name: 'Withdraw' }).click();
    await page.getByTestId('l2-savings-withdraw-input').click();
    await page.getByTestId('l2-savings-withdraw-input').fill('9');
    await expect(page.getByRole('button', { name: 'Transaction overview' })).toBeVisible();
    // This expects to perform the Withdraw step directly without needing to do the Approve sUSDS step
    await performAction(page, 'Withdraw');
    await page.getByRole('button', { name: 'Back to Savings' }).click();
  });
};
