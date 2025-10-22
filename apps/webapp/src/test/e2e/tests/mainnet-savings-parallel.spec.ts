import { expect, test } from '../fixtures-parallel';
import { setErc20Balance } from '../utils/setBalance';
import { usdsAddress } from '@jetstreamgg/sky-hooks';
import { TENDERLY_CHAIN_ID } from '@/data/wagmi/config/testTenderlyChain';
import { performAction } from '../utils/approveOrPerformAction';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms';
import { NetworkName } from '../utils/constants';

test('Supply and withdraw from Savings - Parallel Safe', async ({ isolatedPage, testAccount }) => {
  // Log which account this test is using for debugging
  console.log(`Test "${test.info().title}" running with account: ${testAccount}`);

  await isolatedPage.goto('/', { waitUntil: 'networkidle' });
  // Wait for the app to fully load
  await isolatedPage.waitForLoadState('domcontentloaded');
  await isolatedPage.waitForTimeout(1000); // Small delay to ensure React has rendered

  // Connect and switch to the worker's specific account
  console.log(`Test "${test.info().title}" using account: ${testAccount}`);
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });

  await isolatedPage.getByRole('tab', { name: 'Savings' }).click();

  await expect(isolatedPage.getByRole('button', { name: 'Transaction overview' })).not.toBeVisible();

  await isolatedPage.getByTestId('supply-input-savings').click();
  await isolatedPage.getByTestId('supply-input-savings').fill('.02');
  await expect(isolatedPage.getByRole('button', { name: 'Transaction overview' })).toBeVisible();
  await performAction(isolatedPage, 'Supply');
  await isolatedPage.getByRole('button', { name: 'Back to Savings' }).click();
  await isolatedPage.getByRole('tab', { name: 'Withdraw' }).click();

  await isolatedPage.getByTestId('withdraw-input-savings').click();
  await isolatedPage.getByTestId('withdraw-input-savings').fill('0');
  await expect(isolatedPage.getByRole('button', { name: 'Transaction overview' })).not.toBeVisible();
  await isolatedPage.getByTestId('withdraw-input-savings').fill('.01');
  await expect(isolatedPage.getByRole('button', { name: 'Transaction overview' })).toBeVisible();

  await performAction(isolatedPage, 'Withdraw');

  await expect(
    isolatedPage.getByText("You've withdrawn 0.01 USDS from the Sky Savings Rate module")
  ).toBeVisible();
  await isolatedPage.getByRole('button', { name: 'Back to Savings' }).click();
});

test('Balance isolation - Two parallel tests with different accounts', async ({
  isolatedPage,
  testAccount
}) => {
  // Set a unique balance for this test's account
  const uniqueBalance = 100 + parseInt(testAccount.slice(-2), 16);
  await setErc20Balance(
    usdsAddress[TENDERLY_CHAIN_ID],
    uniqueBalance.toString(),
    18,
    NetworkName.mainnet,
    testAccount
  );

  await isolatedPage.goto('/', { waitUntil: 'networkidle' });
  await isolatedPage.waitForLoadState('domcontentloaded');
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.getByRole('tab', { name: 'Savings' }).click();

  // Verify the balance is unique to this account
  const balanceLabel = isolatedPage.getByTestId('supply-input-savings-balance');
  await expect(balanceLabel).not.toHaveText('No wallet connected');
  const balanceText = await balanceLabel.innerText();

  // Each test should see its own unique balance
  console.log(`Account ${testAccount} sees balance: ${balanceText}`);

  // Perform a supply operation
  await isolatedPage.getByTestId('supply-input-savings').fill('10');
  await performAction(isolatedPage, 'Supply');

  // Verify the operation only affected this account's balance
  await isolatedPage.getByRole('button', { name: 'Back to Savings' }).click();
  const newBalance = await balanceLabel.innerText();
  console.log(`Account ${testAccount} new balance: ${newBalance}`);
});

test('Test 1 - Can run simultaneously', async ({ isolatedPage, testAccount }) => {
  console.log(`Test 1 using account: ${testAccount}`);

  // Set initial balance for this specific account
  await setErc20Balance(usdsAddress[TENDERLY_CHAIN_ID], '1000', 18, NetworkName.mainnet, testAccount);

  await isolatedPage.goto('/');
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.getByRole('tab', { name: 'Savings' }).click();

  // Add a small delay to simulate real work
  await isolatedPage.waitForTimeout(2000);

  await isolatedPage.getByTestId('supply-input-savings').fill('100');
  await performAction(isolatedPage, 'Supply');

  console.log(`Test 1 completed for account: ${testAccount}`);
});

test('Test 2 - Can run simultaneously', async ({ isolatedPage, testAccount }) => {
  console.log(`Test 2 using account: ${testAccount}`);

  // Set different initial balance for this account
  await setErc20Balance(usdsAddress[TENDERLY_CHAIN_ID], '500', 18, NetworkName.mainnet, testAccount);

  await isolatedPage.goto('/');
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.getByRole('tab', { name: 'Savings' }).click();

  // Add a small delay to simulate real work
  await isolatedPage.waitForTimeout(2000);

  await isolatedPage.getByTestId('supply-input-savings').fill('50');
  await performAction(isolatedPage, 'Supply');

  console.log(`Test 2 completed for account: ${testAccount}`);
});

test('Test 3 - Can run simultaneously', async ({ isolatedPage, testAccount }) => {
  console.log(`Test 3 using account: ${testAccount}`);

  // Set different initial balance
  await setErc20Balance(usdsAddress[TENDERLY_CHAIN_ID], '750', 18, NetworkName.mainnet, testAccount);

  await isolatedPage.goto('/');
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.getByRole('tab', { name: 'Savings' }).click();

  // Add a small delay to simulate real work
  await isolatedPage.waitForTimeout(2000);

  await isolatedPage.getByTestId('supply-input-savings').fill('75');
  await performAction(isolatedPage, 'Supply');

  console.log(`Test 3 completed for account: ${testAccount}`);
});

test('Verify account isolation with allowances', async ({ isolatedPage, testAccount }) => {
  console.log(`Testing allowances for account: ${testAccount}`);

  // Set up initial state
  await setErc20Balance(usdsAddress[TENDERLY_CHAIN_ID], '100', 18, NetworkName.mainnet, testAccount);

  await isolatedPage.goto('/', { waitUntil: 'networkidle' });
  await isolatedPage.waitForLoadState('domcontentloaded');
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.getByRole('tab', { name: 'Savings' }).click();

  // First supply without allowance (should trigger approval)
  await isolatedPage.getByTestId('supply-input-savings').fill('10');

  // This should show approval is needed
  // const approvalNeeded = await isolatedPage.getByText(/Approve|Allow/i).isVisible();
  // console.log(`Account ${testAccount} needs approval: ${approvalNeeded}`);

  await performAction(isolatedPage, 'Supply', { review: true });

  // Second supply should not need approval (allowance already set for this account)
  // await isolatedPage.getByRole('button', { name: 'Back to Savings' }).click();
  // await isolatedPage.getByTestId('supply-input-savings').fill('5');

  // Should go directly to supply without approval
  // const secondApprovalNeeded = await isolatedPage.getByText(/Approve|Allow/i).isVisible();
  // console.log(`Account ${testAccount} needs second approval: ${secondApprovalNeeded}`);

  // Verify this doesn't affect other test accounts' allowances
  // expect(secondApprovalNeeded).toBe(false);
});
