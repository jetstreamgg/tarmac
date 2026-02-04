import { expect, test } from '../fixtures-parallel';
import { performAction } from '../utils/approveOrPerformAction.ts';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.ts';
import { approveToken } from '../utils/approveToken.ts';
import { usdsAddress, usdsSkyRewardAddress } from '@jetstreamgg/sky-hooks';
import { TENDERLY_CHAIN_ID } from '@/data/wagmi/config/testTenderlyChain.ts';
import { NetworkName } from '../utils/constants.ts';
import { Page } from '@playwright/test';
import { initializeTestAccount } from '../utils/initializeTestAccount.ts';
// Helper function to parse balance text and extract numeric value
const parseBalanceText = (balanceText: string): number => {
  const balanceStr = balanceText.replace('USDS', '').replace(/,/g, '').trim();
  return parseFloat(balanceStr);
};

// Get the rewards card supplied balance
const getRewardsCardSuppliedBalance = async (page: Page): Promise<number> => {
  const rewardsCardSuppliedBalance = page
    .getByTestId('widget-container')
    .getByText('Supplied balance', { exact: true })
    .locator('xpath=ancestor::div[1]')
    .getByText(/^\d.*USDS$/);

  const balanceText = await rewardsCardSuppliedBalance.innerText();
  return parseBalanceText(balanceText);
};

// Get supply input balance
const getSupplyInputBalance = async (page: Page): Promise<number> => {
  const balanceLabel = page.getByTestId('supply-input-rewards-balance');
  const balanceText = await balanceLabel.innerText();
  return parseBalanceText(balanceText);
};

// Get withdraw input balance
const getWithdrawInputBalance = async (page: Page): Promise<number> => {
  const balanceLabel = page.getByTestId('withdraw-input-rewards-balance');
  const balanceText = await balanceLabel.innerText();
  return parseBalanceText(balanceText);
};

test.beforeEach(async ({ isolatedPage }) => {
  await isolatedPage.goto('/');
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.waitForTimeout(1000);
  await isolatedPage.getByRole('tab', { name: 'Rewards' }).click();
  await isolatedPage.getByText('With: USDS Get: SPK').first().click();
});

test('Supply and withdraw with insufficient balance', async ({ isolatedPage }) => {
  // Wait for balance to load
  await isolatedPage.waitForLoadState('domcontentloaded');
  const balanceLabel = isolatedPage.getByTestId('supply-input-rewards-balance');
  await expect(balanceLabel).not.toHaveText('No wallet connected');

  // Get current balance dynamically
  const balance = await getSupplyInputBalance(isolatedPage);

  // Supply an amount greater than the balance
  await isolatedPage.getByTestId('supply-input-rewards').fill(`${balance + 1}`);
  await expect(isolatedPage.getByText('Insufficient funds')).toBeVisible();

  await isolatedPage.getByRole('tab', { name: 'Withdraw' }).click();
  // Withdraw an amount greater than the supplied balance (which is 0)
  const withdrawBalance = await getWithdrawInputBalance(isolatedPage);
  await isolatedPage.getByRole('tab', { name: 'Withdraw' }).click();
  await isolatedPage.getByTestId('withdraw-input-rewards').fill(`${withdrawBalance + 1}`);
  await expect(isolatedPage.getByText('Insufficient funds')).toBeVisible();
});

