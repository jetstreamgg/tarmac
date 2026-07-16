import { type Page } from '@playwright/test';
import { expect, test } from '../fixtures-parallel';
import { connectAndVerify } from '../utils/connectAndVerify';

// V2 rewrite (see e2e-migration.md): mainnet savings on the /earn/savings
// product page. Supply/withdraw run through the editable savings modal
// (`savings-modal-*`); mainnet origins are USDS and DAI (a DAI supply routes
// through the upgrade+supply bundle inside the same flow).

const navigateToSavings = async (page: Page) => {
  // Connect AFTER the goto — a full navigation resets the mock connector.
  await page.goto('/earn/savings');
  await connectAndVerify(page, { batch: true });
  await expect(
    page.getByTestId('savings-supply-card').or(page.getByTestId('savings-position-card'))
  ).toBeVisible({ timeout: 15_000 });
};

const openSupplyModal = async (page: Page) => {
  // Whichever card the account shows (position vs no-position) — wait for
  // either supply trigger instead of racing a fixed-timeout probe.
  await page
    .getByTestId('savings-position-supply')
    .or(page.getByTestId('savings-supply-cta'))
    .first()
    .click();
  await expect(page.getByText('Supply to Sky Savings')).toBeVisible();
};

const confirmModal = async (page: Page, label: 'Supply' | 'Withdraw', successText: string) => {
  const confirm = page.getByRole('dialog').getByRole('button', { name: label, exact: true });
  await expect(confirm).toBeEnabled({ timeout: 60_000 });
  await confirm.click();
  await expect(page.getByText(successText)).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Done' }).click();
};

const SUPPLY_SUCCESS = "You've successfully supplied to Sky Savings.";
const WITHDRAW_SUCCESS = "You've successfully withdrawn from Sky Savings.";

test('Savings product page renders the chart, details and transactions', async ({ isolatedPage }) => {
  await navigateToSavings(isolatedPage);

  await expect(isolatedPage.getByTestId('savings-detail-chart')).toBeVisible();
  await expect(isolatedPage.getByTestId('savings-transactions')).toBeVisible();
});

test('Supply modal validates the amount before enabling Supply', async ({ isolatedPage }) => {
  await navigateToSavings(isolatedPage);
  await openSupplyModal(isolatedPage);

  const confirm = isolatedPage.getByRole('dialog').getByRole('button', { name: 'Supply', exact: true });
  await expect(confirm).toBeDisabled();

  // Over-balance shows the inline error and keeps Supply disabled
  await isolatedPage.getByTestId('savings-modal-amount-input').fill('999999999');
  await expect(isolatedPage.getByTestId('savings-modal-amount-error')).toHaveText('Insufficient balance');
  await expect(confirm).toBeDisabled();

  // A valid amount clears the error and shows the before→after breakdown
  await isolatedPage.getByTestId('savings-modal-amount-input').fill('10');
  await expect(isolatedPage.getByTestId('savings-modal-amount-error')).not.toBeVisible();
  await expect(isolatedPage.getByTestId('savings-modal-row-Supply')).toBeVisible();
  await expect(confirm).toBeEnabled({ timeout: 60_000 });
});

test('Max fills the full wallet balance', async ({ isolatedPage }) => {
  await navigateToSavings(isolatedPage);
  await openSupplyModal(isolatedPage);

  await isolatedPage.getByTestId('savings-modal-amount-max').click();

  const value = await isolatedPage.getByTestId('savings-modal-amount-input').inputValue();
  expect(parseFloat(value)).toBeGreaterThan(0);
});

test('Supplies USDS and withdraws it back', async ({ isolatedPage }) => {
  await navigateToSavings(isolatedPage);

  await openSupplyModal(isolatedPage);
  await isolatedPage.getByTestId('savings-modal-amount-input').fill('10');
  await confirmModal(isolatedPage, 'Supply', SUPPLY_SUCCESS);

  // The position card replaces the supply CTA once a position exists
  await expect(isolatedPage.getByTestId('savings-position-card')).toBeVisible({ timeout: 15_000 });

  await isolatedPage.getByTestId('savings-position-withdraw').click();
  await expect(isolatedPage.getByText('Withdraw from Sky Savings')).toBeVisible();
  // Withdraw 9, not 10 — rounding can leave less than the full supply
  await isolatedPage.getByTestId('savings-modal-amount-input').fill('9');
  await confirmModal(isolatedPage, 'Withdraw', WITHDRAW_SUCCESS);
});

test('Supplies DAI through the upgrade-and-supply bundle', async ({ isolatedPage }) => {
  await navigateToSavings(isolatedPage);

  await openSupplyModal(isolatedPage);
  await isolatedPage.getByTestId('savings-origin-select').click();
  await isolatedPage.getByTestId('savings-origin-dai').click();
  await isolatedPage.getByTestId('savings-modal-amount-input').fill('10');
  await confirmModal(isolatedPage, 'Supply', SUPPLY_SUCCESS);
});
