import { expect, test } from '../fixtures.ts';
import { setErc20Balance } from '../utils/setBalance.ts';
import { mcdDaiAddress, usdsAddress } from '@jetstreamgg/hooks';
import { TENDERLY_CHAIN_ID } from '@/data/wagmi/config/testTenderlyChain.ts';
import { interceptAndRejectTransactions } from '../utils/rejectTransaction.ts';
import { approveOrPerformAction } from '../utils/approveOrPerformAction.ts';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.ts';
import { getTestWalletAddress } from '../utils/testWallets.ts';
import { NetworkName } from '../utils/constants.ts';

const setTestBalance = async (tokenAddress: string, amount: string, decimals = 18) => {
  const workerIndex = Number(process.env.VITE_TEST_WORKER_INDEX ?? 1);
  const address = getTestWalletAddress(workerIndex);
  await setErc20Balance(tokenAddress, amount, decimals, NetworkName.mainnet, address);
};

test('Upgrade DAI and revert USDS', async ({ page }) => {
  await setTestBalance(mcdDaiAddress[TENDERLY_CHAIN_ID], '10');
  await page.goto('/');
  await connectMockWalletAndAcceptTerms(page);
  await page.getByRole('tab', { name: 'Upgrade' }).click();

  await expect(page.getByRole('button', { name: 'Transaction overview' })).not.toBeVisible();

  await page.getByTestId('upgrade-input-origin').click();
  await page.getByTestId('upgrade-input-origin').fill('4');
  await expect(page.getByRole('button', { name: 'Transaction overview' })).toBeVisible();
  await approveOrPerformAction(page, 'Upgrade');
  await page.getByRole('button', { name: 'Back to Upgrade' }).click();
  await page.getByRole('tab', { name: 'Revert' }).click();
  await expect(page.getByRole('button', { name: 'Transaction overview' })).not.toBeVisible();
  await page.getByTestId('upgrade-input-origin').click();
  await page.getByTestId('upgrade-input-origin').fill('4');
  await expect(page.getByRole('button', { name: 'Transaction overview' })).toBeVisible();
  await approveOrPerformAction(page, 'Revert');
  await page.getByRole('button', { name: 'Back to Upgrade' }).click();
});

test('Upgrade MKR but revert SKY isnt allowed', async ({ page }) => {
  await setTestBalance(mcdDaiAddress[TENDERLY_CHAIN_ID], '10');
  await page.goto('/');
  await connectMockWalletAndAcceptTerms(page);
  await page.getByRole('tab', { name: 'Upgrade' }).click();
  await page.getByTestId('undefined-menu-button').click();
  await page.getByRole('button', { name: 'MKR MKR MKR' }).click();

  await expect(page.getByRole('button', { name: 'Transaction overview' })).not.toBeVisible();

  await page.getByTestId('upgrade-input-origin').click();
  await page.getByTestId('upgrade-input-origin').fill('4');
  await expect(page.getByRole('button', { name: 'Transaction overview' })).not.toBeVisible();
  await approveOrPerformAction(page, 'Upgrade');
  await page.getByRole('button', { name: 'Back to Upgrade' }).click();
  await page.getByRole('tab', { name: 'Revert' }).click();
  // Sky can't be reverted
  await expect(page.getByRole('button', { name: 'SKY SKY SKY' })).not.toBeVisible();
});

