import { expect, test } from '../fixtures-parallel.ts';
import { performAction } from '../utils/approveOrPerformAction';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.ts';
import { Page } from '@playwright/test';

// All 5 Morpho vault configs for parameterized tests
const VAULT_CONFIGS = [
  {
    name: 'USDT Savings',
    asset: 'USDT',
    walletBalance: 900,
    address: '0x23f5E9c35820f4baB695Ac1F19c203cC3f8e1e11'
  },
  {
    name: 'USDS Flagship',
    asset: 'USDS',
    walletBalance: 900,
    address: '0xE15fcC81118895b67b6647BBd393182dF44E11E0'
  },
  {
    name: 'USDS Risk Capital',
    asset: 'USDS',
    walletBalance: 900,
    address: '0xf42bca228D9bd3e2F8EE65Fec3d21De1063882d4'
  },
  {
    name: 'USDT Risk Capital',
    asset: 'USDT',
    walletBalance: 900,
    address: '0x2bD3A43863c07B6A01581FADa0E1614ca5DF0E3d'
  },
  {
    name: 'USDC Risk Capital',
    asset: 'USDC',
    walletBalance: 900,
    address: '0x56bfa6f53669B836D1E0Dfa5e99706b12c373ecf'
  }
] as const;

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
const mockMerklApiWithRewards = async (page: Page, userAddress: string, vaultAddress: string) => {
  await page.route('**/api.merkl.xyz/v4/users/**/rewards**', route => {
    const mockResponse = createMockMerklRewardsResponse(userAddress, vaultAddress);
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
const expectSupplySuccess = async (page: Page, amount: string, asset: string) => {
  const successMessage = page.getByText(`You've supplied ${amount} ${asset} to the Morpho Vault`);
  await expect(successMessage).toBeVisible({ timeout: 30000 });
};

// Helper to check for withdraw success message
const expectWithdrawSuccess = async (page: Page, amount: string, asset: string) => {
  const successMessage = page.getByText(`You've withdrawn ${amount} ${asset} from the Morpho Vault.`);
  await expect(successMessage).toBeVisible({ timeout: 30000 });
};

// Helper to navigate into a specific vault from the overview
const navigateToVault = async (page: Page, vaultName: string) => {
  await page.getByText(vaultName, { exact: true }).first().click();
  await expect(page.getByRole('heading', { name: vaultName, exact: true })).toBeVisible();
};

// Helper to verify vault balance on the Balances tab.
// Handles both simple card (1 vault with balance) and accordion (2+ vaults with balance).
const expectVaultBalanceOnBalancesTab = async (page: Page, vaultName: string, expectedAmount: number) => {
  // Navigate to Balances tab
  await page.getByRole('tab', { name: 'Balances' }).click();

  // The "Supplied to Vaults" card always renders, but balance data is fetched async from on-chain.
  // Wait for the card to appear.
  await expect(page.getByText('Supplied to Vaults')).toBeVisible({ timeout: 10000 });

  // Wait for the expected balance amount to appear on the page.
  await expect(page.getByText(expectedAmount.toString(), { exact: true }).first()).toBeVisible({
    timeout: 15000
  });

  // If "Funds by vault" accordion is present (multiple vaults have balance), expand it
  const fundsByVault = page.getByText('Funds by vault');
  if (await fundsByVault.isVisible().catch(() => false)) {
    await fundsByVault.click();
    // Verify the specific vault name appears in the expanded accordion
    await expect(page.getByText(vaultName, { exact: true }).first()).toBeVisible();
  }
};

test.describe('Vaults Module - Morpho Vaults', () => {
  test.beforeEach(async ({ isolatedPage }) => {
    await isolatedPage.goto('/');
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
    // Navigate to Vaults module
    await isolatedPage.getByRole('tab', { name: 'Vaults' }).click();
    // Should see vault selection screen
    await expect(isolatedPage.getByRole('heading', { name: 'Vaults', exact: true }).first()).toBeVisible();
  });

  test.describe('Vaults Overview', () => {
    test('Display all 5 vault cards with stats', async ({ isolatedPage }) => {
      // Should show Vaults heading
      await expect(isolatedPage.getByRole('heading', { name: 'Vaults', exact: true }).first()).toBeVisible();

      // Should show subtitle description
      await expect(
        isolatedPage.getByText('Third-party vault integrations with Sky ecosystem tokens')
      ).toBeVisible();

      // Should show 5 vault cards
      const vaultCards = isolatedPage.getByTestId('morpho-vault-stats-card');
      await expect(vaultCards).toHaveCount(5);

      // Verify all vault names are present
      for (const { name } of VAULT_CONFIGS) {
        await expect(isolatedPage.getByText(name, { exact: true })).toBeVisible();
      }

      // Should show liquidity and TVL stats (use first() since multiple cards)
      await expect(isolatedPage.getByText('Liquidity').first()).toBeVisible();
      await expect(isolatedPage.getByText('TVL').first()).toBeVisible();
    });

    test('Shows claimable rewards table with claim button when rewards exist', async ({
      isolatedPage,
      testAccount
    }) => {
      // Mock Merkl API with rewards before page loads
      await mockMerklApiWithRewards(isolatedPage, testAccount, VAULT_CONFIGS[0].address);

      // Reload to pick up the mocked API
      await isolatedPage.reload();
      await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
      await isolatedPage.getByRole('tab', { name: 'Vaults' }).click();

      // Verify "Claimable rewards" section appears on the root page
      await expect(isolatedPage.getByText('Claimable rewards')).toBeVisible({ timeout: 10000 });

      // Verify table headers
      await expect(isolatedPage.getByText('Token')).toBeVisible();
      await expect(isolatedPage.getByText('Source')).toBeVisible();
      await expect(isolatedPage.getByText('Amount')).toBeVisible();

      // Verify MORPHO token row appears in the table
      await expect(isolatedPage.getByText('MORPHO').first()).toBeVisible();

      // Verify "Claim rewards" button is visible
      await expect(isolatedPage.getByRole('button', { name: 'Claim rewards' })).toBeVisible();
    });

    test('Shows no claimable rewards message when no rewards', async ({ isolatedPage }) => {
      // Mock Merkl API with no rewards
      await mockMerklApiWithNoRewards(isolatedPage);

      // Reload to pick up the mocked API
      await isolatedPage.reload();
      await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
      await isolatedPage.getByRole('tab', { name: 'Vaults' }).click();

      // Verify "no claimable rewards" message
      await expect(isolatedPage.getByText('There are currently no claimable rewards.')).toBeVisible({
        timeout: 10000
      });
    });
  });

  // Parameterized tests for each vault
  for (const vault of VAULT_CONFIGS) {
    test.describe(`${vault.name} (${vault.asset})`, () => {
      test('Navigate into vault and back', async ({ isolatedPage }) => {
        await navigateToVault(isolatedPage, vault.name);

        // Should show vault info section with View contract link and Vault info
        await expect(isolatedPage.getByText('View contract')).toBeVisible();
        await expect(isolatedPage.getByText('Vault info')).toBeVisible();

        // Click back button
        await isolatedPage.getByText('Back to Vaults').first().click();

        // Should be back at Vaults menu
        await expect(
          isolatedPage.getByRole('heading', { name: 'Vaults', exact: true }).first()
        ).toBeVisible();
        await expect(isolatedPage.getByTestId('morpho-vault-stats-card').first()).toBeVisible();
      });

      test('Supply to vault', async ({ isolatedPage }) => {
        await navigateToVault(isolatedPage, vault.name);

        // Should be on Supply tab by default
        await expect(isolatedPage.getByRole('tab', { name: 'Supply', selected: true })).toBeVisible();

        // Check transaction overview is not visible initially
        await expect(isolatedPage.getByRole('button', { name: 'Transaction overview' })).not.toBeVisible();

        // Enter amount to supply
        const supplyAmount = 10;
        await isolatedPage.getByTestId('supply-input-morpho').click();
        await isolatedPage.getByTestId('supply-input-morpho').fill(supplyAmount.toString());

        // Transaction overview should now be visible
        await expect(isolatedPage.getByRole('button', { name: 'Transaction overview' })).toBeVisible();
        await expect(isolatedPage.getByText('You will supply')).toBeVisible();
        await expect(isolatedPage.getByText(`${supplyAmount} ${vault.asset}`)).toBeVisible();

        // Check the disclaimer checkbox
        const disclaimer = isolatedPage.locator('label').filter({ hasText: 'I understand that' });
        await disclaimer.click();

        // Perform the supply action
        await performAction(isolatedPage, 'Supply');

        // Check success message
        await expectSupplySuccess(isolatedPage, supplyAmount.toString(), vault.asset);

        // Click back to vault
        await isolatedPage
          .getByRole('button', { name: new RegExp(`Back to ${vault.name}`, 'i') })
          .first()
          .click();

        // Should still be in vault module
        await expect(isolatedPage.getByTestId('supply-input-morpho')).toBeVisible();

        // Verify supply is reflected on the Balances tab
        await expectVaultBalanceOnBalancesTab(isolatedPage, vault.name, supplyAmount);
      });

      test('Withdraw from vault', async ({ isolatedPage }) => {
        await navigateToVault(isolatedPage, vault.name);

        // Supply first
        const supplyAmount = 20;
        await isolatedPage.getByTestId('supply-input-morpho').click();
        await isolatedPage.getByTestId('supply-input-morpho').fill(supplyAmount.toString());

        const disclaimer = isolatedPage.locator('label').filter({ hasText: 'I understand that' });
        await disclaimer.click();

        await performAction(isolatedPage, 'Supply');
        await isolatedPage
          .getByRole('button', { name: new RegExp(`Back to ${vault.name}`, 'i') })
          .first()
          .click();

        // Switch to Withdraw tab
        await isolatedPage.getByRole('tab', { name: 'Withdraw' }).click();

        // Enter withdrawal amount
        const withdrawAmount = 5;
        await isolatedPage.getByTestId('withdraw-input-morpho').click();
        await isolatedPage.getByTestId('withdraw-input-morpho').fill(withdrawAmount.toString());

        // Check transaction overview
        await expect(isolatedPage.getByRole('button', { name: 'Transaction overview' })).toBeVisible();
        await expect(isolatedPage.getByText('You will withdraw')).toBeVisible();
        await expect(isolatedPage.getByText(`${withdrawAmount} ${vault.asset}`).first()).toBeVisible();

        // Perform withdrawal
        await performAction(isolatedPage, 'Withdraw');

        // Check success message
        await expectWithdrawSuccess(isolatedPage, withdrawAmount.toString(), vault.asset);

        // Verify remaining balance is reflected on the Balances tab (supplied 20, withdrew 5 = 15 remaining)
        await expectVaultBalanceOnBalancesTab(isolatedPage, vault.name, supplyAmount - withdrawAmount);
      });

      test('Max button for supply', async ({ isolatedPage }) => {
        await navigateToVault(isolatedPage, vault.name);

        // Click max button
        await isolatedPage.getByTestId('supply-input-morpho-max').click();

        // Check that input is filled with wallet balance
        const inputValue = await isolatedPage.getByTestId('supply-input-morpho').inputValue();
        expect(parseFloat(inputValue)).toBe(vault.walletBalance);

        // Transaction overview should be visible
        await expect(isolatedPage.getByRole('button', { name: 'Transaction overview' })).toBeVisible();
      });

      test('Max button for withdrawal', async ({ isolatedPage }) => {
        await navigateToVault(isolatedPage, vault.name);

        // Supply some tokens first
        await isolatedPage.getByTestId('supply-input-morpho').click();
        await isolatedPage.getByTestId('supply-input-morpho').fill('30');

        const disclaimer = isolatedPage.locator('label').filter({ hasText: 'I understand that' });
        await disclaimer.click();

        await performAction(isolatedPage, 'Supply');
        await isolatedPage
          .getByRole('button', { name: new RegExp(`Back to ${vault.name}`, 'i') })
          .first()
          .click();

        // Switch to Withdraw tab
        await isolatedPage.getByRole('tab', { name: 'Withdraw' }).click();

        // Click max button
        await isolatedPage.getByTestId('withdraw-input-morpho-max').click();

        // Check that input is filled with approximately what was supplied
        const inputValue = await isolatedPage.getByTestId('withdraw-input-morpho').inputValue();
        expect(parseFloat(inputValue)).toBeGreaterThanOrEqual(29);
      });

      test('Insufficient funds for supply shows error', async ({ isolatedPage }) => {
        await navigateToVault(isolatedPage, vault.name);

        // Try to supply more than wallet balance
        await isolatedPage.getByTestId('supply-input-morpho').click();
        await isolatedPage.getByTestId('supply-input-morpho').fill((vault.walletBalance + 5).toString());

        // Should show insufficient funds error
        await expect(isolatedPage.getByText('Insufficient funds')).toBeVisible();

        // Review button should be disabled
        const reviewButton = isolatedPage.getByTestId('widget-button');
        await expect(reviewButton).toHaveText('Review');
        await expect(reviewButton).toBeDisabled();
      });

      test('Disclaimer required before supply', async ({ isolatedPage }) => {
        await navigateToVault(isolatedPage, vault.name);

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

      test('Display vault statistics and info', async ({ isolatedPage }) => {
        await navigateToVault(isolatedPage, vault.name);

        // Vault info accordion is expanded by default - verify stats are visible
        await expect(isolatedPage.getByTestId('vault-balance-container')).toBeVisible();
        await expect(isolatedPage.getByTestId('vault-tvl-container')).toBeVisible();
      });

      test('Shows accumulated rewards on vault page when Merkl rewards exist', async ({
        isolatedPage,
        testAccount
      }) => {
        // Mock Merkl API to return rewards for this vault
        await mockMerklApiWithRewards(isolatedPage, testAccount, vault.address);

        // Reload the page to pick up the mocked API
        await isolatedPage.reload();
        await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });

        // Navigate to Vaults module and into this vault
        await isolatedPage.getByRole('tab', { name: 'Vaults' }).click();
        await navigateToVault(isolatedPage, vault.name);

        // Verify "Accumulated Rewards" section appears with reward token
        await expect(isolatedPage.getByText('Accumulated Rewards').first()).toBeVisible({
          timeout: 10000
        });
        await expect(isolatedPage.getByText('MORPHO').first()).toBeVisible();
      });

      test('Disclaimer text mentions borrowing risks with correct asset', async ({ isolatedPage }) => {
        await navigateToVault(isolatedPage, vault.name);

        // Enter amount to trigger disclaimer visibility
        await isolatedPage.getByTestId('supply-input-morpho').click();
        await isolatedPage.getByTestId('supply-input-morpho').fill('10');

        // Verify disclaimer is visible and mentions the vault's asset and borrowing risks
        const disclaimer = isolatedPage.locator('label').filter({ hasText: 'I understand that' });
        await expect(disclaimer).toBeVisible();
        await expect(
          isolatedPage
            .locator(`text=/${vault.asset}.*deposited into this vault is used to fund borrowing/i`)
            .first()
        ).toBeVisible();
      });
    });
  }
});
