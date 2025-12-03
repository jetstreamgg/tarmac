import { expect, test } from '../fixtures-parallel';
import { daiUsdsAddress, mcdDaiAddress } from '@jetstreamgg/sky-hooks';
import { TENDERLY_CHAIN_ID } from '@/data/wagmi/config/testTenderlyChain.ts';
import { interceptAndRejectTransactions } from '../utils/rejectTransaction.ts';
import { performAction } from '../utils/approveOrPerformAction.ts';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.ts';
import { NetworkName } from '../utils/constants.ts';
import { approveToken } from '../utils/approveToken.ts';

test('Upgrade DAI and revert USDS', async ({ isolatedPage }) => {
  await isolatedPage.goto('/');
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.getByRole('tab', { name: 'Upgrade' }).click();

  await expect(isolatedPage.getByRole('button', { name: 'Transaction overview' })).not.toBeVisible();

  await isolatedPage.getByTestId('upgrade-input-origin').click();
  await isolatedPage.getByTestId('upgrade-input-origin').fill('4');
  await expect(isolatedPage.getByRole('button', { name: 'Transaction overview' })).toBeVisible();
  await performAction(isolatedPage, 'Upgrade');
  await isolatedPage.getByRole('button', { name: 'Back to Upgrade' }).click();
  await isolatedPage.getByRole('tab', { name: 'Revert' }).click();
  await expect(isolatedPage.getByRole('button', { name: 'Transaction overview' })).not.toBeVisible();
  await isolatedPage.getByTestId('upgrade-input-origin').click();
  await isolatedPage.getByTestId('upgrade-input-origin').fill('4');
  await expect(isolatedPage.getByRole('button', { name: 'Transaction overview' })).toBeVisible();
  await performAction(isolatedPage, 'Revert');
  await isolatedPage.getByRole('button', { name: 'Back to Upgrade' }).click();
});

test('Upgrade MKR but revert SKY isnt allowed', async ({ isolatedPage }) => {
  await isolatedPage.goto('/');
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.getByRole('tab', { name: 'Upgrade' }).click();
  await isolatedPage.getByTestId('undefined-menu-button').click();
  await isolatedPage.getByRole('button', { name: 'MKR MKR MKR' }).click();

  await expect(isolatedPage.getByRole('button', { name: 'Transaction overview' })).not.toBeVisible();

  await isolatedPage.getByTestId('upgrade-input-origin').click();
  await isolatedPage.getByTestId('upgrade-input-origin').fill('4');
  await expect(isolatedPage.getByRole('button', { name: 'Transaction overview' })).not.toBeVisible();
  await performAction(isolatedPage, 'Upgrade');
  await isolatedPage.getByRole('button', { name: 'Back to Upgrade' }).click();
  await isolatedPage.getByRole('tab', { name: 'Revert' }).click();
  // Sky can't be reverted
  await expect(isolatedPage.getByRole('button', { name: 'SKY SKY SKY' })).not.toBeVisible();
});

test('Upgrade and revert with insufficient balance', async ({ isolatedPage }) => {
  await isolatedPage.goto('/');
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.getByRole('tab', { name: 'Upgrade' }).click();

  await expect(isolatedPage.getByTestId('upgrade-input-origin-balance')).not.toHaveText(
    'No wallet connected'
  );
  const daiBalanceLabel = isolatedPage.getByTestId('upgrade-input-origin-balance');
  const daiBalanceText = ((await daiBalanceLabel.innerText()) as string).split(' ')[0].trim();

  await isolatedPage.getByTestId('upgrade-input-origin').click();
  // Upgrade an amount greater than the balance
  await isolatedPage.getByTestId('upgrade-input-origin').fill(`${daiBalanceText}0`);
  await expect(isolatedPage.getByText('Insufficient funds')).toBeVisible();
  await expect(isolatedPage.getByRole('button', { name: 'Review' })).toBeDisabled();

  await isolatedPage.getByRole('tab', { name: 'Revert' }).click();
  await expect(isolatedPage.getByTestId('upgrade-input-origin-balance')).not.toHaveText(
    'No wallet connected'
  );
  const uSDSBalanceLabel = isolatedPage.getByTestId('upgrade-input-origin-balance');
  const uSDSBalanceText = ((await uSDSBalanceLabel.innerText()) as string).split(' ')[0].trim();

  await isolatedPage.getByTestId('upgrade-input-origin').click();
  // Upgrade an amount greater than the balance
  await isolatedPage.getByTestId('upgrade-input-origin').fill(`${uSDSBalanceText}0`);
  await expect(isolatedPage.getByText('Insufficient funds')).toBeVisible();
  await expect(isolatedPage.getByRole('button', { name: 'Review' })).toBeDisabled();
});

