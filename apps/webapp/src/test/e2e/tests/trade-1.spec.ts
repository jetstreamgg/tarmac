import { expect, test } from '../fixtures-parallel';
import { getMinimumOutput } from '../utils/trade.ts';
import { setErc20Balance, setEthBalance } from '../utils/setBalance.ts';
import { NetworkName } from '../utils/constants';
import { TENDERLY_CHAIN_ID } from '@/data/wagmi/config/testTenderlyChain.ts';
import { usdtAddress } from '@jetstreamgg/sky-hooks';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.ts';

test.beforeEach(async ({ isolatedPage }) => {
  await isolatedPage.goto('/');
  await isolatedPage.getByRole('tab', { name: 'Trade' }).click();
});

test('Trade ETH for DAI', async ({ isolatedPage, testAccount }) => {
  await setEthBalance('10', NetworkName.mainnet, testAccount);
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.waitForTimeout(1000);
  await isolatedPage.getByRole('tab', { name: 'Trade' }).click();
  await isolatedPage.getByTestId('trade-input-origin').click();
  await isolatedPage.getByTestId('trade-input-origin').fill('1');
  await isolatedPage.getByRole('button', { name: 'Select token' }).click();
  await isolatedPage.getByRole('button', { name: 'DAI Stablecoin DAI Stablecoin DAI' }).click();
  await isolatedPage.getByRole('button', { name: 'Review trade' }).click();
  // For a brief moment the "Review trade" button changes it's name to "Confirm trade" and then a new button appears with the name "Confirm trade"
  // this second button is the one that should be clicked
  // This may be related with the animations in the button
  // TODO: we need to fix this in the widget and update the test later when there's only one "Confirm trade" button
  await isolatedPage.locator('role=button[name="Confirm trade"]').last().click(); //TODO: why are there two of these in ci?
  await isolatedPage.getByRole('button', { name: 'Add DAI to wallet' }).last().click(); //TODO: why are there two of these in ci? maybe because of the same reason as above
});

test('Modify slipisolatedPage tolerance value', async ({ isolatedPage }) => {
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.waitForTimeout(1000);
  await isolatedPage.getByRole('tab', { name: 'Trade' }).click();
  await isolatedPage.getByTestId('trade-input-origin').click();
  await isolatedPage.getByTestId('trade-input-origin').fill('1');
  await isolatedPage.getByRole('button', { name: 'Select token' }).click();
  await isolatedPage.getByRole('button', { name: 'DAI Stablecoin DAI Stablecoin DAI' }).click();

  const minimumOutput = await getMinimumOutput(isolatedPage);
  expect(minimumOutput).not.toEqual(0);

  await isolatedPage
    .getByTestId('widget-container')
    .locator('div', { has: isolatedPage.locator('h2').filter({ hasText: 'Trade' }) })
    .locator('button')
    .first()
    .click();

  // Reduce slipisolatedPage and check minimum output is greater than before
  await isolatedPage.getByRole('tab', { name: '0.1%' }).click();
  const minimumOutputSmallerSlipisolatedPage = await getMinimumOutput(isolatedPage);
  expect(minimumOutputSmallerSlipisolatedPage).not.toEqual(0);
  expect(minimumOutputSmallerSlipisolatedPage).toBeGreaterThan(minimumOutput);

  // Increase slipisolatedPage and check minimum output is lower than before
  await isolatedPage.getByRole('tab', { name: '1%', exact: true }).click();
  const minimumOutputLargerSlipisolatedPage = await getMinimumOutput(isolatedPage);
  expect(minimumOutputLargerSlipisolatedPage).not.toEqual(0);
  expect(minimumOutputLargerSlipisolatedPage).toBeLessThan(minimumOutput);

  // Reset slipisolatedPage value
  await isolatedPage.getByRole('tab', { name: '0.5%' }).click();
});

test('Quote with high price impact', async ({ isolatedPage, testAccount }) => {
  await setEthBalance('6000', NetworkName.mainnet, testAccount);
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.waitForTimeout(1000);
  await isolatedPage.getByRole('tab', { name: 'Trade' }).click();
  await isolatedPage.getByTestId('trade-input-origin').click();
  await isolatedPage.getByTestId('trade-input-origin').fill('5000');
  await isolatedPage.getByRole('button', { name: 'Select token' }).click();
  await isolatedPage.getByRole('button', { name: 'DAI Stablecoin DAI Stablecoin DAI' }).click();

  await expect(isolatedPage.getByText('Price impact is too high')).toBeVisible({ timeout: 30000 });
  await expect(isolatedPage.getByText('Insufficient ETH balance.')).not.toBeVisible();
  await expect(isolatedPage.getByRole('button', { name: 'Review trade' })).toBeDisabled();
});

