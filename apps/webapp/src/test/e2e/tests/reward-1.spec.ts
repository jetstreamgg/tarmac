import { expect, test } from '../fixtures.ts';
import { approveOrPerformAction } from '../utils/approveOrPerformAction.ts';
import { withdrawAllAndReset } from '../utils/rewards.ts';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await connectMockWalletAndAcceptTerms(page);
  await page.getByRole('tab', { name: 'Rewards' }).click();
  await page.getByText('With: USDS Get: SKY').first().click();
});

test('Supply and withdraw with insufficient balance', async ({ page }) => {
  // Supply an amount greater than the balance
  await page.getByTestId('supply-input-rewards').fill('101');
  await expect(page.getByText('Insufficient funds')).toBeVisible();

  // Withdraw an amount greater than the supplied balance
  await page.getByRole('tab', { name: 'Withdraw' }).click();
  await page.getByTestId('withdraw-input-rewards').fill('1');
  await expect(page.getByText('Insufficient funds')).toBeVisible();
});

test('Balances change after successfully supplying and withdrawing', async ({ page }) => {
  await expect(page.getByTestId('supply-input-rewards-balance')).toHaveText('100 USDS');
  const rewardsCardSuppliedBalance = page
    .getByTestId('widget-container')
    .getByText('Supplied balance', { exact: true })
    .locator('xpath=ancestor::div[1]')
    .getByText(/^\d.*USDS$/);
  await expect(rewardsCardSuppliedBalance).toHaveText('0 USDS');

  await page.getByTestId('supply-input-rewards').fill('2');

  await expect(page.getByTestId('widget-button')).toBeEnabled();
  await approveOrPerformAction(page, 'Supply');
  await page.getByRole('button', { name: 'Back to Rewards' }).click();
  await expect(page.getByTestId('supply-input-rewards-balance')).toHaveText('98 USDS');
  await expect(rewardsCardSuppliedBalance).toHaveText('2 USDS');

  await page.getByRole('tab', { name: 'Withdraw' }).click();
  await expect(page.getByTestId('withdraw-input-rewards-balance')).toHaveText('2 USDS');
  await page.getByTestId('withdraw-input-rewards').fill('2');

  await approveOrPerformAction(page, 'Withdraw');
  await page.getByRole('button', { name: 'Back to Rewards' }).click();
  await expect(page.getByTestId('withdraw-input-rewards-balance')).toHaveText('0 USDS');
  await expect(rewardsCardSuppliedBalance).toHaveText('0 USDS');

  await page.getByRole('tab', { name: 'Supply', exact: true }).click();
  await expect(page.getByTestId('supply-input-rewards-balance')).toHaveText('100 USDS');
});

test('Insufficient token allowance triggers approval flow', async ({ page }) => {
  await page.getByTestId('supply-input-rewards').fill('90');
  // Not enough allowance, so approve button should be visible
  await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible();
  await page.getByRole('button', { name: 'Approve' }).click();
  await page.getByRole('button', { name: 'Back' }).click();

  // Restart
  await page.reload();
  await connectMockWalletAndAcceptTerms(page);
  await page.getByRole('tab', { name: 'Rewards' }).click();
  await page.getByText('With: USDS Get: SKY').first().click();

  await page.getByTestId('supply-input-rewards').fill('90');
  // It should not ask for approval
  await expect(page.getByRole('button', { name: 'Supply' }).first()).toBeVisible();
  // Supply and reset approval
  await page.getByTestId('widget-container').getByRole('button', { name: 'Supply' }).first().click(); // The first supply button is the main button
  await page.getByRole('button', { name: 'Back to Rewards' }).click();

  // Restart
  await page.reload();
  await connectMockWalletAndAcceptTerms(page);
  await page.getByRole('tab', { name: 'Rewards' }).click();
  await page.getByText('With: USDS Get: SKY').first().click();

  await page.getByTestId('supply-input-rewards').fill('10');
  // Allowance should be reset, so approve button should be visible again
  await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible();
  // Withdraw all to reset balances
  await withdrawAllAndReset(page);
});

test('if not connected it should show a connect button', async ({ page }) => {
  await page.reload();

  // Connect button and copy should be visible
  const widgetConnectButton = page
    .getByTestId('widget-container')
    .getByRole('button', { name: 'Connect Wallet' });
  await expect(widgetConnectButton).toBeEnabled();
  await expect(page.getByRole('heading', { name: 'Connect to explore Sky' })).toBeVisible();

  // After connecting, the button should disappear
  await connectMockWalletAndAcceptTerms(page);
  await expect(widgetConnectButton).not.toBeVisible();
});

test('percentage buttons update the token input', async ({ page }) => {
  await page.getByRole('button', { name: '25%' }).click();
  expect(await page.getByTestId('supply-input-rewards').inputValue()).toBe('25');
  await page.getByRole('button', { name: '100%' }).click();
  expect(await page.getByTestId('supply-input-rewards').inputValue()).toBe('100');
  await page.getByRole('button', { name: '50%' }).click();
  expect(await page.getByTestId('supply-input-rewards').inputValue()).toBe('50');
  // Supply so we can test the withdraw tab
  await approveOrPerformAction(page, 'Supply');
  await page.getByRole('button', { name: 'Back to Rewards' }).click();

  await page.getByRole('tab', { name: 'Withdraw' }).click();
  await page.getByRole('button', { name: '25%' }).click();
  expect(await page.getByTestId('withdraw-input-rewards').inputValue()).toBe('12.5');
  await page.getByRole('button', { name: '50%' }).click();
  expect(await page.getByTestId('withdraw-input-rewards').inputValue()).toBe('25');
  await page.getByRole('button', { name: '100%' }).click();
  expect(await page.getByTestId('withdraw-input-rewards').inputValue()).toBe('50');

  // Withdraw all to reset balances
  await withdrawAllAndReset(page);
});

test('Enter amount button only gets enabled with a valid amount', async ({ page }) => {
  const widgetButton = page.getByTestId('widget-container').getByRole('button').last();

  // Supply
  await expect(widgetButton).toBeDisabled();
  await page.getByTestId('supply-input-rewards').fill('0');
  await expect(widgetButton).toBeDisabled();
  await page.getByTestId('supply-input-rewards').fill('1');
  await expect(widgetButton).toBeEnabled();

  // Withdraw
  await page.getByRole('tab', { name: 'Withdraw' }).click();
  await expect(widgetButton).toBeDisabled();
  await page.getByTestId('withdraw-input-rewards').fill('0');
  await expect(widgetButton).toBeDisabled();
});
