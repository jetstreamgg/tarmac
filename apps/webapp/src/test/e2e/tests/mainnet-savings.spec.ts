import { expect, test } from '../fixtures-parallel';
import { setErc20Balance } from '../utils/setBalance.ts';
import { NetworkName } from '../utils/constants';
import { sUsdsAddress, usdsAddress } from '@jetstreamgg/sky-hooks';
import { TENDERLY_CHAIN_ID } from '@/data/wagmi/config/testTenderlyChain.ts';
import { performAction } from '../utils/approveOrPerformAction.ts';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.ts';
import { approveToken } from '../utils/approveToken.ts';
import { Page } from '@playwright/test';

// Helper function to parse balance text and extract numeric value
const parseBalanceText = (balanceText: string): number => {
  const balanceStr = balanceText.replace('USDS', '').replace('sUSDS', '').replace(/,/g, '').trim();
  return parseFloat(balanceStr);
};

// Get the supply input balance for savings
const getSupplyInputBalance = async (page: Page): Promise<number> => {
  const balanceLabel = page.getByTestId('supply-input-savings-balance');
  const balanceText = await balanceLabel.innerText();
  return parseBalanceText(balanceText);
};

// Get the supplied balance for savings
const getSuppliedBalance = async (page: Page): Promise<number> => {
  const balanceLabel = page.getByTestId('supplied-balance');
  const balanceText = await balanceLabel.innerText();
  return parseBalanceText(balanceText);
};

test('Supply and withdraw from Savings', async ({ isolatedPage }) => {
  await isolatedPage.goto('/');
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.waitForTimeout(1000);
  await isolatedPage.getByRole('tab', { name: 'Savings' }).click();

  await expect(isolatedPage.getByRole('button', { name: 'Transaction overview' })).not.toBeVisible();

  await isolatedPage.getByTestId('supply-input-savings').click();
  await isolatedPage.getByTestId('supply-input-savings').click();
  await isolatedPage.getByTestId('supply-input-savings').fill('.02');
  await expect(isolatedPage.getByRole('button', { name: 'Transaction overview' })).toBeVisible();
  await performAction(isolatedPage, 'Supply');
  await isolatedPage.getByRole('button', { name: 'Back to Savings' }).click();
  await isolatedPage.getByRole('tab', { name: 'Withdraw' }).click();

  await isolatedPage.getByTestId('withdraw-input-savings').click();
  // Tx overview should be hidden if the input is 0 or empty
  await isolatedPage.getByTestId('withdraw-input-savings').fill('0');
  await expect(isolatedPage.getByRole('button', { name: 'Transaction overview' })).not.toBeVisible();
  await isolatedPage.getByTestId('withdraw-input-savings').fill('.01');
  await expect(isolatedPage.getByRole('button', { name: 'Transaction overview' })).toBeVisible();

  performAction(isolatedPage, 'Withdraw');

  await expect(
    isolatedPage.getByText("You've withdrawn 0.01 USDS from the Sky Savings Rate module")
  ).toBeVisible();
  //TODO: why is the finish button disabled?
  await isolatedPage.getByRole('button', { name: 'Back to Savings' }).click();
});

test('supply with insufficient usds balance', async ({ isolatedPage }) => {
  await isolatedPage.goto('/');
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.waitForTimeout(1000);
  await isolatedPage.getByRole('tab', { name: 'Savings' }).click();

  await isolatedPage.waitForLoadState('domcontentloaded');
  const balanceLabelexpected = await isolatedPage.getByTestId('supply-input-savings-balance');
  await expect(balanceLabelexpected).not.toHaveText('No wallet connected');

  const balance = await getSupplyInputBalance(isolatedPage);
  console.log('balance:', balance);
  await isolatedPage.getByTestId('supply-input-savings').click();
  await isolatedPage.getByTestId('supply-input-savings').fill(`${balance + 1}`); // Supply an amount greater than the balance
  await expect(isolatedPage.getByText('Insufficient funds')).toBeVisible();
});

