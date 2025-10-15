import { TENDERLY_CHAIN_ID } from '@/data/wagmi/config/testTenderlyChain.ts';
import { expect, test } from '../fixtures.ts';
import { approveOrPerformAction, performAction } from '../utils/approveOrPerformAction.ts';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.ts';
import { mineBlock } from '../utils/mineBlock.ts';
import { NetworkName } from '../utils/constants.ts';
import { getTestWalletAddress } from '../utils/testWallets.ts';
import { setErc20Balance } from '../utils/setBalance.ts';
import { mcdDaiAddress } from '@jetstreamgg/sky-hooks';

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
    await expect(page.getByRole('heading', { name: 'Expert', exact: true })).toBeVisible();
    await expect(page.getByTestId('stusds-stats-card')).toBeVisible();

    // Should display Message
    await expect(page.getByTestId('expert-risk-disclaimer')).toBeVisible();
    await expect(page.getByTestId('expert-risk-disclaimer')).toContainText(
      'Expert modules are intended for experienced users and may function differently than modules to which ordinary users are accustomed. Please be sure you understand the unique features and the associated risks of any Expert Module before proceeding. Be sure to review the FAQs and'
    );

    // Verify User Risks hyperlink is present
    const userRisksLink = page
      .getByTestId('expert-risk-disclaimer')
      .getByRole('link', { name: 'User Risks' });
    await expect(userRisksLink).toBeVisible();
    await expect(userRisksLink).toHaveAttribute('href', 'https://docs.sky.money/user-risks');
    await expect(userRisksLink).toHaveAttribute('target', '_blank');
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

    // Check the disclaimer checkbox
    await page.getByRole('checkbox').click();

    // Perform the supply action (handles approval if needed)
    await approveOrPerformAction(page, 'Supply');

    // Check success message
    await expect(page.getByText("You've supplied 10 USDS to the stUSDS module")).toBeVisible();

    // Click back to stUSDS
    await page.getByRole('button', { name: 'Back to stUSDS' }).click();

    // Should still be in stUSDS module
    await expect(
      page.getByTestId('widget-container').getByRole('heading', { name: 'stUSDS', exact: true })
    ).toBeVisible();

    // go to balance page
    await page.getByRole('tab', { name: 'Balance' }).click();
    await expect(page.getByText('USDS supplied to stUSDS')).toBeVisible();

    // Click using the href that contains the stusds expert module path
    await page.locator('a[href*="expert_module=stusds"]').first().click();

    // should land on the stusds balance page
    expect(page.getByText('stUSDS')).toBeTruthy();
  });

  test('Withdraw USDS from stUSDS module', async ({ page }) => {
    // Supply first
    await page.getByTestId('supply-input-stusds').click();
    await page.getByTestId('supply-input-stusds').fill('20');
    await page.getByRole('checkbox').click();
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

    // Disclaimer checkbox should be visible
    await expect(page.getByRole('checkbox')).toBeVisible();
  });

  test('Use max button for withdrawal', async ({ page }) => {
    await page.getByTestId('supply-input-stusds').click();
    await page.getByTestId('supply-input-stusds').fill('30');
    await page.getByRole('checkbox').click();
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

  test('Upgrade and access Expert rewards', async ({ page }) => {
    await setTestBalance(mcdDaiAddress[TENDERLY_CHAIN_ID], '10');
    // Navigate to Expert menu
    await page.getByRole('tab', { name: 'Expert' }).click();

    // Click on Upgrade button
    await page.getByText('Upgrade and access Expert rewards').first().click();

    await page.getByTestId('upgrade-input-origin').click();
    await page.getByTestId('upgrade-input-origin').fill('1');
    await expect(page.getByRole('button', { name: 'Transaction overview' })).toBeVisible();
    await approveOrPerformAction(page, 'Upgrade');

    // Check that Rewards modal is visible
    await expect(page.getByRole('button', { name: 'Go to Expert' })).toBeVisible();

    // Click on Close button
    await page.getByRole('button', { name: 'Go to Expert' }).click();

    await expect(page.getByRole('button', { name: 'Transaction overview' })).toBeVisible();
    await expect(page.getByText('You will supply')).toBeVisible();

    // Check the disclaimer checkbox
    await page.getByRole('checkbox').click();

    // Perform the supply action (handles approval if needed)
    await approveOrPerformAction(page, 'Supply');

    // Check success message
    await expect(page.getByText("You've supplied 1 USDS to the stUSDS module")).toBeVisible();
  });

  test('Review button disabled when disclaimer not checked', async ({ page }) => {
    // Enter amount to supply
    await page.getByTestId('supply-input-stusds').click();
    await page.getByTestId('supply-input-stusds').fill('10');

    // Transaction overview should be visible
    await expect(page.getByRole('button', { name: 'Transaction overview' })).toBeVisible();

    // Disclaimer checkbox should be visible and unchecked
    const checkbox = page.getByRole('checkbox');
    await expect(checkbox).toBeVisible();
    await expect(checkbox).not.toBeChecked();

    // Review button should be disabled
    const reviewButton = page.getByTestId('widget-button');
    await expect(reviewButton).toHaveText('Review');
    await expect(reviewButton).toBeDisabled();

    // Check the disclaimer checkbox
    await checkbox.click();
    await expect(checkbox).toBeChecked();

    // Review button should now be enabled
    await expect(reviewButton).toBeEnabled();
  });

  test('Expert risk modal dismissal persists after reload and navigation', async ({ page }) => {
    // Navigate away from the module
    await page.getByRole('button', { name: 'Back to Expert' }).click();
    await expect(page.getByRole('heading', { name: 'Expert', exact: true })).toBeVisible();

    // Verify expert risk modal is initially visible
    await expect(page.getByTestId('expert-risk-disclaimer')).toBeVisible();

    // Wait for the dismiss button to be stable and click it
    const dismissButton = page.getByTestId('expert-risk-dismiss');
    await expect(dismissButton).toBeVisible();
    await dismissButton.click({ force: true });

    // Verify modal is dismissed
    await expect(page.getByTestId('expert-risk-disclaimer')).not.toBeVisible();

    // Reload the browser
    await page.reload();
    await connectMockWalletAndAcceptTerms(page);

    // Navigate back to Expert module
    await page.getByRole('tab', { name: 'Expert' }).click();

    // Navigate back to stUSDS module
    await page.getByTestId('stusds-stats-card').click();

    // Verify the risk modal is still dismissed (not visible)
    await expect(page.getByTestId('expert-risk-disclaimer')).not.toBeVisible();
  });
});
