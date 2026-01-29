import { expect, test } from '../fixtures-parallel.ts';
import { performAction } from '../utils/approveOrPerformAction';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.ts';
import { Page } from '@playwright/test';

// Morpho vault address on mainnet
const USDS_RISK_CAPITAL_VAULT_ADDRESS = '0xf42bca228D9bd3e2F8EE65Fec3d21De1063882d4';

// Helper to create mock Merkl API response with rewards
const createMockMerklRewardsResponse = (userAddress: string, vaultAddress: string) => [
  {
    chain: {
      endOfDisputePeriod: Math.floor(Date.now() / 1000) + 3600,
      id: 1,
      name: 'Ethereum',
      icon: 'https://example.com/eth.png',
      liveCampaigns: 1
    },
    rewards: [
      {
        root: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        distributionChainId: 1,
        recipient: userAddress,
        amount: '2650000000000000000', // 2.65 MORPHO (18 decimals)
        claimed: '0',
        pending: '2650000000000000000',
        proofs: [
          '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
        ],
        token: {
          address: '0x9994E35Db50125E0DF82e4c2dde62496CE330999',
          chainId: 1,
          symbol: 'MORPHO',
          decimals: 18,
          price: 2.5
        },
        breakdowns: [
          {
            root: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            distributionChainId: 1,
            reason: `MorphoVault ${vaultAddress}`,
            amount: '2650000000000000000',
            claimed: '0',
            pending: '2650000000000000000',
            campaignId: 'campaign-123',
            subCampaignId: 'sub-123'
          }
        ]
      }
    ]
  }
];

// Helper to mock Merkl API with rewards
const mockMerklApiWithRewards = async (page: Page, userAddress: string) => {
  await page.route('**/api.merkl.xyz/v4/users/**/rewards**', route => {
    const mockResponse = createMockMerklRewardsResponse(userAddress, USDS_RISK_CAPITAL_VAULT_ADDRESS);
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockResponse)
    });
  });
};

// Helper to mock Merkl API with no rewards
const mockMerklApiWithNoRewards = async (page: Page) => {
  await page.route('**/api.merkl.xyz/v4/users/**/rewards**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          chain: {
            endOfDisputePeriod: Math.floor(Date.now() / 1000) + 3600,
            id: 1,
            name: 'Ethereum',
            icon: 'https://example.com/eth.png',
            liveCampaigns: 0
          },
          rewards: []
        }
      ])
    });
  });
};

// Helper to check for supply success message
const expectSupplySuccess = async (isolatedPage: any, amount: string) => {
  const successMessage = isolatedPage.getByText(`You've supplied ${amount} USDS to the Morpho Vault`);
  await expect(successMessage).toBeVisible({ timeout: 30000 });
};

// Helper to check for withdraw success message
const expectWithdrawSuccess = async (isolatedPage: any, amount: string) => {
  const successMessage = isolatedPage.getByText(`You've withdrawn ${amount} USDS from the Morpho Vault.`);
  await expect(successMessage).toBeVisible({ timeout: 30000 });
};