test('Balances change after successfully upgrading and reverting', async ({ isolatedPage }) => {
  await isolatedPage.goto('/');
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.getByRole('tab', { name: 'Upgrade' }).click();

  await expect(isolatedPage.getByTestId('upgrade-input-origin-balance')).not.toHaveText(
    'No wallet connected'
  );

  // Get initial DAI balance
  const initialDaiBalance = await isolatedPage.getByTestId('upgrade-input-origin-balance').innerText();

  await isolatedPage.getByRole('tab', { name: 'Revert' }).click();
  await expect(isolatedPage.getByTestId('upgrade-input-origin-balance')).not.toHaveText(
    'No wallet connected'
  );

  // Get initial USDS balance
  const initialUsdsBalance = await isolatedPage.getByTestId('upgrade-input-origin-balance').innerText();
  await isolatedPage.getByRole('tab', { name: 'Upgrade' }).last().click();

  await isolatedPage.getByTestId('upgrade-input-origin').click();
  await isolatedPage.getByTestId('upgrade-input-origin').fill('5');

  await performAction(isolatedPage, 'Upgrade');
  await isolatedPage.getByRole('button', { name: 'Back to Upgrade' }).click();

  await expect(isolatedPage.getByTestId('upgrade-input-origin-balance')).not.toHaveText(
    'No wallet connected'
  );

  // Check DAI decreased
  const daiAfterUpgrade = await isolatedPage.getByTestId('upgrade-input-origin-balance').innerText();
  const daiAmount = parseFloat(daiAfterUpgrade.split(' ')[0]);
  const initialDaiAmount = parseFloat(initialDaiBalance.split(' ')[0]);
  expect(daiAmount).toBeLessThan(initialDaiAmount);

  await isolatedPage.getByRole('tab', { name: 'Revert' }).click();
  await expect(isolatedPage.getByTestId('upgrade-input-origin-balance')).not.toHaveText(
    'No wallet connected'
  );

  // Check USDS increased
  const usdsAfterUpgrade = await isolatedPage.getByTestId('upgrade-input-origin-balance').innerText();
  const usdsAmount = parseFloat(usdsAfterUpgrade.split(' ')[0]);
  const initialUsdsAmount = parseFloat(initialUsdsBalance.split(' ')[0]);
  expect(usdsAmount).toBeGreaterThan(initialUsdsAmount);

  await isolatedPage.getByTestId('upgrade-input-origin').click();
  await isolatedPage.getByTestId('upgrade-input-origin').fill('4');
  await performAction(isolatedPage, 'Revert');
  await isolatedPage.getByRole('button', { name: 'Back to Upgrade' }).click();

  // Verify final USDS balance decreased after revert
  const finalUsdsBalance = await isolatedPage.getByTestId('upgrade-input-origin-balance').innerText();
  const finalUsdsAmount = parseFloat(finalUsdsBalance.split(' ')[0]);
  expect(finalUsdsAmount).toBeLessThan(usdsAmount);

  await isolatedPage.getByRole('tab', { name: 'Upgrade' }).last().click();

  // Verify final DAI balance increased after revert
  const finalDaiBalance = await isolatedPage.getByTestId('upgrade-input-origin-balance').innerText();
  const finalDaiAmount = parseFloat(finalDaiBalance.split(' ')[0]);
  expect(finalDaiAmount).toBeGreaterThan(daiAmount);
});

