import { expect, test } from '../fixtures-parallel';
import { VaultProductPage } from '../pages/VaultProductPage';
import { USDC_RISK_CAPITAL_VAULT } from '../utils/vaultsE2e';

const VAULT_NAME = 'USDC Risk Capital';

// V2 rewrite: Morpho vaults on /earn/vaults/morpho/:address. See vaults/QA-CASES.md §3.

test('USDC Risk Capital vault renders chart, strategy and transactions', async ({ isolatedPage }) => {
  const vault = new VaultProductPage(isolatedPage);
  await vault.gotoConnected(USDC_RISK_CAPITAL_VAULT);
  await vault.expectReadOnlyShell();
});

test('Supply modal validates the amount before enabling Review', async ({ isolatedPage }) => {
  const vault = new VaultProductPage(isolatedPage);
  await vault.gotoConnected(USDC_RISK_CAPITAL_VAULT);
  await vault.openSupplyModal(VAULT_NAME);

  const review = isolatedPage.getByRole('dialog').getByRole('button', { name: 'Review', exact: true });
  await expect(review).toBeDisabled();

  await vault.fillAmount('999999999');
  await expect(vault.amountError()).toHaveText('Insufficient balance');
  await expect(review).toBeDisabled();

  await vault.fillAmount('10');
  await expect(vault.amountError()).not.toBeVisible();
  await expect(isolatedPage.getByTestId('vault-modal-row-Supply')).toBeVisible();
  await expect(review).toBeEnabled({ timeout: 60_000 });
});

test('Max fills the full wallet balance', async ({ isolatedPage }) => {
  const vault = new VaultProductPage(isolatedPage);
  await vault.gotoConnected(USDC_RISK_CAPITAL_VAULT);
  await vault.openSupplyModal(VAULT_NAME);

  await vault.amountMax().click();
  const value = await vault.amountInput().inputValue();
  expect(parseFloat(value)).toBeGreaterThan(0);
});

test('Supplies USDC and withdraws it back', async ({ isolatedPage }) => {
  const vault = new VaultProductPage(isolatedPage);
  await vault.gotoConnected(USDC_RISK_CAPITAL_VAULT);

  await vault.openSupplyModal(VAULT_NAME);
  await vault.fillAmount('10');
  await vault.reviewAndConfirm();

  await expect(vault.positionCard()).toBeVisible({ timeout: 15_000 });

  await vault.openWithdrawModal(VAULT_NAME);
  await vault.fillAmount('9');
  await vault.reviewAndConfirm();
});
