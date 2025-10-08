import { expect, test } from '../fixtures-parallel';
import { setErc20Balance } from '../utils/setBalance.ts';
import { NetworkName } from '../utils/constants';
import { mcdDaiAddress, usdsAddress, wethAddress } from '@jetstreamgg/sky-hooks';
import { TENDERLY_CHAIN_ID } from '@/data/wagmi/config/testTenderlyChain.ts';
import { interceptAndRejectTransactions } from '../utils/rejectTransaction.ts';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.ts';

test.beforeEach(async ({ isolatedPage }) => {
  await isolatedPage.goto('/');
  await isolatedPage.getByRole('tab', { name: 'Trade' }).click();
});

// Trade token that needs allowance
test('Trade USDC for DAI', async ({ isolatedPage, testAccount }) => {
  await setErc20Balance(mcdDaiAddress[TENDERLY_CHAIN_ID], '10', 18, NetworkName.mainnet, testAccount);
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.waitForTimeout(1000);
  await isolatedPage.getByTestId('trade-input-origin').click();
  await isolatedPage.getByTestId('trade-input-origin').fill('10');
  await isolatedPage.getByRole('button', { name: 'Ether ETH' }).click();
  await isolatedPage.getByRole('button', { name: 'USD Coin USD Coin USDC' }).click();
  await isolatedPage.getByRole('button', { name: 'Select token' }).click();
  await isolatedPage.getByRole('button', { name: 'DAI Stablecoin DAI Stablecoin DAI' }).click();
  expect(await isolatedPage.getByTestId('trade-input-origin-balance').innerText()).toBe('10 USDC');
  expect(await isolatedPage.getByTestId('trade-input-target-balance').innerText()).toBe('10 DAI');
  await isolatedPage.getByRole('button', { name: 'Review trade' }).click();
  await isolatedPage.getByRole('button', { name: 'Approve' }).first().click();

  await expect(isolatedPage.getByRole('heading', { name: 'Success' })).toBeVisible();
  await isolatedPage.getByRole('button', { name: 'Next' }).last().click();
  await expect(isolatedPage.getByRole('heading', { name: 'Trade completed' })).toBeVisible();
  await isolatedPage.getByRole('button', { name: 'Back to Trade' }).click();

  await isolatedPage.getByRole('button', { name: 'Ether ETH' }).click();
  await isolatedPage.getByRole('button', { name: 'USD Coin USD Coin USDC' }).click();
  await isolatedPage.getByRole('button', { name: 'Select token' }).click();
  await isolatedPage.getByRole('button', { name: 'DAI Stablecoin DAI Stablecoin DAI' }).click();
  await expect(isolatedPage.getByTestId('trade-input-origin-balance')).toHaveText('0 USDC');
  const targetBalance = await isolatedPage.getByTestId('trade-input-target-balance').innerText();
  expect(parseFloat(targetBalance.split(' ')[0])).toBeGreaterThan(19.9);
  expect(parseFloat(targetBalance.split(' ')[0])).toBeLessThan(20.1);
});

test('Token approval flow triggers when not enough allowance', async ({ isolatedPage, testAccount }) => {
  await setErc20Balance(usdsAddress[TENDERLY_CHAIN_ID], '10', 18, NetworkName.mainnet, testAccount);
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.waitForTimeout(1000);
  await isolatedPage.getByTestId('trade-input-origin').click();
  await isolatedPage.getByTestId('trade-input-origin').fill('5');
  await isolatedPage.getByRole('button', { name: 'Ether ETH' }).click();
  await isolatedPage.getByRole('button', { name: 'USDS USDS USDS' }).click();
  await isolatedPage.getByRole('button', { name: 'Select token' }).click();
  await isolatedPage.getByRole('button', { name: 'USD Coin USD Coin USDC' }).click();
  await isolatedPage.getByRole('button', { name: 'Review trade' }).click();
  await isolatedPage.getByRole('button', { name: 'Approve' }).first().click();

  await expect(isolatedPage.getByRole('heading', { name: 'Success' })).toBeVisible();

  await isolatedPage.reload();
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.waitForTimeout(1000);
  await isolatedPage.getByTestId('trade-input-origin').click();
  await isolatedPage.getByTestId('trade-input-origin').fill('10');
  await isolatedPage.getByRole('button', { name: 'Ether ETH' }).click();
  await isolatedPage.getByRole('button', { name: 'USDS USDS USDS' }).click();
  await isolatedPage.getByRole('button', { name: 'Select token' }).click();
  await isolatedPage.getByRole('button', { name: 'USD Coin USD Coin USDC' }).click();
  await isolatedPage.getByRole('button', { name: 'Review trade' }).click();

  await expect(isolatedPage.getByRole('button', { name: 'Approve' }).first()).toBeVisible();

  await isolatedPage.reload();
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.waitForTimeout(1000);
  await isolatedPage.getByTestId('trade-input-origin').click();
  await isolatedPage.getByTestId('trade-input-origin').fill('5');
  await isolatedPage.getByRole('button', { name: 'Ether ETH' }).click();
  await isolatedPage.getByRole('button', { name: 'USDS USDS USDS' }).click();
  await isolatedPage.getByRole('button', { name: 'Select token' }).click();
  await isolatedPage.getByRole('button', { name: 'USD Coin USD Coin USDC' }).click();
  await isolatedPage.getByRole('button', { name: 'Review trade' }).click();

  await expect(isolatedPage.getByRole('button', { name: 'Confirm trade' }).last()).toBeVisible();
});