test('Insufficient token allowance triggers approval flow', async ({ isolatedPage }) => {
  await isolatedPage.goto('/');
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.getByRole('tab', { name: 'Upgrade' }).click();
  await isolatedPage.getByTestId('upgrade-input-origin').click();
  await isolatedPage.getByTestId('upgrade-input-origin').fill('90');
  await isolatedPage.getByTestId('widget-button').getByText('Review').click();
  // Not enough allowance, so the 'confirm 2 transactions' or 'bundled transaction' button should be visible
  const buttonText = await isolatedPage.getByTestId('widget-button').last().textContent();
  expect(buttonText).toMatch(/(Confirm 2 transactions|Confirm bundled transaction)/);

  await approveToken(
    mcdDaiAddress[TENDERLY_CHAIN_ID],
    daiUsdsAddress[TENDERLY_CHAIN_ID],
    '90',
    NetworkName.mainnet
  );

  // Restart
  await isolatedPage.reload();
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.getByTestId('upgrade-input-origin').click();
  await isolatedPage.getByTestId('upgrade-input-origin').fill('90');
  await isolatedPage.getByTestId('widget-button').getByText('Review').click();
  // It should not ask for approval
  await expect(
    isolatedPage
      .getByTestId('widget-container')
      .getByRole('button', { name: /Confirm (upgrade|bundled transaction)/ })
      .last()
  ).toBeVisible();
  // Upgrade and reset approval
  await isolatedPage
    .getByTestId('widget-container')
    .getByRole('button', { name: /Confirm (upgrade|bundled transaction)/ })
    .last()
    .click();
  await isolatedPage.getByRole('button', { name: 'Back to Upgrade' }).click();

  // Restart
  await isolatedPage.reload();
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.getByTestId('upgrade-input-origin').click();
  await isolatedPage.getByTestId('upgrade-input-origin').fill('10');
  await isolatedPage.getByTestId('widget-button').getByText('Review').click();
  // Allowance should be reset, so the 2 transactions button should be visible again
  const finalButtonText = await isolatedPage.getByTestId('widget-button').last().textContent();
  expect(finalButtonText).toMatch(/(Confirm 2 transactions|Confirm bundled transaction)/);
});

test('if not connected it should show a connect button', async ({ isolatedPage }) => {
  await isolatedPage.goto('/');
  await isolatedPage.getByRole('tab', { name: 'Upgrade' }).click();

  // Connect button and copy should be visible
  const widgetConnectButton = isolatedPage
    .getByTestId('widget-container')
    .getByRole('button', { name: 'Connect Wallet' });
  await expect(widgetConnectButton).toBeEnabled();
  await expect(isolatedPage.getByRole('heading', { name: 'Connect to explore Sky' })).toBeVisible();

  // After connecting, the button should disappear
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await expect(widgetConnectButton).not.toBeVisible();
});

