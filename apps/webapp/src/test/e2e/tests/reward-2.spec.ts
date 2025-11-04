import { expect, test } from '../fixtures-parallel';
import { performAction } from '../utils/approveOrPerformAction.ts';
import { distributeRewards } from '../utils/distributeRewards.ts';
import { parseNumberFromString } from '@/lib/helpers/string/parseNumberFromString.ts';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.ts';
import { usdsAddress, usdsSkyRewardAddress } from '@jetstreamgg/sky-hooks';
import { TENDERLY_CHAIN_ID } from '@/data/wagmi/config/testTenderlyChain.ts';
import { NetworkName } from '../utils/constants.ts';
import { approveToken } from '../utils/approveToken.ts';
import { initializeTestAccount } from '../utils/initializeTestAccount.ts';

test.beforeEach(async ({ isolatedPage }) => {
  await isolatedPage.goto('/');
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.waitForTimeout(1000);
  await isolatedPage.getByRole('tab', { name: 'Rewards' }).click();
  await isolatedPage.getByText('With: USDS Get: SKY').first().click();
});

test('An approval error redirects to the error screen', async ({ isolatedPage }) => {
  await isolatedPage.getByTestId('supply-input-rewards').fill('1');
  await performAction(isolatedPage, 'Supply', { reject: true });
  await expect(isolatedPage.getByText('An error occurred during the supply flow.').last()).toBeVisible();
  await expect(isolatedPage.getByRole('button', { name: 'Back' })).toBeEnabled();
  await expect(isolatedPage.getByRole('button', { name: 'Retry' }).last()).toBeEnabled();
  await isolatedPage.getByRole('button', { name: 'Retry' }).last().click();
  await expect(isolatedPage.getByText('An error occurred during the supply flow.').last()).toBeVisible();
});

test('A supply error redirects to the error screen', async ({ isolatedPage }) => {
  await approveToken(
    usdsAddress[TENDERLY_CHAIN_ID],
    usdsSkyRewardAddress[TENDERLY_CHAIN_ID],
    '90',
    NetworkName.mainnet
  );
  // Restart
  await isolatedPage.reload();
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.waitForTimeout(1000);
  await isolatedPage.getByRole('tab', { name: 'Rewards' }).click();
  await isolatedPage.getByText('With: USDS Get: SKY').first().click();

  await isolatedPage.getByTestId('supply-input-rewards').fill('1');
  await performAction(isolatedPage, 'Supply', { reject: true });
  await expect(isolatedPage.getByText('An error occurred during the supply flow.').last()).toBeVisible();
  await expect(isolatedPage.getByRole('button', { name: 'Back' })).toBeEnabled();
  await expect(isolatedPage.getByRole('button', { name: 'Retry' }).last()).toBeEnabled();
  await isolatedPage.getByRole('button', { name: 'Retry' }).last().click();
  await expect(isolatedPage.getByText('An error occurred during the supply flow.').last()).toBeVisible();
});

test.skip('A withdraw error redirects to the error screen', async ({ isolatedPage, testAccount }) => {
  console.log('🧪 Test starting with account:', testAccount);

  // Initialize the account to ensure it's properly set up on-chain
  await initializeTestAccount(testAccount);

  // Supply first so we can test withdraw
  await isolatedPage.getByTestId('supply-input-rewards').fill('1');
  await performAction(isolatedPage, 'Supply');
  await isolatedPage.waitForTimeout(10000);
  await isolatedPage.getByRole('button', { name: 'Back to Rewards' }).click();
  await isolatedPage.waitForTimeout(10000);

  await isolatedPage.reload();
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.waitForTimeout(1000);
  await isolatedPage.getByRole('tab', { name: 'Withdraw' }).click();
  await isolatedPage.getByTestId('withdraw-input-rewards').fill('1');
  await performAction(isolatedPage, 'Withdraw', { reject: true });
  await expect(isolatedPage.getByText('An error occurred while withdrawing USDS').last()).toBeVisible();
  await expect(isolatedPage.getByRole('button', { name: 'Back' })).toBeEnabled();
  await expect(isolatedPage.getByRole('button', { name: 'Retry' }).last()).toBeEnabled();
  await isolatedPage.getByRole('button', { name: 'Retry' }).last().click();
  await expect(isolatedPage.getByText('An error occurred while withdrawing USDS').last()).toBeVisible();
});

