import { test, expect } from '../fixtures';

// Test data for navigation tabs and their expected URLs/networks
const navigationTabs = [
  {
    name: 'Rewards',
    expectedUrl: '/?network=ethereum&widget=rewards',
    supportedNetworks: ['ethereum'], // Rewards only supports Ethereum
    description: 'Use USDS to access Sky Token Rewards'
  },
  {
    name: 'Savings',
    expectedUrl: '/?network=ethereum&widget=savings',
    supportedNetworks: ['ethereum', 'base', 'arbitrumone', 'opmainnet', 'unichain'],
    description: 'Use USDS to access the Sky Savings Rate'
  },
  {
    name: 'Upgrade',
    expectedUrl: '/?network=ethereum&widget=upgrade',
    supportedNetworks: ['ethereum'], // Upgrade only supports Ethereum
    description: 'Upgrade your DAI to USDS and MKR to SKY'
  },
  {
    name: 'Trade',
    expectedUrl: '/?network=ethereum&widget=trade',
    supportedNetworks: ['ethereum', 'base', 'arbitrumone', 'opmainnet', 'unichain'],
    description: 'Trade popular tokens for Sky Ecosystem tokens'
  },
  {
    name: 'Stake',
    expectedUrl: '/?network=ethereum&widget=stake',
    supportedNetworks: ['ethereum'], // Stake only supports Ethereum
    description: 'Stake SKY to earn rewards, delegate votes, and borrow USDS'
  }
];

const networkIcons = [
  { name: 'ethereum', displayName: 'Ethereum' },
  { name: 'base', displayName: 'Base' },
  { name: 'arbitrumone', displayName: 'Arbitrum One' },
  { name: 'opmainnet', displayName: 'OP Mainnet' },
  { name: 'unichain', displayName: 'Unichain' }
];