test('withdraw with insufficient savings balance', async ({ isolatedPage }) => {
  await isolatedPage.goto('/');
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.waitForTimeout(1000);
  await isolatedPage.getByRole('tab', { name: 'Savings' }).click();
  await isolatedPage.getByRole('tab', { name: 'Withdraw' }).click();

  await isolatedPage.getByTestId('withdraw-input-savings-max').click();
  const reviewButton = await isolatedPage
    .waitForSelector('role=button[name="Review"]', { timeout: 500 })
    .catch(() => null);

  const preSupplyBalance = await getSuppliedBalance(isolatedPage);

  // If there's no review button after clicking 100%, it means we don't any USDS supplied
  if (reviewButton) {
    await performAction(isolatedPage, 'Withdraw');
    await expect(
      isolatedPage.getByText(`You've withdrawn ${preSupplyBalance} USDS from the Sky Savings Rate module`)
    ).toBeVisible();
    // await expect(isolatedPage.locator('text=successfully withdrew')).toHaveCount(2);
    await isolatedPage.getByRole('button', { name: 'Back to Savings' }).click();
  }

  await isolatedPage.getByTestId('withdraw-input-savings').click();
  await isolatedPage.getByTestId('withdraw-input-savings').fill('100');
  await expect(isolatedPage.getByText('Insufficient funds.')).toBeVisible();
  const reviewButtonDisabled = isolatedPage.getByTestId('widget-button');
  expect(reviewButtonDisabled).toHaveText('Review');
  expect(reviewButtonDisabled).toBeDisabled();
});

test('Balance changes after a successful supply', async ({ isolatedPage, testAccount }) => {
  console.log('🧪 Test starting with account:', testAccount);

  await isolatedPage.goto('/');
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.waitForTimeout(1000);
  await isolatedPage.getByRole('tab', { name: 'Savings' }).click();
  await isolatedPage.waitForLoadState('domcontentloaded');
  await expect(isolatedPage.getByTestId('supply-input-savings-balance')).not.toHaveText(
    'No wallet connected'
  );

  // Get initial balances using helper functions
  const initialSupplyBalance = await getSupplyInputBalance(isolatedPage);
  const initialSuppliedBalance = await getSuppliedBalance(isolatedPage);

  console.log('💰 Initial balances:', { initialSupplyBalance, initialSuppliedBalance });

  await isolatedPage.getByTestId('supply-input-savings').click();
  await isolatedPage.getByTestId('supply-input-savings').fill('2');
  await performAction(isolatedPage, 'Supply');
  await isolatedPage.getByRole('button', { name: 'Back to Savings' }).click();

  await expect(isolatedPage.getByTestId('supply-input-savings-balance')).toBeVisible();
  await isolatedPage.waitForLoadState('domcontentloaded');
  await isolatedPage.waitForTimeout(5000);

  // Check balances after supply using helper functions
  const supplyBalanceAfterSupply = await getSupplyInputBalance(isolatedPage);
  const suppliedBalanceAfterSupply = await getSuppliedBalance(isolatedPage);

  console.log('💰 Balances after supply:', { supplyBalanceAfterSupply, suppliedBalanceAfterSupply });
  console.log(
    '🔍 Expected changes: supply should be',
    initialSupplyBalance - 2,
    'supplied should be',
    initialSuppliedBalance + 2
  );

  // expect(supplyBalanceAfterSupply).toBeCloseTo(initialSupplyBalance - 2, 2);
  expect(suppliedBalanceAfterSupply).toBeCloseTo(initialSuppliedBalance + 2, 1);
});

test('Balance changes after a successful withdraw', async ({ isolatedPage }) => {
  // await setErc20Balance(usdsAddress[TENDERLY_CHAIN_ID], '10', 18, NetworkName.mainnet, testAccount);
  await isolatedPage.goto('/');
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.waitForTimeout(1000);
  await isolatedPage.getByRole('tab', { name: 'Savings' }).click();

  // Supply some USDS
  await isolatedPage.getByTestId('supply-input-savings').click();
  await isolatedPage.getByTestId('supply-input-savings').fill('4');
  await performAction(isolatedPage, 'Supply');
  await isolatedPage.getByRole('button', { name: 'Back to Savings' }).click();

  // Withdraw
  await isolatedPage.getByRole('tab', { name: 'Withdraw' }).click();

  const prewithdrawBalance = await getSuppliedBalance(isolatedPage);
  const withdrawBalance = prewithdrawBalance;

  await isolatedPage.getByRole('button', { name: '25%' }).click();
  const input25 = await isolatedPage.getByTestId('withdraw-input-savings').inputValue();
  const val25 = parseFloat(input25);
  console.log('input25', val25);
  expect(val25).toBeCloseTo(withdrawBalance * 0.25, 0);

  await isolatedPage.getByRole('button', { name: '50%' }).click();
  const input50 = await isolatedPage.getByTestId('withdraw-input-savings').inputValue();
  const val50 = parseFloat(input50);
  console.log('input50', val50);
  expect(val50).toBeCloseTo(withdrawBalance * 0.5, 0);

  await isolatedPage.getByRole('button', { name: '100%' }).click();
  const input100 = await isolatedPage.getByTestId('withdraw-input-savings').inputValue();
  const val100 = parseFloat(input100);
  console.log('input100', val100);
  expect(val100).toBeCloseTo(withdrawBalance, 0);

  await isolatedPage.getByTestId('withdraw-input-savings').click();
  await isolatedPage.getByTestId('withdraw-input-savings').fill('2');
  const reviewButton = await isolatedPage
    .waitForSelector('role=button[name="Review"]', { timeout: 500 })
    .catch(() => null);
  if (reviewButton) {
    await performAction(isolatedPage, 'Withdraw');
  }
  await isolatedPage.getByRole('button', { name: 'Back to Savings' }).click();

  const expectedBalance = prewithdrawBalance - 2;
  if (expectedBalance >= 1) {
    // We supplied 4 and then withdrew 2
    // Use a more flexible check that handles the sUSDS display format
    const actualBalance = await getSuppliedBalance(isolatedPage);
    expect(actualBalance).toBeCloseTo(expectedBalance, 1);
  } else {
    const zeroBalance = await getSuppliedBalance(isolatedPage);
    expect(zeroBalance).toBeLessThan(1);
  }
});