test('Upgrade and revert with insufficient balance', async ({ page }) => {
  await page.goto('/');
  await connectMockWalletAndAcceptTerms(page);
  await page.getByRole('tab', { name: 'Upgrade' }).click();

  await expect(page.getByTestId('upgrade-input-origin-balance')).not.toHaveText('No wallet connected');
  const daiBalanceLabel = page.getByTestId('upgrade-input-origin-balance');
  const daiBalanceText = ((await daiBalanceLabel.innerText()) as string).split(' ')[0].trim();

  await page.getByTestId('upgrade-input-origin').click();
  // Upgrade an amount greater than the balance
  await page.getByTestId('upgrade-input-origin').fill(`${daiBalanceText}0`);
  await expect(page.getByText('Insufficient funds')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve' })).toBeDisabled();

  await page.getByRole('tab', { name: 'Revert' }).click();
  await expect(page.getByTestId('upgrade-input-origin-balance')).not.toHaveText('No wallet connected');
  const uSDSBalanceLabel = page.getByTestId('upgrade-input-origin-balance');
  const uSDSBalanceText = ((await uSDSBalanceLabel.innerText()) as string).split(' ')[0].trim();

  await page.getByTestId('upgrade-input-origin').click();
  // Upgrade an amount greater than the balance
  await page.getByTestId('upgrade-input-origin').fill(`${uSDSBalanceText}0`);
  await expect(page.getByText('Insufficient funds')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve' })).toBeDisabled();
});

test('Balances change after successfully upgrading and reverting', async ({ page }) => {
  await setTestBalance(mcdDaiAddress[TENDERLY_CHAIN_ID], '10');
  await setTestBalance(usdsAddress[TENDERLY_CHAIN_ID], '10');

  await page.goto('/');
  await connectMockWalletAndAcceptTerms(page);
  await page.getByRole('tab', { name: 'Upgrade' }).click();

  await expect(page.getByTestId('upgrade-input-origin-balance')).not.toHaveText('No wallet connected');
  expect(await page.getByTestId('upgrade-input-origin-balance').innerText()).toBe('10 DAI');

  await page.getByRole('tab', { name: 'Revert' }).click();
  await expect(page.getByTestId('upgrade-input-origin-balance')).not.toHaveText('No wallet connected');
  expect(await page.getByTestId('upgrade-input-origin-balance').innerText()).toBe('10 USDS');
  await page.getByRole('tab', { name: 'Upgrade' }).last().click();

  await page.getByTestId('upgrade-input-origin').click();
  await page.getByTestId('upgrade-input-origin').fill('5');

  await approveOrPerformAction(page, 'Upgrade');
  await page.getByRole('button', { name: 'Back to Upgrade' }).click();

  await expect(page.getByTestId('upgrade-input-origin-balance')).not.toHaveText('No wallet connected');
  await expect(page.getByTestId('upgrade-input-origin-balance')).toHaveText('5 DAI');

  await page.getByRole('tab', { name: 'Revert' }).click();
  await expect(page.getByTestId('upgrade-input-origin-balance')).not.toHaveText('No wallet connected');
  await expect(page.getByTestId('upgrade-input-origin-balance')).toHaveText('15 USDS');

  await page.getByTestId('upgrade-input-origin').click();
  await page.getByTestId('upgrade-input-origin').fill('4');
  await approveOrPerformAction(page, 'Revert');
  await page.getByRole('button', { name: 'Back to Upgrade' }).click();

  await expect(page.getByTestId('upgrade-input-origin-balance')).toHaveText('11 USDS');

  await page.getByRole('tab', { name: 'Upgrade' }).last().click();
  await expect(page.getByTestId('upgrade-input-origin-balance')).toHaveText('9 DAI');
});

test('Insufficient token allowance triggers approval flow', async ({ page }) => {
  await page.goto('/');
  await connectMockWalletAndAcceptTerms(page);
  await page.getByRole('tab', { name: 'Upgrade' }).click();
  await page.getByTestId('upgrade-input-origin').click();
  await page.getByTestId('upgrade-input-origin').fill('90');
  // Not enough allowance, so approve button should be visible
  await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible();
  await page.getByRole('button', { name: 'Approve' }).click();
  await page.getByRole('button', { name: 'Back' }).click();

  // Restart
  await page.reload();
  await connectMockWalletAndAcceptTerms(page);
  await page.getByTestId('upgrade-input-origin').click();
  await page.getByTestId('upgrade-input-origin').fill('90');
  // It should not ask for approval
  await expect(page.getByTestId('widget-container').getByRole('button', { name: 'Upgrade' })).toBeVisible();
  // Upgrade and reset approval
  await page.getByTestId('widget-container').getByRole('button', { name: 'Upgrade' }).click();
  await page.getByRole('button', { name: 'Back to Upgrade' }).click();

  // Restart
  await page.reload();
  await connectMockWalletAndAcceptTerms(page);
  await page.getByTestId('upgrade-input-origin').click();
  await page.getByTestId('upgrade-input-origin').fill('10');
  // Allowance should be reset, so approve button should be visible again
  await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible();
});

test('if not connected it should show a connect button', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Upgrade' }).click();

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

// TODO: this test occasionally fails due to wallet not being connect, which might be related to above test
test('percentage buttons work', async ({ page }) => {
  await setTestBalance(usdsAddress[TENDERLY_CHAIN_ID], '1000');

  await page.goto('/');
  await connectMockWalletAndAcceptTerms(page);
  await page.getByRole('tab', { name: 'Upgrade' }).click();

  await page.getByRole('button', { name: '25%' }).click();
  expect(await page.getByTestId('upgrade-input-origin').inputValue()).toBe('25');
  await page.getByRole('button', { name: '50%' }).click();
  expect(await page.getByTestId('upgrade-input-origin').inputValue()).toBe('50');
  await page.getByRole('button', { name: '100%' }).click();
  expect(await page.getByTestId('upgrade-input-origin').inputValue()).toBe('100');

  await page.getByRole('tab', { name: 'Revert' }).click();
  await expect(page.getByText('No wallet connected')).not.toBeVisible();
  await page.getByRole('button', { name: '25%' }).click();
  expect(await page.getByTestId('upgrade-input-origin').inputValue()).toBe('250');
  await page.getByRole('button', { name: '50%' }).click();
  expect(await page.getByTestId('upgrade-input-origin').inputValue()).toBe('500');
  await page.getByRole('button', { name: '100%' }).click();
  expect(await page.getByTestId('upgrade-input-origin').inputValue()).toBe('1000');
});

test('enter amount button should be disabled', async ({ page }) => {
  await page.goto('/');
  await connectMockWalletAndAcceptTerms(page);
  await page.getByRole('tab', { name: 'Upgrade' }).click();

  await expect(
    page.getByTestId('widget-container').locator('button').filter({ hasText: 'Enter amount' })
  ).toBeDisabled();

  await page.getByTestId('upgrade-input-origin').click();
  await page.getByTestId('upgrade-input-origin').fill('0');

  await expect(
    page.getByTestId('widget-container').locator('button').filter({ hasText: 'Enter amount' })
  ).toBeDisabled();

  // Revert
  await page.getByRole('tab', { name: 'Revert' }).click();
  await expect(
    page.getByTestId('widget-container').locator('button').filter({ hasText: 'Enter amount' })
  ).toBeDisabled();
  await page.getByTestId('upgrade-input-origin').click();
  await page.getByTestId('upgrade-input-origin').fill('0');
  // TODO: Fix this in widgets package
  await expect(
    page.getByTestId('widget-container').locator('button').filter({ hasText: 'Enter amount' })
  ).toBeDisabled();
});

test('An approval error redirects to the error screen', async ({ page }) => {
  await page.goto('/');
  await connectMockWalletAndAcceptTerms(page);
  await page.getByRole('tab', { name: 'Upgrade' }).click();
  await page.getByTestId('upgrade-input-origin').click();
  await page.getByTestId('upgrade-input-origin').fill('100');

  // Intercept the tenderly RPC call to reject the transaction. Waits for 200ms for UI to update
  await interceptAndRejectTransactions(page, 200, true);
  await page.getByRole('button', { name: 'Approve' }).click();

  expect(page.getByText('An error occurred ')).toBeVisible();
  expect(page.getByRole('button', { name: 'Back', exact: true }).last()).toBeVisible();
  expect(page.getByRole('button', { name: 'Back', exact: true }).last()).toBeEnabled();
  expect(page.getByRole('button', { name: 'Retry' }).last()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry' }).last()).toBeEnabled({ timeout: 15000 });

  await page.getByRole('button', { name: 'Retry' }).last().click();

  await expect(page.getByText('An error occurred while approving access to your DAI.')).toBeVisible();

  page.getByRole('button', { name: 'Back', exact: true }).last().click();
  await page.getByRole('tab', { name: 'Revert' }).click();
  await page.getByTestId('upgrade-input-origin').click();
  await page.getByTestId('upgrade-input-origin').fill('100');

  await page.getByRole('button', { name: 'Approve' }).click();

  expect(page.getByText('An error occurred while approving access to your USDS.')).toBeVisible();
  expect(page.getByRole('button', { name: 'Back', exact: true }).last()).toBeVisible();
  expect(page.getByRole('button', { name: 'Back', exact: true }).last()).toBeEnabled();
  expect(page.getByRole('button', { name: 'Retry' }).last()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry' }).last()).toBeEnabled({ timeout: 15000 });

  await page.getByRole('button', { name: 'Retry' }).last().click();

  await expect(page.getByText('An error occurred while approving access to your USDS.')).toBeVisible();
});

test('An upgrade error redirects to the error screen', async ({ page }) => {
  await page.goto('/');
  await connectMockWalletAndAcceptTerms(page);
  await page.getByRole('tab', { name: 'Upgrade' }).click();
  await page.getByTestId('upgrade-input-origin').click();
  await page.getByTestId('upgrade-input-origin').fill('1');

  await approveOrPerformAction(page, 'Upgrade', { reject: true });

  await expect(page.getByText('An error occurred while upgrading your tokens')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back' }).last()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back' }).last()).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Retry' }).last()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry' }).last()).toBeEnabled({ timeout: 15000 });

  await page.getByRole('button', { name: 'Retry' }).last().click();

  await expect(page.getByText('An error occurred while upgrading your tokens')).toBeVisible();
});