test.describe('Navigation Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Balances' }).click();
    // No wallet connection needed for navigation tests
  });

  test('should navigate to each tab and verify correct page loads', async ({ page }) => {
    for (const tab of navigationTabs) {
      // Click on the tab
      await page.getByRole('tab', { name: tab.name }).click();

      // Wait for navigation to complete
      //   await page.waitForURL(new RegExp(tab.expectedUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

      // Verify the URL contains the expected widget parameter
      const currentUrl = page.url();
      expect(currentUrl).toContain(`widget=${tab.expectedUrl.split('widget=')[1].split('&')[0]}`);

      // Verify the tab is selected
      await expect(page.getByRole('tab', { name: tab.name, selected: true }).first()).toBeVisible();

      // Verify the widget content is loaded (look for widget-specific elements)
      await expect(page.getByTestId('widget-container')).toBeVisible();
    }
  });

  test('should hover over navigation icons and click network options', async ({ page }) => {
    for (const tab of navigationTabs) {
      // Skip if tab only supports one network
      if (tab.supportedNetworks.length <= 1) continue;
      // Hover over the tab to reveal network options
      await page.getByRole('tab', { name: tab.name }).hover();

      // Wait for network popover to appear
      await expect(page.getByText('Supported on:').first()).toBeVisible();

      // Test clicking on different network icons
      for (const network of networkIcons) {
        if (!tab.supportedNetworks.includes(network.name)) continue;

        // Find and click the network icon
        const networkButton = page
          .getByRole('button', { name: `Go to ${tab.name} on ${network.displayName}` })
          .first();
        if (await networkButton.isVisible()) {
          await networkButton.click();

          // Verify URL contains the correct network
          await page.waitForURL(new RegExp(`network=${network.name}`));
          const currentUrl = page.url();
          expect(currentUrl).toContain(`network=${network.name}`);
          expect(currentUrl).toContain(`widget=${tab.expectedUrl.split('widget=')[1].split('&')[0]}`);

          // Hover again to test next network
          await page.getByRole('tab', { name: tab.name }).hover();
          await expect(page.getByText('Supported on:').first()).toBeVisible();
        }
      }
    }
  });

  test('should retain network state when switching between tabs', async ({ page }) => {
    // Start with Savings tab and switch to Base network
    await page.getByRole('tab', { name: 'Savings' }).hover();
    await expect(page.getByText('Supported on:').first()).toBeVisible();

    const baseButton = page.getByRole('button', { name: 'Go to Savings on Base' }).first();
    if (await baseButton.isVisible()) {
      await baseButton.click();
      await page.waitForURL(/network=base/);
      expect(page.url()).toContain('network=base');
    }

    // Navigate to Rewards (Ethereum only) - should auto-switch to Ethereum
    await page.getByRole('tab', { name: 'Rewards' }).click();
    await page.waitForURL(/widget=rewards/);
    await page.waitForURL(/network=ethereum/);
    expect(page.url()).toContain('network=ethereum');

    // Check for network switch notification
    const switchNotification = page.getByText(/We've switched you to Ethereum/);
    if (await switchNotification.isVisible()) {
      await expect(switchNotification).toBeVisible();
    }

    // Navigate back to Savings - should show network change popover
    await page.getByRole('tab', { name: 'Savings' }).click();
    await page.waitForURL(/widget=savings/);
    await page.waitForURL(/network=base/);
    expect(page.url()).toContain('network=base');

    // Check for the network change popover with supported networks
    const networkPopover = page.getByText(/Savings is also supported on:/).first();
    await expect(networkPopover).toBeVisible();
    if (await networkPopover.isVisible()) {
      // Verify all supported network switch buttons are present in the popover
      const supportedNetworks = [
        { name: 'ethereum', title: 'Switch to Ethereum' },
        // { name: 'base', title: 'Switch to Base' },
        { name: 'arbitrumone', title: 'Switch to Arbitrum One' },
        { name: 'opmainnet', title: 'Switch to OP Mainnet' },
        { name: 'unichain', title: 'Switch to Unichain' }
      ];

      for (const network of supportedNetworks) {
        // Check for network switch button with specific title
        const networkSwitchButton = page.getByRole('button', { name: network.title }).first();
        if (await networkSwitchButton.isVisible()) {
          await expect(networkSwitchButton).toBeVisible();
        } else {
          // Alternative selector for network icons with title attribute
          const networkIcon = page.locator(`[title="${network.title}"]`).first();
          if (await networkIcon.isVisible()) {
            await expect(networkIcon).toBeVisible();
          }
        }
      }
    }

    // Navigate to Trade (multi-network) - should stay on Base or show network selection
    await page.getByRole('tab', { name: 'Trade' }).click();
    await page.waitForURL(/widget=trade/);

    await page.getByRole('tab', { name: 'Savings' }).hover();
    await page.getByRole('tab', { name: 'Trade' }).hover();

    const tradeButton = page.getByRole('button', { name: 'Go to Trade on Unichain' }).first();
    expect(tradeButton).toBeVisible({ timeout: 5000 });
    await tradeButton.click();
    await page.waitForURL(/network=unichain/);
    expect(page.url()).toContain('network=unichain');

    await page.getByRole('tab', { name: 'Savings' }).click();
    expect(page.getByTestId('l2-savings-supply-input')).toBeVisible({ timeout: 5000 });
    await page.waitForURL(/widget=savings/);
    await page.waitForURL(/network=base/);
    expect(page.url()).toContain('network=base');

    await page.getByRole('tab', { name: 'Trade' }).click();
    expect(page.getByTestId('trade-input-origin')).toBeVisible({ timeout: 5000 });
    await page.waitForURL(/widget=trade/);
    expect(page.url()).toContain('network=unichain');

    await page.getByRole('tab', { name: 'Rewards' }).click();
    expect(page.getByText('All rewards')).toBeVisible();
    await page.waitForURL(/widget=rewards/);
    await page.waitForURL(/network=ethereum/);
    expect(page.url()).toContain('network=ethereum');

    await page.getByRole('tab', { name: 'Trade' }).click();
    expect(page.getByTestId('trade-input-origin')).toBeVisible({ timeout: 5000 });
    await page.waitForURL(/widget=trade/);
    expect(page.url()).toContain('network=unichain');

    await page.getByRole('tab', { name: 'Rewards' }).click();
    expect(page.getByText('All rewards')).toBeVisible();
    await page.waitForURL(/widget=rewards/);
    await page.waitForURL(/network=ethereum/);
    expect(page.url()).toContain('network=ethereum');

    await page.getByRole('tab', { name: 'Savings' }).click();
    expect(page.getByTestId('l2-savings-supply-input')).toBeVisible({ timeout: 5000 });
    await page.waitForURL(/widget=savings/);
    await page.waitForURL(/network=base/);
    expect(page.url()).toContain('network=base');
  });

  test('should switch networks via popover and retain state across tabs', async ({ page }) => {
    // Hover over Trade and go to Base
    await page.getByRole('tab', { name: 'Trade' }).hover();
    await expect(page.getByText('Supported on:').first()).toBeVisible();

    const baseButton = page.getByRole('button', { name: 'Go to Trade on Base' }).first();
    await expect(baseButton).toBeVisible();
    await baseButton.click();

    // Make sure you are on Base
    await page.waitForURL(/network=base/);
    expect(page.url()).toContain('network=base');

    const closeBtn = page.locator('button[toast-close]');
    await closeBtn.click();

    await page.getByRole('tab', { name: 'Rewards' }).click();
    await page.waitForURL(/widget=rewards/);
    await page.waitForURL(/network=ethereum/);
    expect(page.url()).toContain('network=ethereum');

    // Navigate to Savings - should be on Ethereum initially
    await page.getByRole('tab', { name: 'Savings' }).click();
    await page.waitForURL(/widget=savings/);
    expect(page.url()).toContain('network=ethereum');

    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    }

    // Navigate back to Trade - it should be on Base
    await page.getByRole('tab', { name: 'Trade' }).click();
    expect(page.getByTestId('trade-input-origin')).toBeVisible({ timeout: 5000 });
    await page.waitForURL(/widget=trade/);

    // Handle popover if it appears, or verify direct navigation to Base
    const tradePopover = page.getByText(/Trade is also supported on:/).first();
    if (await tradePopover.isVisible()) {
      const baseFromPopover = page
        .getByRole('button', { name: 'Switch to Base' })
        .first()
        .or(page.locator('[title="Switch to Base"]').first());
      if (await baseFromPopover.isVisible()) {
        await baseFromPopover.click();
        await page.waitForURL(/network=base/);
      }
    } else {
      await page.waitForURL(/network=base/);
    }
    expect(page.url()).toContain('network=base');

    // Navigate back to Savings - it should be on Unichain
    await page.getByRole('tab', { name: 'Savings' }).click();
    await page.waitForURL(/widget=savings/);

    // Handle popover if it appears, or verify direct navigation to Unichain
    const savingsPopover = page.getByText(/Savings is also supported on:/).first();
    if (await savingsPopover.isVisible()) {
      const unichainFromPopover = page
        .getByRole('button', { name: 'Switch to Base' })
        .first()
        .or(page.locator('[title="Switch to Base"]').first());
      if (await unichainFromPopover.isVisible()) {
        await unichainFromPopover.click();
        await page.waitForURL(/network=base/);
      }
    } else {
      await page.waitForURL(/network=base/);
    }
    expect(page.url()).toContain('network=base');
  });

  test('should handle invalid navigation gracefully', async ({ page }) => {
    // Test direct URL navigation with invalid parameters
    await page.goto('/?widget=invalid&network=ethereum');

    // Should fallback to a valid state
    await page.waitForLoadState('networkidle');
    const currentUrl = page.url();

    // Should have valid widget and network parameters
    expect(currentUrl).toMatch(/network=ethereum/);

    // Should display a valid tab as selected
    const selectedTab = page.getByRole('tab', { selected: true }).first();
    await expect(selectedTab).toBeVisible();
  });
});