test('percentage buttons work', async ({ isolatedPage }) => {
  await isolatedPage.goto('/');
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.getByRole('tab', { name: 'Upgrade' }).click();

  await expect(isolatedPage.getByTestId('upgrade-input-origin-balance')).not.toHaveText(
    'No wallet connected'
  );

  // Get initial DAI balance
  const daiBalanceText = await isolatedPage.getByTestId('upgrade-input-origin-balance').innerText();
  console.log(`daiBalanceText: ${daiBalanceText}`);
  const daiBalance = parseFloat(daiBalanceText.split(' ')[0]);

  await isolatedPage.getByRole('button', { name: '25%' }).click();
  const input25 = await isolatedPage.getByTestId('upgrade-input-origin').inputValue();
  expect(parseFloat(input25)).toBeCloseTo(daiBalance * 0.25, 0);

  await isolatedPage.getByRole('button', { name: '50%' }).click();
  const input50 = await isolatedPage.getByTestId('upgrade-input-origin').inputValue();
  expect(parseFloat(input50)).toBeCloseTo(daiBalance * 0.5, 0);

  await isolatedPage.getByRole('button', { name: '100%' }).click();
  const input100 = await isolatedPage.getByTestId('upgrade-input-origin').inputValue();
  expect(parseFloat(input100)).toBeCloseTo(daiBalance, 0);

  await isolatedPage.getByRole('tab', { name: 'Revert' }).click();
  await expect(isolatedPage.getByText('No wallet connected')).not.toBeVisible();

  // Get USDS balance
  const usdsBalanceText = await isolatedPage.getByTestId('upgrade-input-origin-balance').innerText();
  const usdsBalance = parseFloat(usdsBalanceText.split(' ')[0]);

  await isolatedPage.getByRole('button', { name: '25%' }).click();
  const usdsInput25 = await isolatedPage.getByTestId('upgrade-input-origin').inputValue();
  expect(parseFloat(usdsInput25)).toBeCloseTo(usdsBalance * 0.25, 0);

  await isolatedPage.getByRole('button', { name: '50%' }).click();
  const usdsInput50 = await isolatedPage.getByTestId('upgrade-input-origin').inputValue();
  expect(parseFloat(usdsInput50)).toBeCloseTo(usdsBalance * 0.5, 0);

  await isolatedPage.getByRole('button', { name: '100%' }).click();
  const usdsInput100 = await isolatedPage.getByTestId('upgrade-input-origin').inputValue();
  expect(parseFloat(usdsInput100)).toBeCloseTo(usdsBalance, 0);
});

test('enter amount button should be disabled', async ({ isolatedPage }) => {
  await isolatedPage.goto('/');
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.getByRole('tab', { name: 'Upgrade' }).click();

  await expect(
    isolatedPage.getByTestId('widget-container').locator('button').filter({ hasText: 'Enter amount' })
  ).toBeDisabled();

  await isolatedPage.getByTestId('upgrade-input-origin').click();
  await isolatedPage.getByTestId('upgrade-input-origin').fill('0');

  await expect(
    isolatedPage.getByTestId('widget-container').locator('button').filter({ hasText: 'Enter amount' })
  ).toBeDisabled();

  // Revert
  await isolatedPage.getByRole('tab', { name: 'Revert' }).click();
  await expect(
    isolatedPage.getByTestId('widget-container').locator('button').filter({ hasText: 'Enter amount' })
  ).toBeDisabled();
  await isolatedPage.getByTestId('upgrade-input-origin').click();
  await isolatedPage.getByTestId('upgrade-input-origin').fill('0');
  // TODO: Fix this in widgets package
  await expect(
    isolatedPage.getByTestId('widget-container').locator('button').filter({ hasText: 'Enter amount' })
  ).toBeDisabled();
});