test('supply with enough allowance does not require approval', async ({ isolatedPage }) => {
  await approveToken(usdsAddress[TENDERLY_CHAIN_ID], sUsdsAddress[TENDERLY_CHAIN_ID], '100');

  await isolatedPage.goto('/');
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.waitForTimeout(1000);
  await isolatedPage.getByRole('tab', { name: 'Savings' }).click();
  await isolatedPage.getByTestId('supply-input-savings').click();
  await isolatedPage.getByTestId('supply-input-savings').click();
  await isolatedPage.getByTestId('supply-input-savings').fill('100');
  // Go to review screen
  await isolatedPage.getByTestId('widget-button').first().click();
  // It should not ask for approval
  await expect(isolatedPage.getByTestId('widget-button').last()).toHaveText(/^Confirm bundled transaction$/);

  // Supply and reset approval
  await isolatedPage.getByTestId('widget-button').last().click();
});

test('supply without allowance requires approval', async ({ isolatedPage }) => {
  await setErc20Balance(usdsAddress[TENDERLY_CHAIN_ID], '101', 18, NetworkName.mainnet);
  await isolatedPage.goto('/');
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.waitForTimeout(1000);
  await isolatedPage.getByRole('tab', { name: 'Savings' }).click();
  await isolatedPage.getByTestId('supply-input-savings').click();
  await isolatedPage.getByTestId('supply-input-savings').click();
  await isolatedPage.getByTestId('supply-input-savings').fill('101');
  await isolatedPage.getByTestId('widget-button').click();
  // It should ask to confirm 2 transactions, including the approval
  await expect(isolatedPage.getByTestId('widget-button').last()).toHaveText(
    /^(Confirm 2 transactions|Confirm bundled transaction)$/
  );
});

test('if not connected it should show a connect button', async ({ isolatedPage }) => {
  await isolatedPage.goto('/');
  await isolatedPage.getByRole('tab', { name: 'Savings' }).click();

  const widgetConnectButton = isolatedPage
    .getByTestId('widget-container')
    .getByRole('button', { name: 'Connect Wallet' });

  await expect(isolatedPage.getByRole('heading', { name: 'Connect to explore Sky' })).toBeVisible();

  // Check that Connect button is visible
  await expect(widgetConnectButton).toBeVisible();

  // After connecting, the button should disappear
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.waitForTimeout(1000);
  await expect(widgetConnectButton).not.toBeVisible();
});

