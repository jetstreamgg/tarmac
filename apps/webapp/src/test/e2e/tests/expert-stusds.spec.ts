import { mcdDaiAddress } from '@jetstreamgg/sky-hooks';
import { expect, test } from '../fixtures.ts';
import { approveOrPerformAction, performAction } from '../utils/approveOrPerformAction.ts';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.ts';
import { mineBlock } from '../utils/mineBlock.ts';
import { TENDERLY_CHAIN_ID } from '@/data/wagmi/config/testTenderlyChain.ts';
import { getTestWalletAddress } from '../utils/testWallets.ts';
import { NetworkName } from '../utils/constants.ts';
import { setErc20Balance } from '../utils/setBalance.ts';

const setTestBalance = async (tokenAddress: string, amount: string, decimals = 18) => {
  const workerIndex = Number(process.env.VITE_TEST_WORKER_INDEX ?? 1);
  const address = getTestWalletAddress(workerIndex);
  await setErc20Balance(tokenAddress, amount, decimals, NetworkName.mainnet, address);
};

test.describe('Expert Module - stUSDS', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await connectMockWalletAndAcceptTerms(page);
    // Navigate to Expert module
    await page.getByRole('tab', { name: 'Expert' }).click();
    // Navigate to stUSDS module
    await page.getByTestId('stusds-stats-card').click();
  });

  test('Navigate back to Expert menu', async ({ page }) => {
    // Click back button
    await page.getByRole('button', { name: 'Back to Expert' }).click();

    // Should be back at Expert menu
    await expect(page.getByRole('heading', { name: 'Expert Modules', exact: true })).toBeVisible();
    await expect(page.getByTestId('stusds-stats-card')).toBeVisible();
  });

  test('Supply USDS', async ({ page }) => {
    // Should be on Supply tab by default
    await expect(page.getByRole('tab', { name: 'Supply', selected: true })).toBeVisible();

    // Check transaction overview is not visible initially
    await expect(page.getByRole('button', { name: 'Transaction overview' })).not.toBeVisible();

    // Enter amount to supply
    await page.getByTestId('supply-input-stusds').click();
    await page.getByTestId('supply-input-stusds').fill('10');

    // Transaction overview should now be visible
    await expect(page.getByRole('button', { name: 'Transaction overview' })).toBeVisible();
    await expect(page.getByText('You will supply')).toBeVisible();
    await expect(page.getByText('10 USDS')).toBeVisible();

    // Perform the supply action (handles approval if needed)
    await approveOrPerformAction(page, 'Supply');

    // Check success message
    await expect(page.getByText("You've supplied 10 USDS to the stUSDS module")).toBeVisible();

    // Click back to stUSDS
    await page.getByRole('button', { name: 'Back to stUSDS' }).click();

    // Should still be in stUSDS module
    await expect(
      page.getByTestId('widget-container').getByRole('heading', { name: 'stUSDS Module' })
    ).toBeVisible();
  });

  test('Withdraw USDS from stUSDS module', async ({ page }) => {
    // Supply first
    await page.getByTestId('supply-input-stusds').click();
    await page.getByTestId('supply-input-stusds').fill('20');
    await approveOrPerformAction(page, 'Supply');
    await page.getByRole('button', { name: 'Back to stUSDS' }).click();

    // Mine a block to increase the USDS amount
    await mineBlock();

    // Switch to Withdraw tab
    await page.getByRole('tab', { name: 'Withdraw' }).click();

    // Enter withdrawal amount
    await page.getByTestId('withdraw-input-stusds').click();
    await page.getByTestId('withdraw-input-stusds').fill('5');

    // Check transaction overview
    await expect(page.getByRole('button', { name: 'Transaction overview' })).toBeVisible();
    await expect(page.getByText('You will withdraw')).toBeVisible();
    await expect(page.getByText('5 USDS')).toBeVisible();

    // Perform withdrawal
    await performAction(page, 'Withdraw');

    // Check success message
    await expect(page.getByText("You've withdrawn 5 USDS from the stUSDS module.")).toBeVisible();

    // Click back to stUSDS
    await page.getByRole('button', { name: 'Back to stUSDS' }).click();
  });

  test('Use max button for supply', async ({ page }) => {
    // Click max button
    await page.getByTestId('supply-input-stusds-max').click();

    // Check that input is filled with balance
    const inputValue = await page.getByTestId('supply-input-stusds').inputValue();
    expect(parseFloat(inputValue)).toBe(100);

    // Transaction overview should be visible
    await expect(page.getByRole('button', { name: 'Transaction overview' })).toBeVisible();
  });

  test('Use max button for withdrawal', async ({ page }) => {
    await page.getByTestId('supply-input-stusds').click();
    await page.getByTestId('supply-input-stusds').fill('30');
    await approveOrPerformAction(page, 'Supply');
    await page.getByRole('button', { name: 'Back to stUSDS' }).click();

    // Mine a block to increase the USDS amount
    await mineBlock();

    // Switch to Withdraw tab
    await page.getByRole('tab', { name: 'Withdraw' }).click();

    // Click max button
    await page.getByTestId('withdraw-input-stusds-max').click();

    // Check that input is filled with correct amount
    const inputValue = await page.getByTestId('withdraw-input-stusds').inputValue();
    expect(parseFloat(inputValue)).toBeGreaterThanOrEqual(30);
  });

  test('Supply with insufficient USDS balance shows error', async ({ page }) => {
    // Try to supply more than balance
    await page.getByTestId('supply-input-stusds').click();
    await page.getByTestId('supply-input-stusds').fill('105');

    // Should show insufficient funds error
    await expect(page.getByText('Insufficient funds')).toBeVisible();

    // Review button should be disabled
    const reviewButton = page.getByTestId('widget-button');
    await expect(reviewButton).toHaveText('Review');
    await expect(reviewButton).toBeDisabled();
  });

  test('Withdraw with insufficient stUSDS balance shows error', async ({ page }) => {
    // Switch to Withdraw tab
    await page.getByRole('tab', { name: 'Withdraw' }).click();

    // Try to withdraw with no supplied balance
    await page.getByTestId('withdraw-input-stusds').click();
    await page.getByTestId('withdraw-input-stusds').fill('100');

    // Should show insufficient funds error
    await expect(page.getByText('Insufficient funds')).toBeVisible();

    // Review button should be disabled
    const reviewButton = page.getByTestId('widget-button');
    await expect(reviewButton).toHaveText('Review');
    await expect(reviewButton).toBeDisabled();
  });

  test('Transaction overview updates when amount changes', async ({ page }) => {
    // Enter first amount
    await page.getByTestId('supply-input-stusds').click();
    await page.getByTestId('supply-input-stusds').fill('10');
    await expect(page.getByText('10 USDS')).toBeVisible();

    // Change amount
    await page.getByTestId('supply-input-stusds').fill('25');
    await expect(page.getByText('25 USDS')).toBeVisible();

    // Clear amount - transaction overview should disappear
    await page.getByTestId('supply-input-stusds').clear();
    await expect(page.getByRole('button', { name: 'Transaction overview' })).not.toBeVisible();
  });

  test('Upgrade and access rewards', async ({ page }) => {
    await setTestBalance(mcdDaiAddress[TENDERLY_CHAIN_ID], '10');
    await page.getByRole('button', { name: 'Upgrade and access rewards' }).click();

    // click on Upgrade and access rewards button with natural language
    await page.getByTestId('upgrade-input-origin').click();
    await page.getByTestId('upgrade-input-origin').fill('4');
    await expect(page.getByRole('button', { name: 'Transaction overview' })).toBeVisible();
    await approveOrPerformAction(page, 'Upgrade');

    // click on the expert button
    await page.getByRole('button', { name: 'Go to Expert' }).first().click();

    // supply
    await page.getByRole('tab', { name: 'Supply' }).click();
    await page.getByTestId('supply-input-stusds').click();
    await page.getByTestId('supply-input-stusds').fill('10');
    await approveOrPerformAction(page, 'Supply');

    // click on the expert button
    await page.getByRole('button', { name: 'Back to Expert' }).click();
    await expect(page.getByTestId('stusds-stats-card')).toBeVisible();
  });
});
