import { expect, test } from '../fixtures.ts';
import { setErc20Balance } from '../utils/setBalance.ts';
import { mcdDaiAddress, usdsAddress, wethAddress } from '@jetstreamgg/sky-hooks';
import { TENDERLY_CHAIN_ID } from '@/data/wagmi/config/testTenderlyChain.ts';
import { interceptAndRejectTransactions } from '../utils/rejectTransaction.ts';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Trade' }).click();
});

// Trade token that needs allowance
test('Trade USDC for DAI', async ({ page }) => {
  await setErc20Balance(mcdDaiAddress[TENDERLY_CHAIN_ID], '10');
  await connectMockWalletAndAcceptTerms(page);
  await page.getByTestId('trade-input-origin').click();
  await page.getByTestId('trade-input-origin').fill('10');
  await page.getByRole('button', { name: 'Ether ETH' }).click();
  await page.getByRole('button', { name: 'USD Coin USD Coin USDC' }).click();
  await page.getByRole('button', { name: 'Select token' }).click();
  await page.getByRole('button', { name: 'DAI Stablecoin DAI Stablecoin DAI' }).click();
  expect(await page.getByTestId('trade-input-origin-balance').innerText()).toBe('10 USDC');
  expect(await page.getByTestId('trade-input-target-balance').innerText()).toBe('10 DAI');
  await page.getByRole('button', { name: 'Review trade' }).click();
  await page.getByRole('button', { name: 'Approve' }).first().click();

  await expect(page.getByRole('heading', { name: 'Success' })).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).last().click();
  await expect(page.getByRole('heading', { name: 'Trade completed' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to Trade' }).click();

  await page.getByRole('button', { name: 'Ether ETH' }).click();
  await page.getByRole('button', { name: 'USD Coin USD Coin USDC' }).click();
  await page.getByRole('button', { name: 'Select token' }).click();
  await page.getByRole('button', { name: 'DAI Stablecoin DAI Stablecoin DAI' }).click();
  await expect(page.getByTestId('trade-input-origin-balance')).toHaveText('0 USDC');
  const targetBalance = await page.getByTestId('trade-input-target-balance').innerText();
  expect(parseFloat(targetBalance.split(' ')[0])).toBeGreaterThan(19.9);
  expect(parseFloat(targetBalance.split(' ')[0])).toBeLessThan(20.1);
});

test('Token approval flow triggers when not enough allowance', async ({ page }) => {
  await setErc20Balance(usdsAddress[TENDERLY_CHAIN_ID], '10');
  await connectMockWalletAndAcceptTerms(page);
  await page.getByTestId('trade-input-origin').click();
  await page.getByTestId('trade-input-origin').fill('5');
  await page.getByRole('button', { name: 'Ether ETH' }).click();
  await page.getByRole('button', { name: 'USDS USDS USDS' }).click();
  await page.getByRole('button', { name: 'Select token' }).click();
  await page.getByRole('button', { name: 'USD Coin USD Coin USDC' }).click();
  await page.getByRole('button', { name: 'Review trade' }).click();
  await page.getByRole('button', { name: 'Approve' }).first().click();

  await expect(page.getByRole('heading', { name: 'Success' })).toBeVisible();

  await page.reload();
  await connectMockWalletAndAcceptTerms(page);
  await page.getByTestId('trade-input-origin').click();
  await page.getByTestId('trade-input-origin').fill('10');
  await page.getByRole('button', { name: 'Ether ETH' }).click();
  await page.getByRole('button', { name: 'USDS USDS USDS' }).click();
  await page.getByRole('button', { name: 'Select token' }).click();
  await page.getByRole('button', { name: 'USD Coin USD Coin USDC' }).click();
  await page.getByRole('button', { name: 'Review trade' }).click();

  await expect(page.getByRole('button', { name: 'Approve' }).first()).toBeVisible();

  await page.reload();
  await connectMockWalletAndAcceptTerms(page);
  await page.getByTestId('trade-input-origin').click();
  await page.getByTestId('trade-input-origin').fill('5');
  await page.getByRole('button', { name: 'Ether ETH' }).click();
  await page.getByRole('button', { name: 'USDS USDS USDS' }).click();
  await page.getByRole('button', { name: 'Select token' }).click();
  await page.getByRole('button', { name: 'USD Coin USD Coin USDC' }).click();
  await page.getByRole('button', { name: 'Review trade' }).click();

  await expect(page.getByRole('button', { name: 'Confirm trade' }).last()).toBeVisible();
});

test('UI elements work and are displayed as expected', async ({ page }) => {
  await setErc20Balance(wethAddress[TENDERLY_CHAIN_ID], '10');
  expect(page.getByTestId('trade-input-origin-balance')).toHaveText('No wallet connected');
  expect(page.getByTestId('trade-input-target-balance')).not.toBeVisible();
  await page.getByRole('button', { name: 'Select token' }).click();
  expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'DAI Stablecoin DAI Stablecoin DAI' }).click();
  expect(page.getByTestId('trade-input-target-balance')).toHaveText('No wallet connected');

  expect(page.getByTestId('widget-container').getByRole('button', { name: 'Connect Wallet' })).toBeVisible();
  expect(page.getByTestId('widget-container').getByRole('button', { name: 'Connect Wallet' })).toBeEnabled();
  expect(
    page.getByTestId('connect-wallet-card').getByRole('heading', { name: 'Set up access to explore' })
  ).toBeVisible();
  expect(page.getByTestId('connect-wallet-card-button')).toBeVisible();

  await page.reload();

  await connectMockWalletAndAcceptTerms(page);

  await expect(page.getByTestId('trade-input-origin-balance')).not.toHaveText('No wallet connected');
  await page.getByRole('button', { name: 'Select token' }).click();
  await page.getByRole('button', { name: 'DAI Stablecoin DAI Stablecoin DAI' }).click();
  await expect(page.getByTestId('trade-input-target-balance')).not.toHaveText('No wallet connected');
  await expect(
    page.getByTestId('widget-container').getByRole('button', { name: 'Connect Wallet' })
  ).not.toBeVisible();
  await expect(
    page.getByTestId('connect-wallet-card').getByRole('heading', { name: 'Set up access to explore' })
  ).not.toBeVisible();
  await expect(
    page.getByRole('cell', { name: 'Please connect your wallet to view your history' })
  ).not.toBeVisible();

  await page.getByTestId('widget-container').getByRole('button', { name: 'Ether ETH' }).click();
  await page.getByRole('button', { name: 'Wrapped Ether Wrapped Ether WETH' }).click();
  await page.getByRole('button', { name: '25%' }).click();
  await expect(page.getByTestId('trade-input-origin')).toHaveValue('2.5');
  await expect(page.getByText('Fetching best price')).toBeVisible();
  await expect(page.getByTestId('trade-input-target')).toHaveValue(/[0-9]/, { timeout: 20000 });
  await page.getByRole('button', { name: '50%' }).click();
  await expect(page.getByTestId('trade-input-origin')).toHaveValue('5');
  await page.getByRole('button', { name: '100%' }).click();
  await expect(page.getByTestId('trade-input-origin')).toHaveValue('10');
});