test('percentage buttons work', async ({ isolatedPage }) => {
  await isolatedPage.goto('/');
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.waitForTimeout(1000);
  await isolatedPage.getByRole('tab', { name: 'Savings' }).click();

  // await get balance
  expect(await isolatedPage.getByTestId('supply-input-savings-balance')).toBeVisible({ timeout: 15000 });
  await expect(isolatedPage.getByTestId('supply-input-savings-balance')).not.toHaveText(
    'No wallet connected'
  );
  const balanceNumber = await getSupplyInputBalance(isolatedPage);
  console.log('balanceNumber', balanceNumber);

  await isolatedPage.getByRole('button', { name: '25%' }).click();
  await isolatedPage.waitForTimeout(1000);
  const supplyInput25 = await isolatedPage.getByTestId('supply-input-savings').inputValue();
  console.log('supplyInput25', supplyInput25);
  const supplyVal25 = parseFloat(supplyInput25);
  //we should test close to the balance number
  expect(supplyVal25).toBeCloseTo(balanceNumber * 0.25, 0);

  await isolatedPage.getByRole('button', { name: '50%' }).click();
  await isolatedPage.waitForTimeout(1000);
  const supplyInput50 = await isolatedPage.getByTestId('supply-input-savings').inputValue();
  console.log('supplyInput50', supplyInput50);
  const supplyVal50 = parseFloat(supplyInput50);
  expect(supplyVal50).toBeCloseTo(balanceNumber * 0.5, 0);

  await isolatedPage.getByRole('button', { name: '100%' }).click();
  await isolatedPage.waitForTimeout(1000);
  const supplyInput100 = await isolatedPage.getByTestId('supply-input-savings').inputValue();
  console.log('supplyInput100', supplyInput100);
  const supplyVal100 = parseFloat(supplyInput100);
  expect(supplyVal100).toBeCloseTo(balanceNumber, 0);

  // await isolatedPage.getByRole('tab', { name: 'Withdraw' }).click();
  // const suppliedBalancedText = await isolatedPage.getByTestId('withdraw-input-savings-balance').innerText();
  // const withdrawBalance = parseFloat(suppliedBalancedText.replace('USDS', '').replace(/,/g, '').trim());

  // await isolatedPage.getByRole('button', { name: '25%' }).click();
  // const input25 = await isolatedPage.getByTestId('withdraw-input-savings').inputValue();
  // const val25 = parseFloat(input25);
  // console.log('input25', val25);
  // expect(val25).toBeCloseTo(withdrawBalance * 0.25, 0);

  // await isolatedPage.getByRole('button', { name: '50%' }).click();
  // const input50 = await isolatedPage.getByTestId('withdraw-input-savings').inputValue();
  // const val50 = parseFloat(input50);
  // console.log('input50', val50);
  // expect(val50).toBeCloseTo(withdrawBalance * 0.5, 0);

  // await isolatedPage.getByRole('button', { name: '100%' }).click();
  // const input100 = await isolatedPage.getByTestId('withdraw-input-savings').inputValue();
  // const val100 = parseFloat(input100);
  // console.log('input100', val100);
  // expect(val100).toBeCloseTo(withdrawBalance, 0);
});

test('enter amount button should be disabled', async ({ isolatedPage }) => {
  await isolatedPage.goto('/');
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.waitForTimeout(1000);
  await isolatedPage.getByRole('tab', { name: 'Savings' }).click();

  await expect(
    isolatedPage.getByTestId('widget-container').locator('button').filter({ hasText: 'Enter amount' })
  ).toBeDisabled();

  await isolatedPage.getByTestId('supply-input-savings').click();
  await isolatedPage.getByTestId('supply-input-savings').fill('0');

  await expect(
    isolatedPage.getByTestId('widget-container').locator('button').filter({ hasText: 'Enter amount' })
  ).toBeDisabled();

  // Withdraw
  await isolatedPage.getByRole('tab', { name: 'Withdraw' }).click();
  await expect(
    isolatedPage.getByTestId('widget-container').locator('button').filter({ hasText: 'Enter amount' })
  ).toBeDisabled();
  await isolatedPage.getByTestId('withdraw-input-savings').click();
  await isolatedPage.getByTestId('withdraw-input-savings').fill('0');
  // TODO: Fix this in widgets package
  await expect(
    isolatedPage.getByTestId('widget-container').locator('button').filter({ hasText: 'Enter amount' })
  ).toBeDisabled();
});

test('A supply error redirects to the error screen', async ({ isolatedPage }) => {
  // await setErc20Balance(usdsAddress[TENDERLY_CHAIN_ID], '101', 18, NetworkName.mainnet, testAccount);
  await isolatedPage.goto('/');
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.waitForTimeout(1000);
  await isolatedPage.getByRole('tab', { name: 'Savings' }).click();
  await isolatedPage.getByTestId('supply-input-savings').click();
  await isolatedPage.getByTestId('supply-input-savings').fill('100');

  await performAction(isolatedPage, 'Supply', { reject: true });

  expect(isolatedPage.getByText('An error occurred during the supply flow.').last()).toBeVisible();
  expect(isolatedPage.getByRole('button', { name: 'Back' }).last()).toBeVisible();
  expect(isolatedPage.getByRole('button', { name: 'Back' }).last()).toBeEnabled();
  expect(isolatedPage.getByRole('button', { name: 'Retry' }).last()).toBeVisible();
  await expect(isolatedPage.getByRole('button', { name: 'Retry' }).last()).toBeEnabled({ timeout: 15000 });

  await isolatedPage.getByRole('button', { name: 'Retry' }).last().click();

  await expect(isolatedPage.getByText('An error occurred during the supply flow.')).toBeVisible();
});