test('An approval error redirects to the error screen', async ({ isolatedPage }) => {
  await isolatedPage.goto('/');
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.getByRole('tab', { name: 'Upgrade' }).click();
  await isolatedPage.getByTestId('upgrade-input-origin').click();
  await isolatedPage.getByTestId('upgrade-input-origin').fill('100');
  await isolatedPage.getByTestId('widget-button').getByText('Review').click();

  // Intercept the tenderly RPC call to reject the transaction. Waits for 200ms for UI to update
  await interceptAndRejectTransactions(isolatedPage, 200, true);
  await isolatedPage.getByTestId('widget-button').last().click();

  expect(isolatedPage.getByText('An error occurred during the upgrade flow.').last()).toBeVisible();
  expect(isolatedPage.getByRole('button', { name: 'Back', exact: true }).last()).toBeVisible();
  expect(isolatedPage.getByRole('button', { name: 'Back', exact: true }).last()).toBeEnabled();
  expect(isolatedPage.getByRole('button', { name: 'Retry' }).last()).toBeVisible();
  await expect(isolatedPage.getByRole('button', { name: 'Retry' }).last()).toBeEnabled({ timeout: 15000 });

  await isolatedPage.getByRole('button', { name: 'Retry' }).last().click();

  await expect(isolatedPage.getByText('An error occurred during the upgrade flow.').last()).toBeVisible();

  isolatedPage.getByRole('button', { name: 'Back', exact: true }).last().click();
  await isolatedPage.getByRole('tab', { name: 'Revert' }).click();
  await isolatedPage.getByTestId('upgrade-input-origin').click();
  await isolatedPage.getByTestId('upgrade-input-origin').fill('100');
  await isolatedPage.getByTestId('widget-button').getByText('Review').click();

  await isolatedPage.getByTestId('widget-button').last().click();

  expect(isolatedPage.getByText('An error occurred during the revert flow.').last()).toBeVisible();
  expect(isolatedPage.getByRole('button', { name: 'Back', exact: true }).last()).toBeVisible();
  expect(isolatedPage.getByRole('button', { name: 'Back', exact: true }).last()).toBeEnabled();
  expect(isolatedPage.getByRole('button', { name: 'Retry' }).last()).toBeVisible();
  await expect(isolatedPage.getByRole('button', { name: 'Retry' }).last()).toBeEnabled({ timeout: 15000 });

  await isolatedPage.getByRole('button', { name: 'Retry' }).last().click();

  await expect(isolatedPage.getByText('An error occurred during the revert flow.').last()).toBeVisible();
});

test('An upgrade error redirects to the error screen', async ({ isolatedPage }) => {
  await isolatedPage.goto('/');
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.getByRole('tab', { name: 'Upgrade' }).click();
  await isolatedPage.getByTestId('upgrade-input-origin').click();
  await isolatedPage.getByTestId('upgrade-input-origin').fill('1');

  await performAction(isolatedPage, 'Upgrade', { reject: true });

  await expect(isolatedPage.getByText('An error occurred during the upgrade flow.').last()).toBeVisible();
  await expect(isolatedPage.getByRole('button', { name: 'Back' }).last()).toBeVisible();
  await expect(isolatedPage.getByRole('button', { name: 'Back' }).last()).toBeEnabled();
  await expect(isolatedPage.getByRole('button', { name: 'Retry' }).last()).toBeVisible();
  await expect(isolatedPage.getByRole('button', { name: 'Retry' }).last()).toBeEnabled({ timeout: 15000 });

  await isolatedPage.getByRole('button', { name: 'Retry' }).last().click();

  await expect(isolatedPage.getByText('An error occurred during the upgrade flow.').last()).toBeVisible();
});

test('A revert error redirects to the error screen', async ({ isolatedPage }) => {
  await isolatedPage.goto('/');
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.getByRole('tab', { name: 'Upgrade' }).click();
  await isolatedPage.getByRole('tab', { name: 'Revert' }).click();
  await isolatedPage.getByTestId('upgrade-input-origin').click();
  await isolatedPage.getByTestId('upgrade-input-origin').fill('1');

  await interceptAndRejectTransactions(isolatedPage, 200, true);

  await performAction(isolatedPage, 'Revert', { reject: true });
  expect(isolatedPage.getByText('An error occurred during the revert flow.').last()).toBeVisible();
  expect(isolatedPage.getByRole('button', { name: 'Back' }).last()).toBeVisible();
  expect(isolatedPage.getByRole('button', { name: 'Back' }).last()).toBeEnabled();
  expect(isolatedPage.getByRole('button', { name: 'Retry' }).last()).toBeVisible();
  await expect(isolatedPage.getByRole('button', { name: 'Retry' }).last()).toBeEnabled({ timeout: 15000 });

  await isolatedPage.getByRole('button', { name: 'Retry' }).last().click();

  await expect(isolatedPage.getByText('An error occurred during the revert flow.').last()).toBeVisible();
});