test('Details pane shows correct history data and layout subsections', async ({ isolatedPage }) => {
  await isolatedPage.reload();
  // Connect wallet elements should be visible before connecting
  await expect(
    isolatedPage.getByTestId('widget-container').getByRole('button', { name: 'Connect Wallet' })
  ).toBeEnabled();
  await expect(isolatedPage.getByTestId('supply-input-rewards-balance')).toHaveText('No wallet connected');
  await expect(
    isolatedPage.getByTestId('connect-wallet-card').getByRole('heading', { name: 'About Sky Token Rewards' })
  ).toBeVisible();
  await expect(isolatedPage.getByTestId('connect-wallet-card-button')).toBeEnabled();

  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.waitForTimeout(1000);

  // Connect wallet elements should not be visible after connecting
  await expect(isolatedPage.getByTestId('supply-input-rewards-balance')).not.toHaveText(
    'No wallet connected'
  );
  await expect(
    isolatedPage.getByTestId('widget-container').getByRole('button', { name: 'Connect Wallet' })
  ).not.toBeVisible();
  await expect(
    isolatedPage.getByTestId('connect-wallet-card').getByRole('heading', { name: 'About Sky Token Rewards' })
  ).not.toBeVisible();
  await expect(
    isolatedPage.getByRole('cell', { name: 'Please connect your wallet to view your history' })
  ).not.toBeVisible();

  const suppliedAmountWidget = await isolatedPage
    .getByTestId('widget-container')
    .getByText('Supplied balance', { exact: true })
    .locator('xpath=ancestor::div[1]')
    .getByText(/^\d.*USDS$/)
    .innerText();
  const tvlWidget = await isolatedPage
    .getByTestId('widget-container')
    .getByText('TVL', { exact: true })
    .locator('xpath=ancestor::div[1]')
    .getByText(/^\d.*USDS$/)
    .first()
    .innerText();
  const suppliedAmountDetails = await isolatedPage
    .getByRole('heading', { name: 'USDS supplied', exact: true })
    .locator('xpath=ancestor::div[1]')
    .getByText(/\d/)
    .innerText();
  const tvlDetails = await isolatedPage
    .getByRole('heading', { name: 'TVL', exact: true })
    .locator('xpath=ancestor::div[1]')
    .getByText(/^\d.*USDS$/)
    .innerText();

  expect(suppliedAmountWidget).toEqual(suppliedAmountDetails);
  expect(tvlWidget).toEqual(tvlDetails);

  // close details pane
  await isolatedPage.getByLabel('Toggle details').click();
  await expect(
    isolatedPage.getByRole('button', { name: 'Your Rewards transaction history' })
  ).not.toBeVisible();

  // open details pane
  await isolatedPage.getByLabel('Toggle details').click();
  await expect(isolatedPage.getByRole('button', { name: 'Your Rewards transaction history' })).toBeVisible();

  // Chart is present
  await expect(isolatedPage.getByTestId('reward-contract-chart')).toBeVisible();

  // About section is present
  await expect(isolatedPage.getByRole('button', { name: 'About' })).toBeVisible();

  // FAQ section is present
  await expect(isolatedPage.getByRole('button', { name: 'FAQ' })).toBeVisible();
});

test('Rewards overview cards redirect to the correct reward contract', async ({ isolatedPage }) => {
  await isolatedPage.goto('/?widget=balances');
  await isolatedPage.getByRole('tab', { name: 'Rewards' }).click();

  const firstWidgetRewards = isolatedPage
    .getByTestId('widget-container')
    .getByText(/^With: \w+ Get: \w+$/)
    .first();

  const firstWidgetRewardsName = await firstWidgetRewards.innerText();
  await firstWidgetRewards.click();
  await expect(
    isolatedPage.getByTestId('widget-container').getByText(`SupplyWithdraw${firstWidgetRewardsName}`)
  ).toBeVisible();
});

test.skip('Claim rewards', async ({ isolatedPage }) => {
  // Reset SKY balance to 0 so we can read the amount different at the end
  // await setErc20Balance(skyAddress[TENDERLY_CHAIN_ID], '0', 18, NetworkName.mainnet);
  // await isolatedPage.reload();
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.waitForTimeout(1000);
  await isolatedPage.getByRole('tab', { name: 'Rewards' }).click();
  await isolatedPage.getByText('With: USDS Get: SKY').first().click();

  // First, supply some tokens
  await isolatedPage.getByTestId('supply-input-rewards').click();
  await isolatedPage.getByTestId('supply-input-rewards').fill('90');
  await performAction(isolatedPage, 'Supply');
  await isolatedPage.getByRole('button', { name: 'Back to Rewards' }).click();

  await isolatedPage.getByRole('tab', { name: 'Balances' }).click();
  const skyLocator = isolatedPage
    .getByTestId('widget-container')
    .getByText('SKY', { exact: true })
    .locator('xpath=ancestor::div[3]')
    .locator('div')
    .last()
    .locator('p')
    .first();
  await expect(skyLocator).toBeVisible();
  const skyInitialBalance = await skyLocator.innerText();

  await isolatedPage.getByRole('tab', { name: 'Rewards' }).click();

  // Then, distribute rewards
  await distributeRewards();
  // await isolatedPage.reload();
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.waitForTimeout(1000);
  await isolatedPage.waitForLoadState('domcontentloaded');
  await isolatedPage.waitForTimeout(5000);
  await isolatedPage.getByRole('tab', { name: 'Rewards' }).click();
  await isolatedPage.getByText('With: USDS Get: SKY').first().click();
  await expect(
    isolatedPage.getByTestId('widget-container').getByRole('button', { name: 'Claim' })
  ).toBeVisible();

  // Finally, claim rewards and check new SKY balance
  await isolatedPage.getByTestId('widget-container').getByRole('button', { name: 'Claim' }).click();
  await expect(isolatedPage.getByText('Success!', { exact: true })).toBeVisible();
  await isolatedPage.getByRole('tab', { name: 'Balances' }).click();
  await expect(
    isolatedPage.getByTestId('widget-container').getByRole('heading', { name: 'Balances' })
  ).toBeVisible();
  await expect(skyLocator).toBeVisible();
  await expect(skyLocator).not.toHaveText(skyInitialBalance);
  const skyNewBalance = await skyLocator.innerText();

  expect(parseNumberFromString(skyNewBalance)).toBeGreaterThan(parseNumberFromString(skyInitialBalance));
});
