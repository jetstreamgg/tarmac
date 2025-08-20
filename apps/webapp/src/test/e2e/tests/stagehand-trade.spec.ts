import { expect, test, hasStagehandCapabilities } from '../stagehand-fixtures';
import { setEthBalance, setErc20Balance } from '../utils/setBalance';
import { TENDERLY_CHAIN_ID } from '@/data/wagmi/config/testTenderlyChain';
import { usdsAddress, skyAddress } from '@jetstreamgg/sky-hooks';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms';
import { createDeFiActions } from '../utils/stagehand-helpers';

test.describe('Trade with Stagehand AI capabilities', () => {
  test.beforeEach(async ({ stagehandPage }) => {
    await stagehandPage.goto('http://localhost:3000/');

    // Connect mock wallet and accept terms for all tests
    await connectMockWalletAndAcceptTerms(stagehandPage);

    await stagehandPage.getByRole('tab', { name: 'Trade' }).click();
  });

  test('Trade ETH for DAI using natural language', async ({ stagehandPage }) => {
    // Set up test wallet with ETH
    await setEthBalance('10');

    if (hasStagehandCapabilities(stagehandPage)) {
      // Use Stagehand's natural language capabilities
      await stagehandPage.act!('Enter 1 ETH in the trade input field');
      await stagehandPage.act!('Select DAI as the token to receive');

      // Extract information about the trade
      const tradeDetails = await stagehandPage.extract!('Get the expected output amount for DAI');
      console.log('Expected DAI output:', tradeDetails);

      // Complete the trade
      await stagehandPage.act!('Click the Review trade button');
      await stagehandPage.act!('Confirm the trade');

      // Verify success
      await stagehandPage.act!('Add DAI token to wallet');
    } else {
      // Fallback to standard Playwright actions
      const page = stagehandPage as any;
      await page.getByTestId('trade-input-origin').fill('1');
      await page.getByRole('button', { name: 'Select token' }).click();
      await page.getByRole('button', { name: 'DAI Stablecoin DAI Stablecoin DAI' }).click();
      await page.getByRole('button', { name: 'Review trade' }).click();
      await page.locator('role=button[name="Confirm trade"]').last().click();
      await page.getByRole('button', { name: 'Add DAI to wallet' }).last().click();
    }
  });

  test('Complex trading scenario with AI assistance', async ({ stagehandPage }) => {
    // Set up test wallet with multiple tokens
    await setEthBalance('10');
    await setErc20Balance(usdsAddress[TENDERLY_CHAIN_ID], '1000', 18);
    await setErc20Balance(skyAddress[TENDERLY_CHAIN_ID], '5000', 18);

    const defi = createDeFiActions(stagehandPage);

    if (hasStagehandCapabilities(stagehandPage)) {
      // Use AI to understand the current market state
      const marketInfo = await stagehandPage.extract!(
        'What tokens are available for trading and what are their current balances?'
      );
      console.log('Market info:', marketInfo);

      // Perform a complex trading sequence
      await stagehandPage.act!('Trade 100 USDS for SKY tokens');

      // Wait for transaction
      await stagehandPage.waitForTimeout(2000);

      // Check the result
      const newBalance = await stagehandPage.extract!('What is my new SKY balance?');
      console.log('New SKY balance:', newBalance);

      // Analyze slippage settings
      await stagehandPage.act!('Open the slippage settings');
      await stagehandPage.act!('Set slippage tolerance to 0.5%');

      // Verify the change
      const slippageInfo = await stagehandPage.extract!('What is the current slippage tolerance?');
      expect(slippageInfo).toContain('0.5');
    } else {
      // Standard Playwright flow
      const page = stagehandPage as any;
      await defi.swapTokens('100', 'USDS', 'SKY');

      // Check slippage settings manually
      await page
        .getByTestId('widget-container')
        .locator('div', { has: page.locator('h2').filter({ hasText: 'Trade' }) })
        .locator('button')
        .first()
        .click();

      await page.getByRole('tab', { name: '0.5%' }).click();
    }
  });

  test('AI-assisted token discovery and trading', async ({ stagehandPage }) => {
    await setEthBalance('10');

    if (hasStagehandCapabilities(stagehandPage)) {
      // Use AI to discover available tokens
      await stagehandPage.act!('Open the token selection modal');

      const availableTokens = await stagehandPage.extract!('List all available tokens for trading');
      console.log('Available tokens:', availableTokens);

      // Ask AI to find the best stablecoin option
      await stagehandPage.act!('Select the most liquid stablecoin available');

      // Let AI handle the trade flow
      await stagehandPage.act!('Trade 0.5 ETH for the selected stablecoin with optimal settings');

      // Verify the transaction
      const txStatus = await stagehandPage.extract!('What is the status of the transaction?');
      console.log('Transaction status:', txStatus);
    } else {
      // Manual token discovery
      const page = stagehandPage as any;
      await page.getByRole('button', { name: 'Select token' }).click();

      // Look for USDS as it's the primary stablecoin
      const usdsButton = page.getByRole('button', { name: /USDS/i });
      const isUsdsAvailable = await usdsButton.isVisible();

      if (isUsdsAvailable) {
        await usdsButton.click();
      } else {
        // Fallback to DAI
        await page.getByRole('button', { name: /DAI/i }).click();
      }

      await page.getByTestId('trade-input-origin').fill('0.5');
      await page.getByRole('button', { name: 'Review trade' }).click();
      await page.getByRole('button', { name: 'Confirm trade' }).last().click();
    }
  });
});
