import { expect, test } from '../fixtures.ts';
import { approveOrPerformAction } from '../utils/approveOrPerformAction.ts';
import { distributeRewards } from '../utils/distributeRewards.ts';
import { parseNumberFromString } from '@/lib/helpers/string/parseNumberFromString.ts';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.ts';
import { setErc20Balance } from '../utils/setBalance.ts';
import { skyAddress, usdsAddress, usdsSkyRewardAddress } from '@jetstreamgg/sky-hooks';
import { TENDERLY_CHAIN_ID } from '@/data/wagmi/config/testTenderlyChain.ts';
import { NetworkName } from '../utils/constants.ts';
import { approveToken } from '../utils/approveToken.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await connectMockWalletAndAcceptTerms(page);
  await page.getByRole('tab', { name: 'Rewards' }).click();
  await page.getByText('With: USDS Get: SKY').first().click();
});

test('An approval error redirects to the error screen', async ({ page }) => {
  await page.getByTestId('supply-input-rewards').fill('100');
  await approveOrPerformAction(page, 'Supply', { reject: true });
  await expect(page.getByText('An error occurred during the supply flow.').last()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Retry' }).last()).toBeEnabled();
  await page.getByRole('button', { name: 'Retry' }).last().click();
  await expect(page.getByText('An error occurred during the supply flow.').last()).toBeVisible();
});

test('A supply error redirects to the error screen', async ({ page }) => {
  await approveToken(
    usdsAddress[TENDERLY_CHAIN_ID],
    usdsSkyRewardAddress[TENDERLY_CHAIN_ID],
    '90',
    NetworkName.mainnet
  );
  // Restart
  await page.reload();
  await connectMockWalletAndAcceptTerms(page);
  await page.getByRole('tab', { name: 'Rewards' }).click();
  await page.getByText('With: USDS Get: SKY').first().click();

  await page.getByTestId('supply-input-rewards').fill('1');
  await approveOrPerformAction(page, 'Supply', { reject: true });
  await expect(page.getByText('An error occurred during the supply flow.').last()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Retry' }).last()).toBeEnabled();
  await page.getByRole('button', { name: 'Retry' }).last().click();
  await expect(page.getByText('An error occurred during the supply flow.').last()).toBeVisible();
});

test('A withdraw error redirects to the error screen', async ({ page }) => {
  // Supply first so we can test withdraw
  await page.getByTestId('supply-input-rewards').fill('1');
  await approveOrPerformAction(page, 'Supply');
  await page.getByRole('button', { name: 'Back to Rewards' }).click();

  await page.getByRole('tab', { name: 'Withdraw' }).click();
  await page.getByTestId('withdraw-input-rewards').fill('1');
  await approveOrPerformAction(page, 'Withdraw', { reject: true });
  await expect(page.getByText('An error occurred while withdrawing USDS').last()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Retry' }).last()).toBeEnabled();
  await page.getByRole('button', { name: 'Retry' }).last().click();
  await expect(page.getByText('An error occurred while withdrawing USDS').last()).toBeVisible();
});

test('Details pane shows correct history data and layout subsections', async ({ page }) => {
  await page.reload();
  // Connect wallet elements should be visible before connecting
  await expect(
    page.getByTestId('widget-container').getByRole('button', { name: 'Connect Wallet' })
  ).toBeEnabled();
  await expect(page.getByTestId('supply-input-rewards-balance')).toHaveText('No wallet connected');
  await expect(
    page.getByTestId('connect-wallet-card').getByRole('heading', { name: 'About Sky Token Rewards' })
  ).toBeVisible();
  await expect(page.getByTestId('connect-wallet-card-button')).toBeEnabled();

  await connectMockWalletAndAcceptTerms(page);

  // Connect wallet elements should not be visible after connecting
  await expect(page.getByTestId('supply-input-rewards-balance')).not.toHaveText('No wallet connected');
  await expect(
    page.getByTestId('widget-container').getByRole('button', { name: 'Connect Wallet' })
  ).not.toBeVisible();
  await expect(
    page.getByTestId('connect-wallet-card').getByRole('heading', { name: 'About Sky Token Rewards' })
  ).not.toBeVisible();
  await expect(
    page.getByRole('cell', { name: 'Please connect your wallet to view your history' })
  ).not.toBeVisible();

  const suppliedAmountWidget = await page
    .getByTestId('widget-container')
    .getByText('Supplied balance', { exact: true })
    .locator('xpath=ancestor::div[1]')
    .getByText(/^\d.*USDS$/)
    .innerText();
  const tvlWidget = await page
    .getByTestId('widget-container')
    .getByText('Total Value Locked', { exact: true })
    .locator('xpath=ancestor::div[1]')
    .getByText(/^\d.*USDS$/)
    .first()
    .innerText();
  const suppliedAmountDetails = await page
    .getByRole('heading', { name: 'USDS supplied', exact: true })
    .locator('xpath=ancestor::div[1]')
    .getByText(/\d/)
    .innerText();
  const tvlDetails = await page
    .getByRole('heading', { name: 'TVL', exact: true })
    .locator('xpath=ancestor::div[1]')
    .getByText(/^\d.*USDS$/)
    .innerText();

  expect(suppliedAmountWidget).toEqual(suppliedAmountDetails);
  expect(tvlWidget).toEqual(tvlDetails);

  // close details pane
  await page.getByLabel('Toggle details').click();
  await expect(page.getByRole('button', { name: 'Your Rewards transaction history' })).not.toBeVisible();

  // open details pane
  await page.getByLabel('Toggle details').click();
  await expect(page.getByRole('button', { name: 'Your Rewards transaction history' })).toBeVisible();

  // Chart is present
  await expect(page.getByTestId('reward-contract-chart')).toBeVisible();

  // About section is present
  await expect(page.getByRole('button', { name: 'About' })).toBeVisible();

  // FAQ section is present
  await expect(page.getByRole('button', { name: 'FAQ' })).toBeVisible();
});

test('Rewards overview cards redirect to the correct reward contract', async ({ page }) => {
  await page.goto('/?widget=balances');
  await page.getByRole('tab', { name: 'Rewards' }).click();

  const firstWidgetRewards = page
    .getByTestId('widget-container')
    .getByText(/^With: \w+ Get: \w+$/)
    .first();

  const firstWidgetRewardsName = await firstWidgetRewards.innerText();
  await firstWidgetRewards.click();
  await expect(
    page.getByTestId('widget-container').getByText(`SupplyWithdraw${firstWidgetRewardsName}`)
  ).toBeVisible();
});

test('Claim rewards', async ({ page }) => {
  // Reset SKY balance to 0 so we can read the amount different at the end
  await setErc20Balance(skyAddress[TENDERLY_CHAIN_ID], '0');
  await page.reload();
  await connectMockWalletAndAcceptTerms(page);
  await page.getByRole('tab', { name: 'Rewards' }).click();
  await page.getByText('With: USDS Get: SKY').first().click();

  // First, supply some tokens
  await page.getByTestId('supply-input-rewards').click();
  await page.getByTestId('supply-input-rewards').fill('90');
  await approveOrPerformAction(page, 'Supply');
  await page.getByRole('button', { name: 'Back to Rewards' }).click();

  await page.getByRole('tab', { name: 'Balances' }).click();
  const skyLocator = page
    .getByTestId('widget-container')
    .getByText('SKY', { exact: true })
    .locator('xpath=ancestor::div[3]')
    .locator('div')
    .last()
    .locator('p')
    .first();
  await expect(skyLocator).toBeVisible();
  const skyInitialBalance = await skyLocator.innerText();

  await page.getByRole('tab', { name: 'Rewards' }).click();

  // Then, distribute rewards
  await distributeRewards();
  await page.reload();
  await connectMockWalletAndAcceptTerms(page);
  await page.getByRole('tab', { name: 'Rewards' }).click();
  await page.getByText('With: USDS Get: SKY').first().click();

  // Finally, claim rewards and check new SKY balance
  await page.getByTestId('widget-container').getByRole('button', { name: 'Claim' }).click();
  await expect(page.getByText('Success!', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Balances' }).click();
  await expect(page.getByTestId('widget-container').getByRole('heading', { name: 'Balances' })).toBeVisible();
  await expect(skyLocator).toBeVisible();
  await expect(skyLocator).not.toHaveText(skyInitialBalance);
  const skyNewBalance = await skyLocator.innerText();

  expect(parseNumberFromString(skyNewBalance)).toBeGreaterThan(parseNumberFromString(skyInitialBalance));
});
