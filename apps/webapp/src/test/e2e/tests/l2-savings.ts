import { type Page } from '@playwright/test';
import { expect, test } from '../fixtures-parallel';
import { connectAndVerify } from '../utils/connectAndVerify';
import { switchWalletNetwork } from '../utils/switchWalletNetwork';
import { NetworkName } from '../utils/constants';

// V2 rewrite (see e2e-migration.md): savings lives on the /earn/savings
// product page now. Supply/withdraw run through the editable savings modal
// (`savings-modal-*` testids) launched from the supply CTA (no position) or
// the position card. The origin token (USDS/USDC on L2s) is picked inside the
// modal via `savings-origin-select`, replacing the legacy token menu.

const navigateToSavings = async (page: Page, networkName: NetworkName) => {
  // Connect AFTER the goto — a full navigation resets the mock connector.
  await page.goto('/earn/savings');
  await connectAndVerify(page, { batch: true });
  await switchWalletNetwork(page, `Tenderly ${networkName}`);
  await expect(
    page.getByTestId('savings-supply-card').or(page.getByTestId('savings-position-card'))
  ).toBeVisible({
    timeout: 15_000
  });
};

/** Opens the supply modal from whichever card the account currently shows. */
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

const openWithdrawModal = async (page: Page) => {
  const withdraw = page.getByTestId('savings-position-withdraw');
  await expect(withdraw).toBeVisible({ timeout: 30_000 });
  await withdraw.click();
  await expect(page.getByText('Withdraw from Sky Savings')).toBeVisible();
};

const selectOrigin = async (page: Page, symbol: 'USDS' | 'USDC') => {
  await page.getByTestId('savings-origin-select').click();
  await page.getByTestId(`savings-origin-${symbol.toLowerCase()}`).click();
};

/** Confirms the entry modal and dismisses the success screen. */
const confirmModal = async (page: Page, label: 'Supply' | 'Withdraw', successText: string) => {
  const confirm = page.getByRole('dialog').getByRole('button', { name: label, exact: true });
  await expect(confirm).toBeEnabled({ timeout: 60_000 });
  await confirm.click();
  await expect(page.getByText(successText)).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Done' }).click();
};

const SUPPLY_SUCCESS = "You've successfully supplied to Sky Savings.";
const WITHDRAW_SUCCESS = "You've successfully withdrawn from Sky Savings.";

export const runL2SavingsTests = async ({ networkName }: { networkName: NetworkName }) => {
  test(`Go to ${networkName} Savings, deposit usds and usdc, withdraw usdc and usds`, async ({
    isolatedPage
  }) => {
    await navigateToSavings(isolatedPage, networkName);

    // supply USDS
    await openSupplyModal(isolatedPage);
    await isolatedPage.getByTestId('savings-modal-amount-input').fill('10');
    await confirmModal(isolatedPage, 'Supply', SUPPLY_SUCCESS);

    // supply USDC
    await openSupplyModal(isolatedPage);
    await selectOrigin(isolatedPage, 'USDC');
    await isolatedPage.getByTestId('savings-modal-amount-input').fill('10');
    await confirmModal(isolatedPage, 'Supply', SUPPLY_SUCCESS);

    // withdraw USDC
    await openWithdrawModal(isolatedPage);
    await selectOrigin(isolatedPage, 'USDC');
    await isolatedPage.getByTestId('savings-modal-amount-input').fill('10');
    await confirmModal(isolatedPage, 'Withdraw', WITHDRAW_SUCCESS);

    // withdraw USDS (9, not 10 — rounding can leave less than the full supply)
    await openWithdrawModal(isolatedPage);
    await isolatedPage.getByTestId('savings-modal-amount-input').fill('9');
    await confirmModal(isolatedPage, 'Withdraw', WITHDRAW_SUCCESS);
  });

  test(`Batch - Go to ${networkName} Savings and perform a batch deposit and a batch withdrawal`, async ({
    isolatedPage
  }) => {
    await navigateToSavings(isolatedPage, networkName);

    // supply USDS (batch wallet: approve+supply land as one bundle)
    await openSupplyModal(isolatedPage);
    await isolatedPage.getByTestId('savings-modal-amount-input').fill('10');
    await confirmModal(isolatedPage, 'Supply', SUPPLY_SUCCESS);

    // withdraw USDS
    await openWithdrawModal(isolatedPage);
    await isolatedPage.getByTestId('savings-modal-amount-input').fill('9');
    await confirmModal(isolatedPage, 'Withdraw', WITHDRAW_SUCCESS);
  });
};
