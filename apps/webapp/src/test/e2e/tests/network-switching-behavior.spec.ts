import { expect, test } from '../fixtures.ts';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.ts';
import type { Page } from '@playwright/test';

/**
 * E2E tests for network switching behavior
 * Verifies the "Stay Where You Are" approach (Option 3)
 *
 * Expected behavior:
 * - Network only switches when forced (mainnet-only widgets)
 * - Otherwise, user stays on current network
 * - No automatic restoration of previous networks
 */

// Helper function to verify current network displayed in the UI
const expectCurrentNetwork = async (page: Page, networkName: string) => {
  await expect(page.getByTestId('chain-modal-trigger-header')).toHaveText(networkName);
};

// Helper function to navigate to a widget by name
const navigateToWidget = async (page: Page, widgetName: string) => {
  await page.getByRole('tab', { name: widgetName }).click();
  // Wait for navigation to complete
  await page.waitForTimeout(500);
};

// Helper function to switch network manually
const switchNetwork = async (page: Page, networkName: string) => {
  await page.getByTestId('chain-modal-trigger-header').click();
  await page.getByRole('button', { name: networkName }).click();
  // Wait for network switch to complete
  await page.waitForTimeout(1000);
};

test.describe('Network Switching Behavior - "Stay Where You Are"', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await connectMockWalletAndAcceptTerms(page);
  });

  test('Should stay on mainnet after forced switch from L2', async ({ page }) => {
    // Start on Savings (multichain) on Arbitrum
    await navigateToWidget(page, 'Savings');
    await switchNetwork(page, 'Tenderly Arbitrum');
    await expectCurrentNetwork(page, 'Tenderly Arbitrum');

    // Go to Upgrade (mainnet-only) - should force switch to mainnet
    await navigateToWidget(page, 'Upgrade');
    await expectCurrentNetwork(page, 'Tenderly Mainnet');

    // Go to Trade (multichain) - should STAY on mainnet (not return to Arbitrum)
    await navigateToWidget(page, 'Trade');
    await expectCurrentNetwork(page, 'Tenderly Mainnet');

    // Go back to Savings - should still be on mainnet
    await navigateToWidget(page, 'Savings');
    await expectCurrentNetwork(page, 'Tenderly Mainnet');
  });

  test('Should NOT remember previous network for each widget', async ({ page }) => {
    // Set Trade to Base
    await navigateToWidget(page, 'Trade');
    await switchNetwork(page, 'Tenderly Base');
    await expectCurrentNetwork(page, 'Tenderly Base');

    // Set Savings to Arbitrum
    await navigateToWidget(page, 'Savings');
    await switchNetwork(page, 'Tenderly Arbitrum');
    await expectCurrentNetwork(page, 'Tenderly Arbitrum');

    // Go back to Trade - should stay on Arbitrum (not return to Base)
    await navigateToWidget(page, 'Trade');
    await expectCurrentNetwork(page, 'Tenderly Arbitrum');

    // Switch to Unichain on Trade
    await switchNetwork(page, 'Tenderly Unichain');
    await expectCurrentNetwork(page, 'Tenderly Unichain');

    // Go back to Savings - should stay on Unichain (not return to Arbitrum)
    await navigateToWidget(page, 'Savings');
    await expectCurrentNetwork(page, 'Tenderly Unichain');
  });

  test('Manual network switch should persist across widget navigation', async ({ page }) => {
    // Start on Trade on mainnet
    await navigateToWidget(page, 'Trade');
    await expectCurrentNetwork(page, 'Tenderly Mainnet');

    // Manually switch to Optimism
    await switchNetwork(page, 'Tenderly Optimism');
    await expectCurrentNetwork(page, 'Tenderly Optimism');

    // Navigate through multiple widgets - should stay on Optimism
    await navigateToWidget(page, 'Savings');
    await expectCurrentNetwork(page, 'Tenderly Optimism');

    await navigateToWidget(page, 'Balances');
    await expectCurrentNetwork(page, 'Tenderly Optimism');

    await navigateToWidget(page, 'Trade');
    await expectCurrentNetwork(page, 'Tenderly Optimism');
  });

  test('Mainnet-only widgets should force switch from L2', async ({ page }) => {
    const mainnetOnlyWidgets = ['Upgrade', 'Stake', 'Rewards'];

    for (const widget of mainnetOnlyWidgets) {
      // Start on Trade with an L2 network
      await navigateToWidget(page, 'Trade');
      await switchNetwork(page, 'Tenderly Base');
      await expectCurrentNetwork(page, 'Tenderly Base');

      // Navigate to mainnet-only widget - should force to mainnet
      await navigateToWidget(page, widget);
      await expectCurrentNetwork(page, 'Tenderly Mainnet');
    }
  });

  test('Complex user journey maintains "stay where you are" behavior', async ({ page }) => {
    // User starts on Savings (Arbitrum)
    await navigateToWidget(page, 'Savings');
    await switchNetwork(page, 'Tenderly Arbitrum');
    await expectCurrentNetwork(page, 'Tenderly Arbitrum');

    // Goes to Upgrade - forced to Mainnet
    await navigateToWidget(page, 'Upgrade');
    await expectCurrentNetwork(page, 'Tenderly Mainnet');

    // Goes to Trade - stays on Mainnet
    await navigateToWidget(page, 'Trade');
    await expectCurrentNetwork(page, 'Tenderly Mainnet');

    // Manually switches to Unichain
    await switchNetwork(page, 'Tenderly Unichain');
    await expectCurrentNetwork(page, 'Tenderly Unichain');

    // Goes to Savings - stays on Unichain
    await navigateToWidget(page, 'Savings');
    await expectCurrentNetwork(page, 'Tenderly Unichain');

    // Goes to Stake - forced to Mainnet
    await navigateToWidget(page, 'Stake');
    await expectCurrentNetwork(page, 'Tenderly Mainnet');

    // Goes back to Savings - stays on Mainnet (not Unichain)
    await navigateToWidget(page, 'Savings');
    await expectCurrentNetwork(page, 'Tenderly Mainnet');
  });

  test('Should NOT restore previous network when returning to widget (negative test)', async ({ page }) => {
    // This test specifically verifies the old behavior doesn't happen

    // Set up scenario where old behavior would restore network
    await navigateToWidget(page, 'Trade');
    await switchNetwork(page, 'Tenderly Base');
    await expectCurrentNetwork(page, 'Tenderly Base');

    // Go to mainnet-only widget
    await navigateToWidget(page, 'Upgrade');
    await expectCurrentNetwork(page, 'Tenderly Mainnet');

    // Return to Trade - OLD behavior would restore Base, NEW stays on Mainnet
    await navigateToWidget(page, 'Trade');
    await expectCurrentNetwork(page, 'Tenderly Mainnet');
    // Explicitly verify it's NOT Base
    await expect(page.getByTestId('chain-modal-trigger-header')).not.toHaveText('Tenderly Base');
  });

  test('L2 to L2 navigation preserves current network', async ({ page }) => {
    // Start on Trade with Base
    await navigateToWidget(page, 'Trade');
    await switchNetwork(page, 'Tenderly Base');
    await expectCurrentNetwork(page, 'Tenderly Base');

    // Navigate to Savings - should stay on Base
    await navigateToWidget(page, 'Savings');
    await expectCurrentNetwork(page, 'Tenderly Base');

    // Navigate to Balances - should stay on Base
    await navigateToWidget(page, 'Balances');
    await expectCurrentNetwork(page, 'Tenderly Base');

    // Navigate back to Trade - should still be on Base
    await navigateToWidget(page, 'Trade');
    await expectCurrentNetwork(page, 'Tenderly Base');
  });

  test('Switching between mainnet-only widgets keeps mainnet', async ({ page }) => {
    // Start on a mainnet-only widget
    await navigateToWidget(page, 'Upgrade');
    await expectCurrentNetwork(page, 'Tenderly Mainnet');

    // Switch to another mainnet-only widget
    await navigateToWidget(page, 'Stake');
    await expectCurrentNetwork(page, 'Tenderly Mainnet');

    // And another
    await navigateToWidget(page, 'Rewards');
    await expectCurrentNetwork(page, 'Tenderly Mainnet');

    // Network should remain on mainnet throughout
    await expectCurrentNetwork(page, 'Tenderly Mainnet');
  });

  test('URL parameter respects stay where you are behavior', async ({ page }) => {
    // Start with Trade on Arbitrum via URL
    await page.goto('/?network=tenderlyarbitrum&widget=trade');
    await connectMockWalletAndAcceptTerms(page);
    await expectCurrentNetwork(page, 'Tenderly Arbitrum');

    // Navigate to Savings - should stay on Arbitrum
    await navigateToWidget(page, 'Savings');
    await expectCurrentNetwork(page, 'Tenderly Arbitrum');
    expect(page.url()).toContain('network=tenderlyarbitrum');

    // Navigate to Upgrade - should force to mainnet
    await navigateToWidget(page, 'Upgrade');
    await expectCurrentNetwork(page, 'Tenderly Mainnet');
    expect(page.url()).toContain('network=tenderlymainnet');

    // Navigate back to Trade - should stay on mainnet
    await navigateToWidget(page, 'Trade');
    await expectCurrentNetwork(page, 'Tenderly Mainnet');
    expect(page.url()).toContain('network=tenderlymainnet');
  });

  test('Rapid widget switching maintains network state correctly', async ({ page }) => {
    // Start on Base
    await navigateToWidget(page, 'Trade');
    await switchNetwork(page, 'Tenderly Base');

    // Rapidly switch between widgets
    await navigateToWidget(page, 'Savings');
    await navigateToWidget(page, 'Trade');
    await navigateToWidget(page, 'Balances');
    await navigateToWidget(page, 'Savings');

    // Should still be on Base
    await expectCurrentNetwork(page, 'Tenderly Base');

    // Now go to mainnet-only widget
    await navigateToWidget(page, 'Upgrade');
    await expectCurrentNetwork(page, 'Tenderly Mainnet');

    // Rapidly switch between multichain widgets
    await navigateToWidget(page, 'Trade');
    await navigateToWidget(page, 'Savings');
    await navigateToWidget(page, 'Balances');

    // Should still be on Mainnet (not Base)
    await expectCurrentNetwork(page, 'Tenderly Mainnet');
  });
});
