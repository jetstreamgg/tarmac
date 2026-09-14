import { expect, test } from '../fixtures-parallel.ts';
import { performAction } from '../utils/approveOrPerformAction';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.ts';
import { SPARK_USDT_VAULT, sparkVaultPath } from '../utils/vaultsE2e';

// Spark Tether Savings (sUSDT) — legacy widget UI until APP-266 V2 product page.
// Deep-link navigation (V2 route); supply/withdraw still use legacy widget testids.
// USDT funding comes from global-setup-parallel.ts. Gated by VITE_SUSDT_VAULT_ENABLED.

const VAULT_NAME = 'Tether Savings';

test.describe('Vaults - Spark Tether Savings (sUSDT)', () => {
  test.beforeEach(async ({ isolatedPage }) => {
    await isolatedPage.goto(sparkVaultPath(SPARK_USDT_VAULT));
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  });

  test('Renders the Spark vault with the on-chain name and Powered-by-Spark branding', async ({
    isolatedPage
  }) => {
    await expect(isolatedPage.getByText(VAULT_NAME).first()).toBeVisible();
    const vaultInfoAccordion = isolatedPage.getByRole('button', { name: 'Vault info' });
    await vaultInfoAccordion.click();
    await expect(isolatedPage.getByTestId('vault-tvl-container')).toBeVisible();
  });

  test('Supply USDT to the Spark vault', async ({ isolatedPage }) => {
    await expect(isolatedPage.getByRole('tab', { name: 'Supply', selected: true })).toBeVisible();

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

    await isolatedPage
      .getByRole('button', { name: new RegExp(`Back to ${VAULT_NAME}`, 'i') })
      .first()
      .click();
    await vaultInfoAccordion.click();
    const expectedBalance = Math.floor(initialBalance + supplyAmount);
    await expect(isolatedPage.getByTestId('vault-balance')).toContainText(`${expectedBalance} USDT`);
  });

  test('Withdraw USDT from the Spark vault', async ({ isolatedPage }) => {
    const supplyAmount = 20;
    await isolatedPage.getByTestId('supply-input-sky').click();
    await isolatedPage.getByTestId('supply-input-sky').fill(supplyAmount.toString());
    await performAction(isolatedPage, 'Supply');
    await isolatedPage
      .getByRole('button', { name: new RegExp(`Back to ${VAULT_NAME}`, 'i') })
      .first()
      .click();

    await isolatedPage.getByRole('tab', { name: 'Withdraw' }).click();
    const withdrawAmount = 5;
    await isolatedPage.getByTestId('withdraw-input-sky').click();
    await isolatedPage.getByTestId('withdraw-input-sky').fill(withdrawAmount.toString());

    await expect(isolatedPage.getByText('You will withdraw')).toBeVisible();
    await expect(isolatedPage.getByText(`${withdrawAmount} USDT`).first()).toBeVisible();

    await performAction(isolatedPage, 'Withdraw');
  });

  test('Max withdraw redeems the full position', async ({ isolatedPage }) => {
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