test('An error in the transaction redirects to the error screen', async ({ page }) => {
  await connectMockWalletAndAcceptTerms(page);
  await page.getByTestId('trade-input-origin').click();
  await page.getByTestId('trade-input-origin').fill('1');
  await page.getByRole('button', { name: 'Select token' }).click();
  await page.getByRole('button', { name: 'DAI Stablecoin DAI Stablecoin DAI' }).click();
  await page.getByRole('button', { name: 'Review trade' }).click();

  // Intercept the tenderly RPC call to reject the transaction. Waits for 200ms for UI to update
  await interceptAndRejectTransactions(page, 200);

  await page.getByRole('button', { name: 'Confirm trade' }).last().click();

  expect(page.getByText('An error occurred while trading your tokens')).toBeVisible();
  expect(page.getByRole('button', { name: 'Back' }).last()).toBeVisible();
  expect(page.getByRole('button', { name: 'Back' }).last()).toBeEnabled();
  expect(page.getByRole('button', { name: 'Retry' }).last()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry' }).last()).toBeEnabled({ timeout: 15000 });

  await page.getByRole('button', { name: 'Retry' }).last().click();

  expect(page.getByRole('heading', { name: 'Waiting for confirmation' })).toBeVisible();
  expect(page.getByText('An error occurred while trading your tokens')).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).last().click();
  await expect(page.getByTestId('trade-input-origin')).toBeVisible();
});
