import { expect, test } from '../fixtures.ts';
import { getMinimumOutput } from '../utils/trade.ts';
import { setErc20Balance, setEthBalance } from '../utils/setBalance.ts';
import { TENDERLY_CHAIN_ID } from '@/data/wagmi/config/testTenderlyChain.ts';
import { usdtAddress } from '@jetstreamgg/sky-hooks';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Trade' }).click();
});

test('Trade ETH for DAI', async ({ page }) => {
  await setEthBalance('10');
  await connectMockWalletAndAcceptTerms(page);
  await page.getByTestId('trade-input-origin').click();
  await page.getByTestId('trade-input-origin').fill('1');
  await page.getByRole('button', { name: 'Select token' }).click();
  await page.getByRole('button', { name: 'DAI Stablecoin DAI Stablecoin DAI' }).click();
  await page.getByRole('button', { name: 'Review trade' }).click();
  // For a brief moment the "Review trade" button changes it's name to "Confirm trade" and then a new button appears with the name "Confirm trade"
  // this second button is the one that should be clicked
  // This may be related with the animations in the button
  // TODO: we need to fix this in the widget and update the test later when there's only one "Confirm trade" button
  await page.locator('role=button[name="Confirm trade"]').last().click(); //TODO: why are there two of these in ci?
  await page.getByRole('button', { name: 'Add DAI to wallet' }).last().click(); //TODO: why are there two of these in ci? maybe because of the same reason as above
});

test('Modify slippage tolerance value', async ({ page }) => {
  await connectMockWalletAndAcceptTerms(page);
  await page.getByTestId('trade-input-origin').click();
  await page.getByTestId('trade-input-origin').fill('1');
  await page.getByRole('button', { name: 'Select token' }).click();
  await page.getByRole('button', { name: 'DAI Stablecoin DAI Stablecoin DAI' }).click();

  const minimumOutput = await getMinimumOutput(page);
  expect(minimumOutput).not.toEqual(0);

  await page
    .getByTestId('widget-container')
    .locator('div', { has: page.locator('h2').filter({ hasText: 'Trade' }) })
    .locator('button')
    .first()
    .click();

  // Reduce slippage and check minimum output is greater than before
  await page.getByRole('tab', { name: '0.1%' }).click();
  const minimumOutputSmallerSlippage = await getMinimumOutput(page);
  expect(minimumOutputSmallerSlippage).not.toEqual(0);
  expect(minimumOutputSmallerSlippage).toBeGreaterThan(minimumOutput);

  // Increase slippage and check minimum output is lower than before
  await page.getByRole('tab', { name: '1%', exact: true }).click();
  const minimumOutputLargerSlippage = await getMinimumOutput(page);
  expect(minimumOutputLargerSlippage).not.toEqual(0);
  expect(minimumOutputLargerSlippage).toBeLessThan(minimumOutput);

  // Reset slippage value
  await page.getByRole('tab', { name: '0.5%' }).click();
});

test('Quote with high price impact', async ({ page }) => {
  await setEthBalance('6000');
  await connectMockWalletAndAcceptTerms(page);
  await page.getByTestId('trade-input-origin').click();
  await page.getByTestId('trade-input-origin').fill('5000');
  await page.getByRole('button', { name: 'Select token' }).click();
  await page.getByRole('button', { name: 'DAI Stablecoin DAI Stablecoin DAI' }).click();

  await expect(page.getByText('Price impact is too high')).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('Insufficient ETH balance.')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Review trade' })).toBeDisabled();
});

test('Trade with insufficient balance', async ({ page }) => {
  await setErc20Balance(usdtAddress[TENDERLY_CHAIN_ID], '10', 6);
  await connectMockWalletAndAcceptTerms(page);
  await page.getByRole('button', { name: 'Ether ETH' }).click();
  await page.getByRole('button', { name: 'Tether USD Tether USD USDT' }).click();
  await page.getByTestId('trade-input-origin').click();
  await page.getByTestId('trade-input-origin').fill('11');
  await page.getByRole('button', { name: 'Select token' }).click();
  await page.getByRole('button', { name: 'DAI Stablecoin DAI Stablecoin DAI' }).click();

  await expect(page.getByText('Insufficient USDT balance.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Review trade' })).toBeDisabled();

  await page.getByTestId('trade-input-target').click();
  await page.getByTestId('trade-input-target').fill('0');

  await expect(page.getByText('Insufficient ETH balance.')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Review trade' })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Enter amount' })).toBeDisabled();

  await page.getByTestId('trade-input-target').click();
  await page.getByTestId('trade-input-target').fill('20');

  await expect(page.getByText('Insufficient USDT balance.')).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('button', { name: 'Review trade' })).toBeDisabled();
});

test('Quote refetches when changing token inputs', async ({ page }) => {
  await setEthBalance('10');
  await connectMockWalletAndAcceptTerms(page);
  await page.getByTestId('trade-input-origin').click();
  await page.getByTestId('trade-input-origin').fill('1');
  await page.getByRole('button', { name: 'Select token' }).click();
  await page.getByRole('button', { name: 'DAI Stablecoin DAI Stablecoin DAI' }).click();

  await expect(page.getByText('Fetching best price')).toBeVisible();
  await expect(page.getByText('Fetching best price')).not.toBeVisible();
  expect(await page.getByTestId('trade-input-target').inputValue()).not.toBe('');

  const firstQuotedAmount = await page.getByTestId('trade-input-target').inputValue();

  await page.getByTestId('trade-input-origin').click();
  await page.getByTestId('trade-input-origin').fill('2');

  await expect(page.getByText('Fetching best price')).toBeVisible();
  await expect(page.getByText('Fetching best price')).not.toBeVisible();
  expect(await page.getByTestId('trade-input-target').inputValue()).not.toBe('0');

  const secondQuotedAmount = await page.getByTestId('trade-input-target').inputValue();

  expect(parseFloat(secondQuotedAmount)).toBeGreaterThan(parseFloat(firstQuotedAmount));

  await page.getByTestId('trade-input-target').click();
  await page.getByTestId('trade-input-target').fill(firstQuotedAmount);

  await expect(page.getByText('Fetching best price')).toBeVisible();
  await expect(page.getByText('Fetching best price')).not.toBeVisible();
  expect(parseFloat(await page.getByTestId('trade-input-origin').inputValue())).toBeGreaterThan(0.99);
  expect(parseFloat(await page.getByTestId('trade-input-origin').inputValue())).toBeLessThan(1.001);
});