test.describe('Expert Module - Morpho Vault', () => {
  test.beforeEach(async ({ isolatedPage }) => {
    await isolatedPage.goto('/');
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
    // Navigate to Expert module
    await isolatedPage.getByRole('tab', { name: 'Expert' }).click();
    // Navigate to Morpho Vault module
    await isolatedPage.getByTestId('morpho-vault-stats-card').click();
  });

  test('Navigate back to Expert menu', async ({ isolatedPage }) => {
    // Click back button
    await isolatedPage.getByRole('button', { name: 'Back to Expert' }).click();

    // Should be back at Expert menu
    await expect(isolatedPage.getByRole('heading', { name: 'Expert', exact: true })).toBeVisible();
    await expect(isolatedPage.getByTestId('morpho-vault-stats-card')).toBeVisible();

    // Should display expert risk disclaimer
    await expect(isolatedPage.getByTestId('expert-risk-disclaimer').first()).toBeVisible();
  });

  test('Supply USDS to Morpho Vault', async ({ isolatedPage }) => {
    // Should be on Supply tab by default
    await expect(isolatedPage.getByRole('tab', { name: 'Supply', selected: true })).toBeVisible();

    // Expand Vault info to check initial balance
    const vaultInfoAccordion = isolatedPage.getByRole('button', { name: 'Vault info' });
    await vaultInfoAccordion.click();

    // Verify initial supplied balance is 0 or "--"
    const initialBalance = isolatedPage.getByTestId('vault-balance');
    await expect(initialBalance.or(isolatedPage.getByText('--'))).toBeVisible();

    // Check transaction overview is not visible initially
    await expect(isolatedPage.getByRole('button', { name: 'Transaction overview' })).not.toBeVisible();

    // Enter amount to supply
    await isolatedPage.getByTestId('supply-input-morpho').click();
    await isolatedPage.getByTestId('supply-input-morpho').fill('10');

    // Transaction overview should now be visible
    await expect(isolatedPage.getByRole('button', { name: 'Transaction overview' })).toBeVisible();
    await expect(isolatedPage.getByText('You will supply')).toBeVisible();
    await expect(isolatedPage.getByText('10 USDS')).toBeVisible();

    // Check the disclaimer checkbox (required for Morpho vault supply)
    const disclaimer = isolatedPage.locator('label').filter({ hasText: 'I understand that' });
    await disclaimer.click();

    // Perform the supply action (handles approval if needed)
    await performAction(isolatedPage, 'Supply');

    // Check success message
    await expectSupplySuccess(isolatedPage, '10');

    // Click back to Morpho Vault
    await isolatedPage
      .getByRole('button', { name: /Back to USDS Risk Capital/i })
      .first()
      .click();

    // Should still be in Morpho Vault module
    await expect(isolatedPage.getByTestId('supply-input-morpho')).toBeVisible();

    // Verify supplied balance increased to ~10 USDS
    await expect(isolatedPage.getByTestId('vault-balance')).toContainText('10 USDS');
  });

  test('Withdraw USDS from Morpho Vault', async ({ isolatedPage }) => {
    // First supply some USDS
    await isolatedPage.getByTestId('supply-input-morpho').click();
    await isolatedPage.getByTestId('supply-input-morpho').fill('20');

    // Check the disclaimer checkbox
    const disclaimer = isolatedPage.locator('label').filter({ hasText: 'I understand that' });
    await disclaimer.click();

    await performAction(isolatedPage, 'Supply');
    await isolatedPage
      .getByRole('button', { name: /Back to USDS Risk Capital/i })
      .first()
      .click();

    // Expand Vault info and verify balance after supply is ~20 USDS
    const vaultInfoAccordion = isolatedPage.getByRole('button', { name: 'Vault info' });
    await vaultInfoAccordion.click();
    await expect(isolatedPage.getByTestId('vault-balance')).toContainText('20 USDS');

    // Switch to Withdraw tab
    await isolatedPage.getByRole('tab', { name: 'Withdraw' }).click();

    // Enter withdrawal amount
    await isolatedPage.getByTestId('withdraw-input-morpho').click();
    await isolatedPage.getByTestId('withdraw-input-morpho').fill('5');

    // Check transaction overview
    await expect(isolatedPage.getByRole('button', { name: 'Transaction overview' })).toBeVisible();
    await expect(isolatedPage.getByText('You will withdraw')).toBeVisible();
    await expect(isolatedPage.getByText('5 USDS').first()).toBeVisible();

    // Perform withdrawal
    await performAction(isolatedPage, 'Withdraw');

    // Check success message
    await expectWithdrawSuccess(isolatedPage, '5');

    // Click back to Morpho Vault
    await isolatedPage
      .getByRole('button', { name: /Back to USDS Risk Capital/i })
      .first()
      .click();

    // Verify supplied balance decreased to ~15 USDS (20 - 5)
    await expect(isolatedPage.getByTestId('vault-balance')).toContainText('15 USDS');
  });

  test('Use max button for supply', async ({ isolatedPage }) => {
    // Click max button
    await isolatedPage.getByTestId('supply-input-morpho-max').click();

    // Check that input is filled with balance
    const inputValue = await isolatedPage.getByTestId('supply-input-morpho').inputValue();
    expect(parseFloat(inputValue)).toBe(900);

    // Transaction overview should be visible
    await expect(isolatedPage.getByRole('button', { name: 'Transaction overview' })).toBeVisible();
  });

  test('Use max button for withdrawal', async ({ isolatedPage }) => {
    // First supply some USDS
    await isolatedPage.getByTestId('supply-input-morpho').click();
    await isolatedPage.getByTestId('supply-input-morpho').fill('30');

    // Check the disclaimer checkbox
    const disclaimer = isolatedPage.locator('label').filter({ hasText: 'I understand that' });
    await disclaimer.click();

    await performAction(isolatedPage, 'Supply');
    await isolatedPage
      .getByRole('button', { name: /Back to USDS Risk Capital/i })
      .first()
      .click();

    // Switch to Withdraw tab
    await isolatedPage.getByRole('tab', { name: 'Withdraw' }).click();

    // Click max button
    await isolatedPage.getByTestId('withdraw-input-morpho-max').click();

    // Check that input is filled with correct amount (should be approximately what was supplied)
    const inputValue = await isolatedPage.getByTestId('withdraw-input-morpho').inputValue();
    expect(parseFloat(inputValue)).toBeGreaterThanOrEqual(29);
  });

  test('Supply with insufficient USDS balance shows error', async ({ isolatedPage }) => {
    // Try to supply more than balance
    await isolatedPage.getByTestId('supply-input-morpho').click();
    await isolatedPage.getByTestId('supply-input-morpho').fill('905');

    // Should show insufficient funds error
    await expect(isolatedPage.getByText('Insufficient funds')).toBeVisible();

    // Review button should be disabled
    const reviewButton = isolatedPage.getByTestId('widget-button');
    await expect(reviewButton).toHaveText('Review');
    await expect(reviewButton).toBeDisabled();
  });

  test('Withdraw with insufficient vault balance shows error', async ({ isolatedPage }) => {
    // Switch to Withdraw tab
    await isolatedPage.getByRole('tab', { name: 'Withdraw' }).click();

    // Try to withdraw with no supplied balance
    await isolatedPage.getByTestId('withdraw-input-morpho').click();
    await isolatedPage.getByTestId('withdraw-input-morpho').fill('100');

    // Should show insufficient funds error
    await expect(isolatedPage.getByText('Insufficient funds')).toBeVisible();

    // Review button should be disabled
    const reviewButton = isolatedPage.getByTestId('widget-button');
    await expect(reviewButton).toHaveText('Review');
    await expect(reviewButton).toBeDisabled();
  });

  test('Transaction overview updates when amount changes', async ({ isolatedPage }) => {
    // Enter first amount
    await isolatedPage.getByTestId('supply-input-morpho').click();
    await isolatedPage.getByTestId('supply-input-morpho').fill('10');
    await expect(isolatedPage.getByText('10 USDS')).toBeVisible();

    // Change amount
    await isolatedPage.getByTestId('supply-input-morpho').fill('25');
    await expect(isolatedPage.getByText('25 USDS')).toBeVisible();

    // Clear amount - transaction overview should disappear
    await isolatedPage.getByTestId('supply-input-morpho').clear();
    await expect(isolatedPage.getByRole('button', { name: 'Transaction overview' })).not.toBeVisible();
  });

  test('Transaction overview shows correct balance calculations for supply', async ({ isolatedPage }) => {
    // Get initial wallet balance by clicking max and reading the value
    await isolatedPage.getByTestId('supply-input-morpho-max').click();
    const initialWalletBalance = parseFloat(
      await isolatedPage.getByTestId('supply-input-morpho').inputValue()
    );

    // Clear and enter a specific supply amount
    const supplyAmount = 100;
    await isolatedPage.getByTestId('supply-input-morpho').fill(supplyAmount.toString());

    // Expand transaction overview
    await isolatedPage.getByRole('button', { name: 'Transaction overview' }).click();

    // Verify "You will supply" shows correct amount
    await expect(isolatedPage.getByText('You will supply')).toBeVisible();
    await expect(isolatedPage.getByText(`${supplyAmount} USDS`)).toBeVisible();

    // Calculate expected final wallet balance
    const expectedFinalWalletBalance = initialWalletBalance - supplyAmount;

    // Verify wallet balance shows correct before → after
    await expect(isolatedPage.getByText('Your wallet USDS balance')).toBeVisible();
    await expect(isolatedPage.getByText(initialWalletBalance.toString()).first()).toBeVisible();
    await expect(isolatedPage.getByText(expectedFinalWalletBalance.toString()).first()).toBeVisible();

    // Verify vault balance shows correct before → after (0 → supplyAmount)
    await expect(isolatedPage.getByText('Your vault USDS balance')).toBeVisible();
  });

  test('Transaction overview shows correct balance calculations for withdraw', async ({ isolatedPage }) => {
    // First supply some USDS
    const supplyAmount = 50;
    await isolatedPage.getByTestId('supply-input-morpho').click();
    await isolatedPage.getByTestId('supply-input-morpho').fill(supplyAmount.toString());

    // Check the disclaimer checkbox
    const disclaimer = isolatedPage.locator('label').filter({ hasText: 'I understand that' });
    await disclaimer.click();

    await performAction(isolatedPage, 'Supply');
    await isolatedPage
      .getByRole('button', { name: /Back to USDS Risk Capital/i })
      .first()
      .click();

    // Get current wallet balance by clicking max on supply tab
    await isolatedPage.getByTestId('supply-input-morpho-max').click();
    const walletBalanceAfterSupply = parseFloat(
      await isolatedPage.getByTestId('supply-input-morpho').inputValue()
    );
    await isolatedPage.getByTestId('supply-input-morpho').clear();

    // Switch to Withdraw tab
    await isolatedPage.getByRole('tab', { name: 'Withdraw' }).click();

    // Get vault balance by clicking max on withdraw tab
    await isolatedPage.getByTestId('withdraw-input-morpho-max').click();
    const vaultBalance = parseFloat(await isolatedPage.getByTestId('withdraw-input-morpho').inputValue());

    // Enter a specific withdrawal amount
    const withdrawAmount = 20;
    await isolatedPage.getByTestId('withdraw-input-morpho').fill(withdrawAmount.toString());

    // Expand transaction overview
    await isolatedPage.getByRole('button', { name: 'Transaction overview' }).click();

    // Verify "You will withdraw" shows correct amount
    await expect(isolatedPage.getByText('You will withdraw')).toBeVisible();
    await expect(isolatedPage.getByText(`${withdrawAmount} USDS`)).toBeVisible();

    // Calculate expected balances
    const expectedFinalWalletBalance = walletBalanceAfterSupply + withdrawAmount;
    const expectedFinalVaultBalance = Math.floor(vaultBalance) - withdrawAmount;

    // Verify wallet balance shows increase
    await expect(isolatedPage.getByText('Your wallet USDS balance')).toBeVisible();
    await expect(isolatedPage.getByText(walletBalanceAfterSupply.toString()).first()).toBeVisible();
    await expect(isolatedPage.getByText(expectedFinalWalletBalance.toString()).first()).toBeVisible();

    // Verify vault balance shows decrease
    await expect(isolatedPage.getByText('Your vault USDS balance')).toBeVisible();
    await expect(isolatedPage.getByText(Math.floor(vaultBalance).toString()).first()).toBeVisible();
    await expect(isolatedPage.getByText(expectedFinalVaultBalance.toString()).first()).toBeVisible();
  });

  test('Review button disabled when disclaimer not checked', async ({ isolatedPage }) => {
    // Enter amount to supply
    await isolatedPage.getByTestId('supply-input-morpho').click();
    await isolatedPage.getByTestId('supply-input-morpho').fill('10');

    // Transaction overview should be visible
    await expect(isolatedPage.getByRole('button', { name: 'Transaction overview' })).toBeVisible();

    // Review button should be disabled because disclaimer is not checked
    const reviewButton = isolatedPage.getByTestId('widget-button');
    await expect(reviewButton).toHaveText('Review');
    await expect(reviewButton).toBeDisabled();

    // Check the disclaimer checkbox
    const disclaimer = isolatedPage.locator('label').filter({ hasText: 'I understand that' });
    await disclaimer.click();

    // Review button should now be enabled
    await expect(reviewButton).toBeEnabled();
  });

  test('Displays vault statistics', async ({ isolatedPage }) => {
    // Expand the Vault info accordion to show stats
    const vaultInfoAccordion = isolatedPage.getByRole('button', { name: 'Vault info' });
    if (await vaultInfoAccordion.isVisible()) {
      await vaultInfoAccordion.click();
    }

    // Verify the stats card displays Supplied balance and TVL information
    await expect(isolatedPage.getByTestId('vault-balance-container')).toBeVisible();
    await expect(isolatedPage.getByTestId('vault-tvl-container')).toBeVisible();
  });

  test.describe('Rewards', () => {
    test('Shows claim button when user has claimable rewards', async ({ isolatedPage, testAccount }) => {
      // Mock Merkl API to return rewards before navigating
      await mockMerklApiWithRewards(isolatedPage, testAccount);

      // Reload the page to pick up the mocked API
      await isolatedPage.reload();
      await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });

      // Navigate to Expert module and Morpho vault
      await isolatedPage.getByRole('tab', { name: 'Expert' }).click();
      await isolatedPage.getByTestId('morpho-vault-stats-card').click();

      // Wait for the claim button to appear with the mocked reward amount
      const claimButton = isolatedPage.getByRole('button', { name: /Claim.*MORPHO/i });
      await expect(claimButton).toBeVisible({ timeout: 10000 });

      // Verify the claim button shows the correct amount (2.65 MORPHO)
      await expect(claimButton).toContainText('2.65');
      await expect(claimButton).toContainText('MORPHO');

      // wait
      await isolatedPage.waitForTimeout(30000);
    });

    test('Does not show claim button when user has no rewards', async ({ isolatedPage }) => {
      // Mock Merkl API to return no rewards
      await mockMerklApiWithNoRewards(isolatedPage);

      // Reload the page to pick up the mocked API
      await isolatedPage.reload();
      await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });

      // Navigate to Expert module and Morpho vault
      await isolatedPage.getByRole('tab', { name: 'Expert' }).click();
      await isolatedPage.getByTestId('morpho-vault-stats-card').click();

      // Wait for the page to load
      await isolatedPage.waitForTimeout(2000);

      // Verify no claim button is visible
      const claimButton = isolatedPage.getByRole('button', { name: /Claim.*MORPHO/i });
      await expect(claimButton).not.toBeVisible();
    });
  });
});
