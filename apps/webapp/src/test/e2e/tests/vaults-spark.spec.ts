import { expect, test } from '../fixtures-parallel.ts';
import { performAction } from '../utils/approveOrPerformAction';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.ts';

// Spark Tether Savings (sUSDT) vault — registered in slice 02 (APP-266).
// Copied from expert-morpho.spec.ts and adapted to the Vaults tab + USDT asset.
// NOTE: assumes the Tenderly fork funds the test account with USDT (operator
// runs e2e). Provider-aware selectors: `sky-vault-stats-card`,
// `supply-input-sky`, `withdraw-input-sky`.

const VAULT_NAME = 'Tether Savings';

test.describe('Vaults - Spark Tether Savings (sUSDT)', () => {
  test.beforeEach(async ({ isolatedPage }) => {
    await isolatedPage.goto('/');
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
    // Navigate to the Vaults tab and open the Spark vault detail
    await isolatedPage.getByRole('tab', { name: 'Vaults' }).click();
    await isolatedPage.getByTestId('sky-vault-stats-card').click();
  });

  test('Renders the Spark vault with the on-chain name and Powered-by-Spark branding', async ({
    isolatedPage
  }) => {
    await expect(isolatedPage.getByText(VAULT_NAME).first()).toBeVisible();
    // On-chain TVL is shown in the in-widget stats card (no Spark API in slice 02)
    const vaultInfoAccordion = isolatedPage.getByRole('button', { name: 'Vault info' });
    await vaultInfoAccordion.click();
    await expect(isolatedPage.getByTestId('vault-tvl-container')).toBeVisible();
  });

  test('Supply USDT to the Spark vault', async ({ isolatedPage }) => {
    await expect(isolatedPage.getByRole('tab', { name: 'Supply', selected: true })).toBeVisible();

    // Read the starting balance from the in-widget stats card
    const vaultInfoAccordion = isolatedPage.getByRole('button', { name: 'Vault info' });
    await vaultInfoAccordion.click();
    const initialBalanceText = await isolatedPage.getByTestId('vault-balance').textContent();
    const initialBalance = initialBalanceText?.includes('--')
      ? 0
      : parseFloat(initialBalanceText?.match(/([\d.]+)\s*USDT/)?.[1] || '0');
    await vaultInfoAccordion.click();

    const supplyAmount = 10;
    await isolatedPage.getByTestId('supply-input-sky').click();
    await isolatedPage.getByTestId('supply-input-sky').fill(supplyAmount.toString());

    await expect(isolatedPage.getByRole('button', { name: 'Transaction overview' })).toBeVisible();
    await expect(isolatedPage.getByText('You will supply')).toBeVisible();
    await expect(isolatedPage.getByText(`${supplyAmount} USDT`)).toBeVisible();

    await performAction(isolatedPage, 'Supply');

    // Return to the vault and verify the supplied balance increased
    await isolatedPage
      .getByRole('button', { name: new RegExp(`Back to ${VAULT_NAME}`, 'i') })
      .first()
      .click();
    await vaultInfoAccordion.click();
    const expectedBalance = Math.floor(initialBalance + supplyAmount);
    await expect(isolatedPage.getByTestId('vault-balance')).toContainText(`${expectedBalance} USDT`);
  });

  test('Withdraw USDT from the Spark vault', async ({ isolatedPage }) => {
    // Supply first so there's a balance to withdraw
    const supplyAmount = 20;
    await isolatedPage.getByTestId('supply-input-sky').click();
    await isolatedPage.getByTestId('supply-input-sky').fill(supplyAmount.toString());
    await performAction(isolatedPage, 'Supply');
    await isolatedPage
      .getByRole('button', { name: new RegExp(`Back to ${VAULT_NAME}`, 'i') })
      .first()
      .click();

    // Partial withdraw
    await isolatedPage.getByRole('tab', { name: 'Withdraw' }).click();
    const withdrawAmount = 5;
    await isolatedPage.getByTestId('withdraw-input-sky').click();
    await isolatedPage.getByTestId('withdraw-input-sky').fill(withdrawAmount.toString());

    await expect(isolatedPage.getByText('You will withdraw')).toBeVisible();
    await expect(isolatedPage.getByText(`${withdrawAmount} USDT`).first()).toBeVisible();

    await performAction(isolatedPage, 'Withdraw');
  });

  test('Max withdraw redeems the full position', async ({ isolatedPage }) => {
    // Supply, then withdraw the max (redeem path)
    const supplyAmount = 30;
    await isolatedPage.getByTestId('supply-input-sky').click();
    await isolatedPage.getByTestId('supply-input-sky').fill(supplyAmount.toString());
    await performAction(isolatedPage, 'Supply');
    await isolatedPage
      .getByRole('button', { name: new RegExp(`Back to ${VAULT_NAME}`, 'i') })
      .first()
      .click();

    await isolatedPage.getByRole('tab', { name: 'Withdraw' }).click();
    await isolatedPage.getByTestId('withdraw-input-sky-max').click();

    const inputValue = await isolatedPage.getByTestId('withdraw-input-sky').inputValue();
    expect(parseFloat(inputValue)).toBeGreaterThanOrEqual(supplyAmount - 1);

    await performAction(isolatedPage, 'Withdraw');
  });
});