test('UI elements work and are displayed as expected', async ({ isolatedPage, testAccount }) => {
  await setErc20Balance(wethAddress[TENDERLY_CHAIN_ID], '10', 18, NetworkName.mainnet, testAccount);
  expect(isolatedPage.getByTestId('trade-input-origin-balance')).toHaveText('No wallet connected');
  expect(isolatedPage.getByTestId('trade-input-target-balance')).not.toBeVisible();
  await isolatedPage.getByRole('button', { name: 'Select token' }).click();
  expect(isolatedPage.getByRole('dialog')).toBeVisible();
  await isolatedPage.getByRole('button', { name: 'DAI Stablecoin DAI Stablecoin DAI' }).click();
  expect(isolatedPage.getByTestId('trade-input-target-balance')).toHaveText('No wallet connected');

  expect(
    isolatedPage.getByTestId('widget-container').getByRole('button', { name: 'Connect Wallet' })
  ).toBeVisible();
  expect(
    isolatedPage.getByTestId('widget-container').getByRole('button', { name: 'Connect Wallet' })
  ).toBeEnabled();
  expect(
    isolatedPage.getByTestId('connect-wallet-card').getByRole('heading', { name: 'Set up access to explore' })
  ).toBeVisible();
  expect(isolatedPage.getByTestId('connect-wallet-card-button')).toBeVisible();

  await isolatedPage.reload();

  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.waitForTimeout(1000);

  await expect(isolatedPage.getByTestId('trade-input-origin-balance')).not.toHaveText('No wallet connected');
  await isolatedPage.getByRole('button', { name: 'Select token' }).click();
  await isolatedPage.getByRole('button', { name: 'DAI Stablecoin DAI Stablecoin DAI' }).click();
  await expect(isolatedPage.getByTestId('trade-input-target-balance')).not.toHaveText('No wallet connected');
  await expect(
    isolatedPage.getByTestId('widget-container').getByRole('button', { name: 'Connect Wallet' })
  ).not.toBeVisible();
  await expect(
    isolatedPage.getByTestId('connect-wallet-card').getByRole('heading', { name: 'Set up access to explore' })
  ).not.toBeVisible();
  await expect(
    isolatedPage.getByRole('cell', { name: 'Please connect your wallet to view your history' })
  ).not.toBeVisible();

  await isolatedPage.getByTestId('widget-container').getByRole('button', { name: 'Ether ETH' }).click();
  await isolatedPage.getByRole('button', { name: 'Wrapped Ether Wrapped Ether WETH' }).click();
  await isolatedPage.getByRole('button', { name: '25%' }).click();
  await expect(isolatedPage.getByTestId('trade-input-origin')).toHaveValue('2.5');
  await expect(isolatedPage.getByText('Fetching best price')).toBeVisible();
  await expect(isolatedPage.getByTestId('trade-input-target')).toHaveValue(/[0-9]/, { timeout: 20000 });
  await isolatedPage.getByRole('button', { name: '50%' }).click();
  await expect(isolatedPage.getByTestId('trade-input-origin')).toHaveValue('5');
  await isolatedPage.getByRole('button', { name: '100%' }).click();
  await expect(isolatedPage.getByTestId('trade-input-origin')).toHaveValue('10');
});

test('An error in the transaction redirects to the error screen', async ({ isolatedPage }) => {
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.waitForTimeout(1000);
  await isolatedPage.getByTestId('trade-input-origin').click();
  await isolatedPage.getByTestId('trade-input-origin').fill('1');
  await isolatedPage.getByRole('button', { name: 'Select token' }).click();
  await isolatedPage.getByRole('button', { name: 'DAI Stablecoin DAI Stablecoin DAI' }).click();
  await isolatedPage.getByRole('button', { name: 'Review trade' }).click();

  // Intercept the tenderly RPC call to reject the transaction. Waits for 200ms for UI to update
  await interceptAndRejectTransactions(isolatedPage, 200);

  await isolatedPage.getByRole('button', { name: 'Confirm trade' }).last().click();

  expect(isolatedPage.getByText('An error occurred while trading your tokens')).toBeVisible();
  expect(isolatedPage.getByRole('button', { name: 'Back' }).last()).toBeVisible();
  expect(isolatedPage.getByRole('button', { name: 'Back' }).last()).toBeEnabled();
  expect(isolatedPage.getByRole('button', { name: 'Retry' }).last()).toBeVisible();
  await expect(isolatedPage.getByRole('button', { name: 'Retry' }).last()).toBeEnabled({ timeout: 15000 });

  await isolatedPage.getByRole('button', { name: 'Retry' }).last().click();

  expect(isolatedPage.getByRole('heading', { name: 'Waiting for confirmation' })).toBeVisible();
  expect(isolatedPage.getByText('An error occurred while trading your tokens')).toBeVisible();
  await isolatedPage.getByRole('button', { name: 'Back' }).last().click();
  await expect(isolatedPage.getByTestId('trade-input-origin')).toBeVisible();
});
