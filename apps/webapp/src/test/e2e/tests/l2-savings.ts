import { expect, test } from '../fixtures-parallel';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.ts';
import { switchToL2 } from '../utils/switchToL2.ts';
import { performAction, approveOrPerformAction } from '../utils/approveOrPerformAction.ts';
import { toggleBundleTransactions } from '../utils/toggleBundleTransactions.ts';
import { NetworkName } from '../utils/constants.ts';
import { Page } from '@playwright/test';

/**
 * Helper function to perform supply or withdraw action with bundled or non-bundled flow
 */
const performL2SavingsAction = async (
  page: Page,
  action: 'Supply' | 'Withdraw',
  bundled: boolean
): Promise<void> => {
  if (bundled) {
    await performAction(page, action);
  } else {
    await page.getByTestId('widget-button').getByText('Review').first().click();
    await toggleBundleTransactions(page, false);
    await approveOrPerformAction(page, action, { review: false });
  }
};

/**
 * Helper function to test L2 savings flow with multiple token deposits and withdrawals
 */
const testL2SavingsMultiTokenFlow = async (
  page: Page,
  networkName: NetworkName,
  bundled: boolean
): Promise<void> => {
  await page.goto('/');
  await connectMockWalletAndAcceptTerms(page, { batch: true });
  await page.waitForTimeout(1000);
  await page.getByRole('tab', { name: 'Savings' }).click();
  await switchToL2(page, networkName);

  await expect(page.getByRole('button', { name: 'Transaction overview' })).not.toBeVisible();

  //supply usds
  await page.getByTestId('l2-savings-supply-input').click();
  await page.getByTestId('l2-savings-supply-input').fill('10');

  await expect(page.getByRole('button', { name: 'Transaction overview' })).toBeVisible();

  await performL2SavingsAction(page, 'Supply', bundled);

  await page.getByRole('button', { name: 'Back to Savings' }).click();

  //supply usdc
  await page.getByTestId('undefined-menu-button').click();
  await page.getByRole('button', { name: 'USDC USDC USDC' }).click();

  await page.getByTestId('l2-savings-supply-input').click();
  await page.getByTestId('l2-savings-supply-input').fill('10');

  await expect(page.getByRole('button', { name: 'Transaction overview' })).toBeVisible();

  await performL2SavingsAction(page, 'Supply', bundled);

  await page.getByRole('button', { name: 'Back to Savings' }).click();

  await page.getByRole('tab', { name: 'Withdraw' }).click();

  //withdraw usdc
  await page.getByTestId('l2-savings-withdraw-input').click();
  await page.getByTestId('l2-savings-withdraw-input').fill('10');
  await expect(page.getByRole('button', { name: 'Transaction overview' })).toBeVisible();

  await performAction(page, 'Withdraw');

  await page.getByRole('button', { name: 'Back to Savings' }).click();

  //withdraw usds
  await page.getByTestId('undefined-menu-button').click();
  await page.getByRole('button', { name: 'USDS USDS USDS' }).click();

  await page.getByTestId('l2-savings-withdraw-input').click();
  await page.getByTestId('l2-savings-withdraw-input').fill('10');
  // Due to rounding, sometimes there's not enough sUSDS balance to withdraw the full amount of 10 USDS
  await page.getByTestId('l2-savings-withdraw-input').fill('9');

  await expect(page.getByRole('button', { name: 'Transaction overview' })).toBeVisible();

  await performAction(page, 'Withdraw');

  await page.getByRole('button', { name: 'Back to Savings' }).click();
};

/**
 * Helper function to test simple L2 savings deposit and withdrawal flow
 */
const testL2SavingsSimpleFlow = async (
  page: Page,
  networkName: NetworkName,
  bundled: boolean
): Promise<void> => {
  await page.goto('/');
  await connectMockWalletAndAcceptTerms(page, { batch: true });
  await page.waitForTimeout(1000);
  await page.getByRole('tab', { name: 'Savings' }).click();
  await switchToL2(page, networkName);

  //supply USDS
  await page.getByTestId('l2-savings-supply-input').click();
  await page.getByTestId('l2-savings-supply-input').fill('10');
  await expect(page.getByRole('button', { name: 'Transaction overview' })).toBeVisible();

  await performL2SavingsAction(page, 'Supply', bundled);
  await page.getByRole('button', { name: 'Back to Savings' }).click();

  //withdraw USDS
  await page.getByRole('tab', { name: 'Withdraw' }).click();
  await page.getByTestId('l2-savings-withdraw-input').click();
  await page.getByTestId('l2-savings-withdraw-input').fill('9');
  await expect(page.getByRole('button', { name: 'Transaction overview' })).toBeVisible();

  await performAction(page, 'Withdraw');
  await page.getByRole('button', { name: 'Back to Savings' }).click();
};

export const runL2SavingsTests = async ({ networkName }: { networkName: NetworkName }) => {
  test(`Go to ${networkName} Savings, deposit usds and usdc, withdraw usdc and usds - Bundled`, async ({
    isolatedPage
  }) => {
    await testL2SavingsMultiTokenFlow(isolatedPage, networkName, true);
  });

  test(`Go to ${networkName} Savings, deposit usds and usdc, withdraw usdc and usds - Non-bundled`, async ({
    isolatedPage
  }) => {
    await testL2SavingsMultiTokenFlow(isolatedPage, networkName, false);
  });

  test(`Go to ${networkName} Savings and perform a deposit and a withdrawal - Bundled`, async ({
    isolatedPage
  }) => {
    await testL2SavingsSimpleFlow(isolatedPage, networkName, true);
  });

  test(`Go to ${networkName} Savings and perform a deposit and a withdrawal - Non-bundled`, async ({
    isolatedPage
  }) => {
    await testL2SavingsSimpleFlow(isolatedPage, networkName, false);
  });
};
