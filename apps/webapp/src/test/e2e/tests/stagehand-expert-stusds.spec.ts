import { TENDERLY_CHAIN_ID } from '@/data/wagmi/config/testTenderlyChain';
import { expect, test } from '../stagehand-fixtures';
import { approveOrPerformAction, performAction } from '../utils/approveOrPerformAction';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms';
import { NetworkName } from '../utils/constants';
import { mineBlock } from '../utils/mineBlock';
import { setErc20Balance } from '../utils/setBalance';
import { getTestWalletAddress } from '../utils/testWallets';
import { mcdDaiAddress } from '@jetstreamgg/sky-hooks';
import { z } from 'zod';

const setTestBalance = async (tokenAddress: string, amount: string, decimals = 18) => {
  const workerIndex = Number(process.env.VITE_TEST_WORKER_INDEX ?? 1);
  const address = getTestWalletAddress(workerIndex);
  await setErc20Balance(tokenAddress, amount, decimals, NetworkName.mainnet, address);
};

test.describe('Expert Module - stUSDS (Stagehand)', () => {
  test.beforeEach(async ({ stagehandPage }) => {
    await stagehandPage.goto('http://localhost:3000/');
    await connectMockWalletAndAcceptTerms(stagehandPage);
    // Navigate to Expert module
    await stagehandPage.getByRole('tab', { name: 'Expert' }).click();
    // Navigate to stUSDS module
    await stagehandPage.getByTestId('stusds-stats-card').click();
  });

  test('Navigate back to Expert menu', async ({ stagehandPage }) => {
    // Click back button
    await stagehandPage.getByRole('button', { name: 'Back to Expert' }).click();

    // Should be back at Expert menu
    await expect(stagehandPage.getByRole('heading', { name: 'Expert Modules', exact: true })).toBeVisible();
    await expect(stagehandPage.getByTestId('stusds-stats-card')).toBeVisible();
  });

  test('Supply USDS', async ({ stagehandPage }) => {
    // Should be on Supply tab by default
    await expect(stagehandPage.getByRole('tab', { name: 'Supply', selected: true })).toBeVisible();

    // Check transaction overview is not visible initially
    await expect(stagehandPage.getByRole('button', { name: 'Transaction overview' })).not.toBeVisible();

    // Enter amount to supply
    await stagehandPage.getByTestId('supply-input-stusds').click();
    await stagehandPage.getByTestId('supply-input-stusds').fill('10');

    // Transaction overview should now be visible
    await expect(stagehandPage.getByRole('button', { name: 'Transaction overview' })).toBeVisible();
    await expect(stagehandPage.getByText('You will supply')).toBeVisible();
    await expect(stagehandPage.getByText('10 USDS')).toBeVisible();

    // Perform the supply action (handles approval if needed)
    await approveOrPerformAction(stagehandPage, 'Supply', { reject: true });

    // Check success message
    await expect(stagehandPage.getByText("You've supplied 10 USDS to the stUSDS module")).toBeVisible();

    // Click back to stUSDS
    await stagehandPage.getByRole('button', { name: 'Back to stUSDS' }).click();

    // Should still be in stUSDS module
    await expect(
      stagehandPage.getByTestId('widget-container').getByRole('heading', { name: 'stUSDS Module' })
    ).toBeVisible();
  });

  test.skip('Withdraw USDS from stUSDS module', async ({ stagehandPage }) => {
    // Supply first
    await stagehandPage.getByTestId('supply-input-stusds').click();
    await stagehandPage.getByTestId('supply-input-stusds').fill('20');
    await approveOrPerformAction(stagehandPage, 'Supply');
    await stagehandPage.getByRole('button', { name: 'Back to stUSDS' }).click();

    // Mine a block to increase the USDS amount
    await mineBlock();

    // Switch to Withdraw tab
    await stagehandPage.getByRole('tab', { name: 'Withdraw' }).click();

    // Enter withdrawal amount
    await stagehandPage.getByTestId('withdraw-input-stusds').click();
    await stagehandPage.getByTestId('withdraw-input-stusds').fill('5');

    // Check transaction overview
    await expect(stagehandPage.getByRole('button', { name: 'Transaction overview' })).toBeVisible();
    await expect(stagehandPage.getByText('You will withdraw')).toBeVisible();
    await expect(stagehandPage.getByText('5 USDS')).toBeVisible();

    // Perform withdrawal
    await performAction(stagehandPage, 'Withdraw');

    // Check success message
    await expect(stagehandPage.getByText("You've withdrawn 5 USDS from the stUSDS module.")).toBeVisible();

    // Click back to stUSDS
    await stagehandPage.getByRole('button', { name: 'Back to stUSDS' }).click();
  });

  test('Use max button for supply', async ({ stagehandPage }) => {
    // Click max button
    await stagehandPage.getByTestId('supply-input-stusds-max').click();

    // Check that input is filled with balance
    const inputValue = await stagehandPage.getByTestId('supply-input-stusds').inputValue();
    expect(parseFloat(inputValue)).toBe(100);

    // Transaction overview should be visible
    await expect(stagehandPage.getByRole('button', { name: 'Transaction overview' })).toBeVisible();
  });

  test.skip('Use max button for withdrawal', async ({ stagehandPage }) => {
    await stagehandPage.getByTestId('supply-input-stusds').click();
    await stagehandPage.getByTestId('supply-input-stusds').fill('30');
    await approveOrPerformAction(stagehandPage, 'Supply');
    await stagehandPage.getByRole('button', { name: 'Back to stUSDS' }).click();

    // Mine a block to increase the USDS amount
    await mineBlock();

    // Switch to Withdraw tab
    await stagehandPage.getByRole('tab', { name: 'Withdraw' }).click();

    // Click max button
    await stagehandPage.getByTestId('withdraw-input-stusds-max').click();

    // Check that input is filled with correct amount
    const inputValue = await stagehandPage.getByTestId('withdraw-input-stusds').inputValue();
    expect(parseFloat(inputValue)).toBeGreaterThanOrEqual(30);
  });

  test('Supply with insufficient USDS balance shows error', async ({ stagehandPage }) => {
    // Try to supply more than balance
    await stagehandPage.getByTestId('supply-input-stusds').click();
    await stagehandPage.getByTestId('supply-input-stusds').fill('105');

    // Should show insufficient funds error
    await expect(stagehandPage.getByText('Insufficient funds')).toBeVisible();

    // Review button should be disabled
    const reviewButton = stagehandPage.getByTestId('widget-button');
    await expect(reviewButton).toHaveText('Review');
    await expect(reviewButton).toBeDisabled();
  });

  test.skip('Withdraw with insufficient stUSDS balance shows error', async ({ stagehandPage }) => {
    // Switch to Withdraw tab
    await stagehandPage.getByRole('tab', { name: 'Withdraw' }).click();

    // Try to withdraw with no supplied balance
    await stagehandPage.getByTestId('withdraw-input-stusds').click();
    await stagehandPage.getByTestId('withdraw-input-stusds').fill('100');

    // Should show insufficient funds error
    await expect(stagehandPage.getByText('Insufficient funds')).toBeVisible();

    // Review button should be disabled
    const reviewButton = stagehandPage.getByTestId('widget-button');
    await expect(reviewButton).toHaveText('Review');
    await expect(reviewButton).toBeDisabled();
  });

  test('Transaction overview updates when amount changes', async ({ stagehandPage }) => {
    // Enter first amount
    await stagehandPage.getByTestId('supply-input-stusds').click();
    await stagehandPage.getByTestId('supply-input-stusds').fill('10');
    await expect(stagehandPage.getByText('10 USDS')).toBeVisible();

    // Change amount
    await stagehandPage.getByTestId('supply-input-stusds').fill('25');
    await expect(stagehandPage.getByText('25 USDS')).toBeVisible();

    // Clear amount - transaction overview should disappear
    await stagehandPage.getByTestId('supply-input-stusds').clear();
    await expect(stagehandPage.getByRole('button', { name: 'Transaction overview' })).not.toBeVisible();
  });

  test('Upgrade and access rewards', async ({ stagehandPage }) => {
    await setTestBalance(mcdDaiAddress[TENDERLY_CHAIN_ID], '10');
    // click on Upgrade and access rewards button with natural language
    await stagehandPage.getByRole('button', { name: 'Upgrade and access rewards' }).click();

    // click on Upgrade and access rewards button with natural language
    await stagehandPage.getByTestId('upgrade-input-origin').click();
    await stagehandPage.getByTestId('upgrade-input-origin').fill('4');
    await expect(stagehandPage.getByRole('button', { name: 'Transaction overview' })).toBeVisible();
    await approveOrPerformAction(stagehandPage, 'Upgrade');

    // click on the expert button
    await stagehandPage.getByRole('button', { name: 'Go to Expert' }).first().click();

    // now do stusds supply
    await stagehandPage.getByRole('tab', { name: 'Supply' }).click();

    // Extract USDS supplied balance using Zod schema for structured data
    const beforeBalanceData = await stagehandPage.extract!({
      instruction: 'What is the current supplied USDS balance? Extract the numeric amount only.',
      schema: z.object({
        suppliedAmount: z.number()
      })
    });
    const beforeBalance = beforeBalanceData.suppliedAmount;
    console.log('Before balance:', beforeBalance);

    // supply 10 more USDS
    await stagehandPage.getByTestId('supply-input-stusds').click();
    await stagehandPage.getByTestId('supply-input-stusds').fill('10');
    await approveOrPerformAction(stagehandPage, 'Supply');

    // Navigate back to see the updated balance
    // await stagehandPage.getByRole('button', { name: 'Back to stUSDS' }).click();

    // Extract new balance after supply
    const afterBalanceData = await stagehandPage.extract!({
      instruction: 'What is the current supplied USDS balance? Extract the numeric amount only.',
      schema: z.object({
        suppliedAmount: z.number()
      })
    });
    const afterBalance = afterBalanceData.suppliedAmount;
    console.log('After balance:', afterBalance);

    // Verify the balance increased by approximately 10 (allowing for small rounding)
    expect(afterBalance).toBeGreaterThanOrEqual(beforeBalance + 9.9);
    expect(afterBalance).toBeLessThanOrEqual(beforeBalance + 10.1);
  });
});