test('A revert error redirects to the error screen', async ({ page }) => {
  await page.goto('/');
  await connectMockWalletAndAcceptTerms(page);
  await page.getByRole('tab', { name: 'Upgrade' }).click();
  await page.getByRole('tab', { name: 'Revert' }).click();
  await page.getByTestId('upgrade-input-origin').click();
  await page.getByTestId('upgrade-input-origin').fill('1');

  await interceptAndRejectTransactions(page, 200, true);

  await approveOrPerformAction(page, 'Revert', { buttonName: 'Retry' });
  expect(page.getByText('An error occurred while approving access to your USDS.')).toBeVisible();
  expect(page.getByRole('button', { name: 'Back' }).last()).toBeVisible();
  expect(page.getByRole('button', { name: 'Back' }).last()).toBeEnabled();
  expect(page.getByRole('button', { name: 'Retry' }).last()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry' }).last()).toBeEnabled({ timeout: 15000 });

  await page.getByRole('button', { name: 'Retry' }).last().click();

  await expect(page.getByText('An error occurred while approving access to your USDS.')).toBeVisible();
});

test('Details pane shows right data', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Upgrade' }).click();

  expect(page.getByTestId('upgrade-input-origin-balance')).toHaveText('No wallet connected');

  expect(
    page.getByTestId('widget-container').getByRole('button', { name: 'Connect Wallet' }).last()
  ).toBeVisible();
  expect(
    page.getByTestId('widget-container').getByRole('button', { name: 'Connect Wallet' }).last()
  ).toBeEnabled();
  expect(page.getByTestId('connect-wallet-card').getByRole('heading')).toBeVisible();
  // expect(
  //   page.getByTestId('connect-wallet-card').getByRole('heading', { name: 'Set up access to explore' })
  // ).toBeVisible();
  expect(page.getByTestId('connect-wallet-card-button')).toBeVisible();
  // expect(page.getByRole('cell')).toBeVisible();
  // expect(page.getByRole('cell', { name: 'Connect a wallet to view' })).toBeVisible();

  await connectMockWalletAndAcceptTerms(page);

  await expect(page.getByTestId('upgrade-input-origin-balance')).not.toHaveText('No wallet connected');

  // Connect wallet elements should not be visible after connecting
  await expect(
    page.getByTestId('widget-container').getByRole('button', { name: 'Connect Wallet' })
  ).not.toBeVisible();
  await expect(
    page.getByTestId('connect-wallet-card').getByRole('heading', { name: 'Set up access to explore' })
  ).not.toBeVisible();
  await expect(
    page.getByRole('cell', { name: 'Please connect your wallet to view your history' })
  ).not.toBeVisible();

  await page.pause();
  const totalDaiUpgradedWidget = await page
    .getByTestId('widget-container')
    .getByRole('heading', { name: 'Total USDS upgraded', exact: true })
    .first()
    .locator('xpath=ancestor::div[1]')
    .getByText(/\d+/)
    .innerText();
  // const totalMkrUpgradedWidget = await page
  //   .getByTestId('widget-container')
  //   .getByRole('heading', { name: 'Total MKR upgraded', exact: true })
  //   .nth(1)
  //   .locator('xpath=ancestor::div[1]')
  //   .getByText(/\d+/)
  //   .innerText();
  const totalDaiUpgradedDetails = await page
    .getByTestId('upgrade-stats-details')
    .getByRole('heading', { name: 'Total USDS upgraded', exact: true })
    .locator('xpath=ancestor::div[1]')
    .getByText(/\d+/)
    .innerText();
  await page
    .getByTestId('upgrade-stats-details')
    .getByRole('heading', { name: 'Total SKY upgraded', exact: true })
    .locator('xpath=ancestor::div[1]')
    .getByText(/\d+/)
    .innerText();

  // TODO: we should run these through the number formatter, but it was throwing an error
  expect(totalDaiUpgradedWidget.slice(0, 2)).toEqual(totalDaiUpgradedDetails.slice(0, 2));
  // expect(totalMkrUpgradedWidget.slice(0, 2)).toEqual(totalMkrUpgradedDetails.slice(0, 2));

  // close details pane
  await page.getByLabel('Toggle details').click();
  await expect(
    page.getByRole('button', { name: 'Your Upgrade/Revert transaction history' })
  ).not.toBeVisible();

  // open details pane
  await page.getByLabel('Toggle details').click();
  await expect(page.getByRole('button', { name: 'Your Upgrade/Revert transaction history' })).toBeVisible();

  // Chart is present
  await expect(page.getByTestId('usds-sky-totals-chart')).toBeVisible();

  // About section is present
  await expect(page.getByRole('button', { name: 'About' })).toBeVisible();

  // FAQ section is present
  await expect(page.getByRole('button', { name: 'FAQs', exact: true })).toBeVisible();
});