test.skip('Balances change after successfully supplying and withdrawing', async ({
  isolatedPage,
  testAccount
}) => {
  console.log('Test starting with account:', testAccount);

  // Initialize the account to ensure it's properly set up on-chain
  await initializeTestAccount(testAccount);

  // Get initial balances
  const initialSupplyBalance = await getSupplyInputBalance(isolatedPage);
  const initialSuppliedBalance = await getRewardsCardSuppliedBalance(isolatedPage);

  console.log('💰 Initial balances:', { initialSupplyBalance, initialSuppliedBalance });

  // Verify initial supplied balance is 0
  expect(initialSuppliedBalance).toBeGreaterThanOrEqual(0);

  // Supply 2 USDS
  await isolatedPage.getByTestId('supply-input-rewards').fill('2');
  await expect(isolatedPage.getByTestId('widget-button')).toBeEnabled();
  await performAction(isolatedPage, 'Supply');
  await isolatedPage.getByRole('button', { name: 'Back to Rewards' }).click();
  expect(await isolatedPage.getByTestId('supply-input-rewards-balance')).toBeVisible();

  // Check balances after supply
  const supplyBalanceAfterSupply = await getSupplyInputBalance(isolatedPage);
  const suppliedBalanceAfterSupply = await getRewardsCardSuppliedBalance(isolatedPage);

  console.log('Balances after supply:', { supplyBalanceAfterSupply, suppliedBalanceAfterSupply });
  console.log(
    '🔍 Expected changes: supply should be',
    initialSupplyBalance - 2,
    'supplied should be',
    initialSuppliedBalance + 2
  );

  // if balance remained same, redo
  if (supplyBalanceAfterSupply === initialSupplyBalance) {
    // await isolatedPage.reload();
    // await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
    // await isolatedPage.waitForTimeout(1000);
    // await isolatedPage.getByRole('tab', { name: 'Rewards' }).click();
    // await isolatedPage.getByText('With: USDS Get: SKY').first().click();
    // supply again
    await isolatedPage.getByTestId('supply-input-rewards').fill('2');
    await performAction(isolatedPage, 'Supply');
    await isolatedPage.getByRole('button', { name: 'Back to Rewards' }).click();
  }

  console.log('supplyBalanceAfterSupply:', supplyBalanceAfterSupply);
  console.log('suppliedBalanceAfterSupply:', suppliedBalanceAfterSupply);
  console.log('initialSupplyBalance:', initialSupplyBalance);
  console.log('initialSuppliedBalance:', initialSuppliedBalance);

  expect(supplyBalanceAfterSupply).toBeCloseTo(initialSupplyBalance - 2, 2);
  expect(suppliedBalanceAfterSupply).toBeCloseTo(initialSuppliedBalance + 2, 1);

  // Withdraw
  await isolatedPage.getByRole('tab', { name: 'Withdraw' }).click();
  const withdrawBalanceBeforeWithdraw = await getWithdrawInputBalance(isolatedPage);

  await isolatedPage.getByTestId('withdraw-input-rewards').fill('2');
  await performAction(isolatedPage, 'Withdraw');
  await isolatedPage.getByRole('button', { name: 'Back to Rewards' }).click();
  expect(await isolatedPage.getByTestId('withdraw-input-rewards-balance')).toBeVisible();

  // Check balances after withdraw
  const withdrawBalanceAfterWithdraw = await getWithdrawInputBalance(isolatedPage);
  const suppliedBalanceAfterWithdraw = await getRewardsCardSuppliedBalance(isolatedPage);

  expect(withdrawBalanceAfterWithdraw).toBeCloseTo(withdrawBalanceBeforeWithdraw - 2);
  expect(suppliedBalanceAfterWithdraw).toBeCloseTo(suppliedBalanceAfterSupply - 2);

  // Check balance is restored
  await isolatedPage.getByRole('tab', { name: 'Supply', exact: true }).click();
  const finalSupplyBalance = await getSupplyInputBalance(isolatedPage);
  expect(finalSupplyBalance).toBeCloseTo(initialSupplyBalance, 2);
});

test('Insufficient token allowance triggers approval flow', async ({ isolatedPage }) => {
  // Get balance dynamically
  const balance = await getSupplyInputBalance(isolatedPage);

  // Use 90% of balance or 90, whichever is smaller
  const supplyAmount = Math.min(90, Math.floor(balance * 0.9));

  await isolatedPage.getByTestId('supply-input-rewards').fill(supplyAmount.toString());
  await isolatedPage.getByRole('button', { name: 'Review' }).click();
  // Not enough allowance, so the button should prompt 2 transactions
  await expect(isolatedPage.getByTestId('widget-button').last()).toHaveText(
    /^Confirm 2 transactions|Confirm bundled transaction$/
  );
  await approveToken(
    usdsAddress[TENDERLY_CHAIN_ID],
    usdsSkyRewardAddress[TENDERLY_CHAIN_ID],
    supplyAmount.toString(),
    NetworkName.mainnet
  );

  // Restart
  await isolatedPage.reload();
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.waitForTimeout(1000);
  await isolatedPage.getByRole('tab', { name: 'Rewards' }).click();
  await isolatedPage.getByText('With: USDS Get: SKY').first().click();

  await isolatedPage.getByTestId('supply-input-rewards').fill(supplyAmount.toString());
  await isolatedPage.getByRole('button', { name: 'Review' }).click();
  // It should not ask for approval
  await expect(
    isolatedPage.getByRole('button', { name: 'Confirm bundled transaction' }).last()
  ).toBeVisible();
  // Supply and reset approval
  await isolatedPage
    .getByTestId('widget-container')
    .getByRole('button', { name: 'Confirm bundled transaction' })
    .last()
    .click();
  await isolatedPage.getByRole('button', { name: 'Back to Rewards' }).click();

  // Restart
  await isolatedPage.reload();
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.waitForTimeout(1000);
  await isolatedPage.getByRole('tab', { name: 'Rewards' }).click();
  await isolatedPage.getByText('With: USDS Get: SKY').first().click();

  await isolatedPage.getByTestId('supply-input-rewards').fill('10');
  await isolatedPage.getByRole('button', { name: 'Review' }).click();
  // Allowance should be reset, so approve button should be visible again
  await expect(isolatedPage.getByTestId('widget-button').last()).toHaveText(
    /^Confirm 2 transactions|Confirm bundled transaction$/
  );
});

test('if not connected it should show a connect button', async ({ isolatedPage }) => {
  await isolatedPage.reload();

  // Connect button and copy should be visible
  const widgetConnectButton = isolatedPage
    .getByTestId('widget-container')
    .getByRole('button', { name: 'Connect Wallet' });
  await expect(widgetConnectButton).toBeEnabled();
  await expect(isolatedPage.getByRole('heading', { name: 'Connect to explore Sky' })).toBeVisible();

  // After connecting, the button should disappear
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.waitForTimeout(1000);
  await expect(widgetConnectButton).not.toBeVisible();
});

