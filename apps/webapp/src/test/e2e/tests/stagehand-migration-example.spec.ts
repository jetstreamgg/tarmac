import { expect, test, hasStagehandCapabilities } from '../stagehand-fixtures';
import { getMinimumOutput } from '../utils/trade';
import { setErc20Balance } from '../utils/setBalance';
import { TENDERLY_CHAIN_ID } from '@/data/wagmi/config/testTenderlyChain';
import { usdtAddress } from '@jetstreamgg/sky-hooks';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms';
import { performAction } from '../utils/stagehand-helpers';

/**
 * This file demonstrates how to migrate existing Playwright tests to use Stagehand
 * while maintaining backward compatibility.
 *
 * The tests will automatically use Stagehand when USE_STAGEHAND=true,
 * and fall back to standard Playwright when it's not enabled.
 */

test.describe('Migrated Trade Tests with Optional Stagehand', () => {
  test.beforeEach(async ({ stagehandPage }) => {
    await stagehandPage.goto('http://localhost:3000/');

    // Connect mock wallet and accept terms for all tests
    await connectMockWalletAndAcceptTerms(stagehandPage);

    // This works with both Stagehand and regular Playwright
    await performAction(stagehandPage, 'Click on the Trade tab', async () => {
      await stagehandPage.getByRole('tab', { name: 'Trade' }).click();
    });
  });

  test('Trade USDT for USDS - Migrated from trade-2.spec.ts', async ({ stagehandPage }) => {
    // Setup remains the same
    await setErc20Balance(usdtAddress[TENDERLY_CHAIN_ID], '1000', 6);

    // Hybrid approach: Use Stagehand when available, fallback to Playwright
    await performAction(stagehandPage, 'Enter 100 in the trade origin input field', async () => {
      await stagehandPage.getByTestId('trade-input-origin').click();
      await stagehandPage.getByTestId('trade-input-origin').fill('100');
    });

    await performAction(stagehandPage, 'Select USDT as the origin token', async () => {
      await stagehandPage.getByTestId('trade-origin-token-selector').click();
      await stagehandPage.getByRole('button', { name: 'Tether USD Tether USD USDT' }).click();
    });

    await performAction(stagehandPage, 'Select USDS as the destination token', async () => {
      await stagehandPage.getByRole('button', { name: 'Select token' }).click();
      await stagehandPage.getByRole('button', { name: 'USDS Stablecoin USDS Stablecoin USDS' }).click();
    });

    // For complex assertions, we can still use standard Playwright
    const outputValue = await stagehandPage.getByTestId('trade-output-target').inputValue();
    expect(Number(outputValue)).toBeGreaterThan(0);

    await performAction(stagehandPage, 'Click Review trade and confirm the transaction', async () => {
      await stagehandPage.getByRole('button', { name: 'Review trade' }).click();
      await stagehandPage.locator('role=button[name="Confirm trade"]').last().click();
    });

    // Add token to wallet
    await performAction(stagehandPage, 'Add USDS token to wallet', async () => {
      await stagehandPage.getByRole('button', { name: 'Add USDS to wallet' }).last().click();
    });
  });

  test('Modify slippage tolerance - Enhanced with AI', async ({ stagehandPage }) => {
    // Setup the trade
    await performAction(stagehandPage, 'Set up a trade of 1 ETH for DAI', async () => {
      await stagehandPage.getByTestId('trade-input-origin').fill('1');
      await stagehandPage.getByRole('button', { name: 'Select token' }).click();
      await stagehandPage.getByRole('button', { name: 'DAI Stablecoin DAI Stablecoin DAI' }).click();
    });

    // Get initial minimum output
    const minimumOutput = await getMinimumOutput(stagehandPage);
    expect(minimumOutput).not.toEqual(0);

    if (hasStagehandCapabilities(stagehandPage)) {
      // With Stagehand, we can use more natural descriptions
      await stagehandPage.act!('Open the trade settings menu');
      await stagehandPage.act!('Change slippage tolerance to 0.1%');

      // AI can help verify the change
      const slippageInfo = await stagehandPage.extract!('What is the current slippage tolerance setting?');
      console.log('AI extracted slippage:', slippageInfo);
    } else {
      // Standard Playwright flow
      const page = stagehandPage as any; // Cast to avoid TypeScript narrowing issues
      await page
        .getByTestId('widget-container')
        .locator('div', { has: page.locator('h2').filter({ hasText: 'Trade' }) })
        .locator('button')
        .first()
        .click();

      await page.getByRole('tab', { name: '0.1%' }).click();
    }

    // Verify the minimum output changed
    const minimumOutputSmallerSlippage = await getMinimumOutput(stagehandPage);
    expect(minimumOutputSmallerSlippage).not.toEqual(0);
    expect(minimumOutputSmallerSlippage).toBeGreaterThan(minimumOutput);
  });

  test('Advanced scenario: Multi-step trading with conditional logic', async ({ stagehandPage }) => {
    if (hasStagehandCapabilities(stagehandPage)) {
      // With Stagehand, we can create more intelligent test scenarios

      // AI can help determine the best trading path
      const marketAnalysis = await stagehandPage.extract!(
        'Analyze the available trading pairs and suggest the best path to convert ETH to USDS'
      );
      console.log('AI Market Analysis:', marketAnalysis);

      // Execute the suggested trading strategy
      await stagehandPage.act!(
        'Execute the most efficient trade to convert 1 ETH to USDS based on available liquidity'
      );

      // Verify the result
      const result = await stagehandPage.extract!(
        'What was the final USDS amount received and what was the actual slippage?'
      );
      console.log('Trade result:', result);
    } else {
      // Standard multi-step trading flow
      const page = stagehandPage as any; // Cast to avoid TypeScript narrowing issues

      // Step 1: Trade ETH for USDS directly if available
      await page.getByTestId('trade-input-origin').fill('1');
      await page.getByRole('button', { name: 'Select token' }).click();

      // Check if USDS is available for direct swap
      const usdsButtons = await page.getByRole('button', { name: /USDS Stablecoin/i }).all();

      if (usdsButtons.length > 0) {
        // Direct swap available
        await usdsButtons[0].click();
      } else {
        // Use intermediate token (DAI)
        await page.getByRole('button', { name: /DAI Stablecoin/i }).click();
      }

      await page.getByRole('button', { name: 'Review trade' }).click();
      await page.getByRole('button', { name: 'Confirm trade' }).last().click();
    }
  });
});
