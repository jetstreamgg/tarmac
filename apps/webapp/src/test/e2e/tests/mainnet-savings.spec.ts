import { expect, test } from '../fixtures-parallel';
import { SavingsProductPage } from '../pages/SavingsProductPage';

// V2 rewrite: mainnet savings on /earn/savings. See savings/QA-CASES.md §3.

test('Savings product page renders the chart, details and transactions', async ({ isolatedPage }) => {
  const savings = new SavingsProductPage(isolatedPage);
  await savings.gotoConnected();
  await savings.expectReadOnlyShell();
});

test('Supply modal validates the amount before enabling Supply', async ({ isolatedPage }) => {
  const savings = new SavingsProductPage(isolatedPage);
  await savings.gotoConnected();
  await savings.openSupplyModal();

  const review = isolatedPage.getByRole('dialog').getByRole('button', { name: 'Review', exact: true });
  await expect(review).toBeDisabled();

  await savings.fillAmount('999999999');
  await expect(savings.amountError()).toHaveText('Insufficient balance');
  await expect(review).toBeDisabled();

  await savings.fillAmount('10');
  await expect(savings.amountError()).not.toBeVisible();
  await expect(isolatedPage.getByTestId('savings-modal-row-Supply')).toBeVisible();
  await expect(review).toBeEnabled({ timeout: 60_000 });
});

test('Max fills the full wallet balance', async ({ isolatedPage }) => {
  const savings = new SavingsProductPage(isolatedPage);
  await savings.gotoConnected();
  await savings.openSupplyModal();

  await savings.amountMax().click();
  const value = await savings.amountInput().inputValue();
  expect(parseFloat(value)).toBeGreaterThan(0);
});

test('Supplies USDS and withdraws it back', async ({ isolatedPage }) => {
  const savings = new SavingsProductPage(isolatedPage);
  await savings.gotoConnected();

  await savings.openSupplyModal();
  await savings.fillAmount('10');
  await savings.reviewAndConfirm();

  await expect(savings.positionCard()).toBeVisible({ timeout: 15_000 });

  await savings.openWithdrawModal();
  await savings.fillAmount('9');
  await savings.reviewAndConfirm();
});

test('Supplies DAI through the upgrade-and-supply bundle', async ({ isolatedPage }) => {
  const savings = new SavingsProductPage(isolatedPage);
  await savings.gotoConnected();

  await savings.openSupplyModal();
  await savings.selectOrigin('DAI');
  await savings.fillAmount('10');
  await savings.reviewAndConfirm();
});