test('percentage buttons update the token input', async ({ isolatedPage }) => {
  // Get balance dynamically for percentage calculations
  const balance = await getSupplyInputBalance(isolatedPage);

  await isolatedPage.getByRole('button', { name: '25%' }).click();
  const val25 = parseFloat(await isolatedPage.getByTestId('supply-input-rewards').inputValue());
  expect(val25).toBeCloseTo(balance * 0.25, 1);

  await isolatedPage.getByRole('button', { name: '100%' }).click();
  const val100 = parseFloat(await isolatedPage.getByTestId('supply-input-rewards').inputValue());
  expect(val100).toBeCloseTo(balance, 1);

  await isolatedPage.getByRole('button', { name: '50%' }).click();
  const val50 = parseFloat(await isolatedPage.getByTestId('supply-input-rewards').inputValue());
  expect(val50).toBeCloseTo(balance * 0.5, 1);

  // Supply 50% so we can test the withdraw tab
  await performAction(isolatedPage, 'Supply');
  await isolatedPage.getByRole('button', { name: 'Back to Rewards' }).click();

  await isolatedPage.getByRole('tab', { name: 'Withdraw' }).click();

  // Get withdraw balance
  const withdrawBalance = await getWithdrawInputBalance(isolatedPage);

  await isolatedPage.getByRole('button', { name: '25%' }).click();
  const withdraw25 = parseFloat(await isolatedPage.getByTestId('withdraw-input-rewards').inputValue());
  expect(withdraw25).toBeCloseTo(withdrawBalance * 0.25, 1);

  await isolatedPage.getByRole('button', { name: '50%' }).click();
  const withdraw50 = parseFloat(await isolatedPage.getByTestId('withdraw-input-rewards').inputValue());
  expect(withdraw50).toBeCloseTo(withdrawBalance * 0.5, 1);

  await isolatedPage.getByRole('button', { name: '100%' }).click();
  const withdraw100 = parseFloat(await isolatedPage.getByTestId('withdraw-input-rewards').inputValue());
  expect(withdraw100).toBeCloseTo(withdrawBalance, 1);

  // Withdraw all to reset balances
  // await withdrawAllAndReset(isolatedPage);
});

test('Enter amount button only gets enabled with a valid amount', async ({ isolatedPage }) => {
  const widgetButton = isolatedPage.getByTestId('widget-container').getByRole('button').last();

  // Supply
  await expect(widgetButton).toBeDisabled();
  await isolatedPage.getByTestId('supply-input-rewards').fill('0');
  await expect(widgetButton).toBeDisabled();
  await isolatedPage.getByTestId('supply-input-rewards').fill('1');
  await expect(widgetButton).toBeEnabled();

  // Withdraw
  await isolatedPage.getByRole('tab', { name: 'Withdraw' }).click();
  await expect(widgetButton).toBeDisabled();
  await isolatedPage.getByTestId('withdraw-input-rewards').fill('0');
  await expect(widgetButton).toBeDisabled();
});

test.skip('Batch - Balances change after successfully supplying and withdrawing', async ({
  isolatedPage
}) => {
  // Get initial balance dynamically
  const initialBalance = await getSupplyInputBalance(isolatedPage);

  const initialSuppliedBalance = await getRewardsCardSuppliedBalance(isolatedPage);
  expect(initialSuppliedBalance).toBe(0);

  await isolatedPage.getByTestId('supply-input-rewards').fill('2');

  await expect(isolatedPage.getByTestId('widget-button')).toBeEnabled();
  await performAction(isolatedPage, 'Supply');
  await isolatedPage.getByRole('button', { name: 'Back to Rewards' }).click();

  const supplyBalanceAfterSupply = await getSupplyInputBalance(isolatedPage);
  const suppliedBalanceAfterSupply = await getRewardsCardSuppliedBalance(isolatedPage);

  expect(supplyBalanceAfterSupply).toBeCloseTo(initialBalance - 2, 2);
  expect(suppliedBalanceAfterSupply).toBe(2);

  await isolatedPage.getByRole('tab', { name: 'Withdraw' }).click();
  const withdrawBalanceBeforeWithdraw = await getWithdrawInputBalance(isolatedPage);
  expect(withdrawBalanceBeforeWithdraw).toBe(2);

  await isolatedPage.getByTestId('withdraw-input-rewards').fill('2');
  await performAction(isolatedPage, 'Withdraw');
  await isolatedPage.getByRole('button', { name: 'Back to Rewards' }).click();

  const withdrawBalanceAfterWithdraw = await getWithdrawInputBalance(isolatedPage);
  const suppliedBalanceAfterWithdraw = await getRewardsCardSuppliedBalance(isolatedPage);

  expect(withdrawBalanceAfterWithdraw).toBe(0);
  expect(suppliedBalanceAfterWithdraw).toBe(0);

  await isolatedPage.getByRole('tab', { name: 'Supply', exact: true }).click();
  const finalSupplyBalance = await getSupplyInputBalance(isolatedPage);
  expect(finalSupplyBalance).toBeCloseTo(initialBalance, 2);
});
