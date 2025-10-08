import { expect, test } from '../fixtures-parallel';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.ts';
import { switchToL2 } from '../utils/switchToL2.ts';
import { performAction } from '../utils/approveOrPerformAction.ts';
import { NetworkName } from '../utils/constants.ts';

export const runL2SavingsTests = async ({ networkName }: { networkName: NetworkName }) => {
  test(`Go to ${networkName} Savings, deposit usds and usdc, withdraw usdc and usds`, async ({
    isolatedPage
  }) => {
    await isolatedPage.goto('/');
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
    await isolatedPage.waitForTimeout(1000);
    await isolatedPage.getByRole('tab', { name: 'Savings' }).click();
    await switchToL2(isolatedPage, networkName);

    await expect(isolatedPage.getByRole('button', { name: 'Transaction overview' })).not.toBeVisible();

    //supply usds
    await isolatedPage.getByTestId('l2-savings-supply-input').click();
    await isolatedPage.getByTestId('l2-savings-supply-input').fill('10');

    await expect(isolatedPage.getByRole('button', { name: 'Transaction overview' })).toBeVisible();

    await performAction(isolatedPage, 'Supply');

    await isolatedPage.getByRole('button', { name: 'Back to Savings' }).click();

    //supply usdc
    await isolatedPage.getByTestId('undefined-menu-button').click();
    await isolatedPage.getByRole('button', { name: 'USDC USDC USDC' }).click();

    await isolatedPage.getByTestId('l2-savings-supply-input').click();
    await isolatedPage.getByTestId('l2-savings-supply-input').fill('10');

    await expect(isolatedPage.getByRole('button', { name: 'Transaction overview' })).toBeVisible();

    await performAction(isolatedPage, 'Supply');

    await isolatedPage.getByRole('button', { name: 'Back to Savings' }).click();

    await isolatedPage.getByRole('tab', { name: 'Withdraw' }).click();

    //withdraw usdc
    await isolatedPage.getByTestId('l2-savings-withdraw-input').click();
    await isolatedPage.getByTestId('l2-savings-withdraw-input').fill('10');
    await expect(isolatedPage.getByRole('button', { name: 'Transaction overview' })).toBeVisible();

    await performAction(isolatedPage, 'Withdraw');

    await isolatedPage.getByRole('button', { name: 'Back to Savings' }).click();

    //withdraw usds
    await isolatedPage.getByTestId('undefined-menu-button').click();
    await isolatedPage.getByRole('button', { name: 'USDS USDS USDS' }).click();

    await isolatedPage.getByTestId('l2-savings-withdraw-input').click();
    await isolatedPage.getByTestId('l2-savings-withdraw-input').fill('10');
    // Due to rounding, sometimes there's not enough sUSDS balance to withdraw the full amount of 10 USDS
    await isolatedPage.getByTestId('l2-savings-withdraw-input').fill('9');

    await expect(isolatedPage.getByRole('button', { name: 'Transaction overview' })).toBeVisible();

    await performAction(isolatedPage, 'Withdraw');

    await isolatedPage.getByRole('button', { name: 'Back to Savings' }).click();
  });

  test(`Batch - Go to ${networkName} Savings and perform a batch deposit and a batch withdrawal`, async ({
    isolatedPage
  }) => {
    await isolatedPage.goto('/');
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
    await isolatedPage.waitForTimeout(1000);
    await isolatedPage.getByRole('tab', { name: 'Savings' }).click();
    await switchToL2(isolatedPage, networkName);

    //supply USDS
    await isolatedPage.getByTestId('l2-savings-supply-input').click();
    await isolatedPage.getByTestId('l2-savings-supply-input').fill('10');
    await expect(isolatedPage.getByRole('button', { name: 'Transaction overview' })).toBeVisible();
    // This expects to perform the Supply step directly without needing to do the Approve USDS step
    await performAction(isolatedPage, 'Supply');
    await isolatedPage.getByRole('button', { name: 'Back to Savings' }).click();

    //withdraw USDS
    await isolatedPage.getByRole('tab', { name: 'Withdraw' }).click();
    await isolatedPage.getByTestId('l2-savings-withdraw-input').click();
    await isolatedPage.getByTestId('l2-savings-withdraw-input').fill('9');
    await expect(isolatedPage.getByRole('button', { name: 'Transaction overview' })).toBeVisible();
    // This expects to perform the Withdraw step directly without needing to do the Approve sUSDS step
    await performAction(isolatedPage, 'Withdraw');
    await isolatedPage.getByRole('button', { name: 'Back to Savings' }).click();
  });
};