test('Trade with insufficient balance', async ({ isolatedPage, testAccount }) => {
  await setErc20Balance(usdtAddress[TENDERLY_CHAIN_ID], '10', 6, NetworkName.mainnet, testAccount);
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.waitForTimeout(1000);
  await isolatedPage.getByRole('tab', { name: 'Trade' }).click();
  await isolatedPage.getByRole('button', { name: 'Ether ETH' }).click();
  await isolatedPage.getByRole('button', { name: 'Tether USD Tether USD USDT' }).click();
  await isolatedPage.getByTestId('trade-input-origin').click();
  await isolatedPage.getByTestId('trade-input-origin').fill('11');
  await isolatedPage.getByRole('button', { name: 'Select token' }).click();
  await isolatedPage.getByRole('button', { name: 'DAI Stablecoin DAI Stablecoin DAI' }).click();

  await expect(isolatedPage.getByText('Insufficient USDT balance.')).toBeVisible();
  await expect(isolatedPage.getByRole('button', { name: 'Review trade' })).toBeDisabled();

  await isolatedPage.getByTestId('trade-input-target').click();
  await isolatedPage.getByTestId('trade-input-target').fill('0');

  await expect(isolatedPage.getByText('Insufficient ETH balance.')).not.toBeVisible();
  await expect(isolatedPage.getByRole('button', { name: 'Review trade' })).not.toBeVisible();
  await expect(isolatedPage.getByRole('button', { name: 'Enter amount' })).toBeDisabled();

  await isolatedPage.getByTestId('trade-input-target').click();
  await isolatedPage.getByTestId('trade-input-target').fill('20');

  await expect(isolatedPage.getByText('Insufficient USDT balance.')).toBeVisible({ timeout: 20000 });
  await expect(isolatedPage.getByRole('button', { name: 'Review trade' })).toBeDisabled();
});

test('Quote refetches when changing token inputs', async ({ isolatedPage, testAccount }) => {
  await setEthBalance('10', NetworkName.mainnet, testAccount);
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.waitForTimeout(1000);
  await isolatedPage.getByRole('tab', { name: 'Trade' }).click();
  await isolatedPage.getByTestId('trade-input-origin').click();
  await isolatedPage.getByTestId('trade-input-origin').fill('1');
  await isolatedPage.getByRole('button', { name: 'Select token' }).click();
  await isolatedPage.getByRole('button', { name: 'DAI Stablecoin DAI Stablecoin DAI' }).click();

  await expect(isolatedPage.getByText('Fetching best price')).toBeVisible();
  await expect(isolatedPage.getByText('Fetching best price')).not.toBeVisible();
  expect(await isolatedPage.getByTestId('trade-input-target').inputValue()).not.toBe('');

  const firstQuotedAmount = await isolatedPage.getByTestId('trade-input-target').inputValue();

  await isolatedPage.getByTestId('trade-input-origin').click();
  await isolatedPage.getByTestId('trade-input-origin').fill('2');

  await expect(isolatedPage.getByText('Fetching best price')).toBeVisible();
  await expect(isolatedPage.getByText('Fetching best price')).not.toBeVisible();
  expect(await isolatedPage.getByTestId('trade-input-target').inputValue()).not.toBe('0');

  const secondQuotedAmount = await isolatedPage.getByTestId('trade-input-target').inputValue();

  expect(parseFloat(secondQuotedAmount)).toBeGreaterThan(parseFloat(firstQuotedAmount));

  await isolatedPage.getByTestId('trade-input-target').click();
  await isolatedPage.getByTestId('trade-input-target').fill(firstQuotedAmount);

  await expect(isolatedPage.getByText('Fetching best price')).toBeVisible();
  await expect(isolatedPage.getByText('Fetching best price')).not.toBeVisible();
  expect(parseFloat(await isolatedPage.getByTestId('trade-input-origin').inputValue())).toBeGreaterThan(0.99);
  expect(parseFloat(await isolatedPage.getByTestId('trade-input-origin').inputValue())).toBeLessThan(1.001);
});