test('A withdraw error redirects to the error screen', async ({ isolatedPage }) => {
  await isolatedPage.goto('/');
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.waitForTimeout(1000);
  await isolatedPage.getByRole('tab', { name: 'Savings' }).click();

  // Supply some USDS
  await isolatedPage.getByTestId('supply-input-savings').click();
  await isolatedPage.getByTestId('supply-input-savings').fill('4');
  await performAction(isolatedPage, 'Supply');
  await isolatedPage.getByRole('button', { name: 'Back to Savings' }).click();

  // Then attempt to withdraw
  await isolatedPage.getByRole('tab', { name: 'Withdraw' }).click();
  await isolatedPage.getByTestId('withdraw-input-savings').click();
  await isolatedPage.getByTestId('withdraw-input-savings').fill('1');

  await performAction(isolatedPage, 'Withdraw', { reject: true });

  expect(isolatedPage.getByText('An error occurred during the withdraw flow.').last()).toBeVisible();
  expect(isolatedPage.getByRole('button', { name: 'Back' }).last()).toBeVisible();
  expect(isolatedPage.getByRole('button', { name: 'Back' }).last()).toBeEnabled();
  expect(isolatedPage.getByRole('button', { name: 'Retry' }).last()).toBeVisible();
  await expect(isolatedPage.getByRole('button', { name: 'Retry' }).last()).toBeEnabled({ timeout: 15000 });

  await isolatedPage.getByRole('button', { name: 'Retry' }).last().click();

  await expect(isolatedPage.getByText('An error occurred during the withdraw flow.')).toBeVisible();
});

test('Details pane shows right data', async ({ isolatedPage }) => {
  await isolatedPage.goto('/');
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.waitForTimeout(1000);
  await isolatedPage.getByRole('tab', { name: 'Savings' }).click();

  // Wait for data point to be ready
  await expect(isolatedPage.getByTestId('savings-remaining-balance-details')).toContainText('USDS');

  const balanceDetails = await isolatedPage.getByTestId('savings-remaining-balance-details').innerText();
  await expect(isolatedPage.getByTestId('supply-input-savings-balance')).toHaveText(balanceDetails);

  await isolatedPage.getByRole('tab', { name: 'Withdraw' }).click();
  // Wait for data point to be ready
  await expect(isolatedPage.getByTestId('savings-supplied-balance-details')).toContainText('USDS');

  const detailsSuppliedBalance = await isolatedPage
    .getByTestId('savings-supplied-balance-details')
    .innerText();
  await expect(isolatedPage.getByTestId('supplied-balance')).toContainText(detailsSuppliedBalance);

  // close details pane
  await isolatedPage.getByTestId('widget-container').getByLabel('Toggle details').click();
  await expect(isolatedPage.getByTestId('savings-stats-section')).not.toBeVisible();

  // open details pane
  await isolatedPage.getByTestId('widget-container').getByLabel('Toggle details').click();
  await expect(isolatedPage.getByTestId('savings-stats-section')).toBeVisible();

  // Chart is present
  await expect(isolatedPage.getByTestId('savings-chart')).toBeVisible();

  // History is present
  await expect(isolatedPage.getByTestId('savings-history')).toBeVisible();
});

test('Batch - Supply to Savings', async ({ isolatedPage }) => {
  await isolatedPage.goto('/');
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.waitForTimeout(1000);
  await isolatedPage.getByRole('tab', { name: 'Savings' }).click();

  await expect(isolatedPage.getByRole('button', { name: 'Transaction overview' })).not.toBeVisible();

  await isolatedPage.getByTestId('supply-input-savings').click();
  await isolatedPage.getByTestId('supply-input-savings').fill('.02');
  await expect(isolatedPage.getByRole('button', { name: 'Transaction overview' })).toBeVisible();
  await performAction(isolatedPage, 'Supply');
  await isolatedPage.getByRole('button', { name: 'Back to Savings' }).click();
});
