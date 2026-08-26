import { expect, type Locator, type Page } from '@playwright/test';
import { connectAndVerify } from './connectAndVerify';
import { type ConnectMockWalletOptions } from './connectMockWalletAndAcceptTerms';

/**
 * The canonical route to an armed Confirm on the /earn/savings supply modal:
 * navigate, connect (accepting the terms modal when one appears), open the
 * supply modal — whichever card the account shows — fill an amount and pass
 * Review. Returns the enabled Confirm button, unclicked, so the spec owns
 * what happens at the gate. (mainnet-savings.spec.ts, sequential-tx.spec.ts
 * and network-switching.spec.ts still carry local variants of this flow —
 * candidates to migrate here.)
 */
export const openSavingsSupplyConfirm = async (
  page: Page,
  { amount = '2', connect }: { amount?: string; connect?: ConnectMockWalletOptions } = {}
): Promise<Locator> => {
  await page.goto('/earn/savings');
  await connectAndVerify(page, { batch: true, ...connect });
  await page
    .getByTestId('savings-position-supply')
    .or(page.getByTestId('savings-supply-cta'))
    .first()
    .click();
  await expect(page.getByText('Supply to Sky Savings')).toBeVisible();
  await page.getByTestId('savings-modal-amount-input').fill(amount);
  await page.getByText('Review').first().click();
  const confirm = page.getByRole('button', { name: 'Confirm', exact: true });
  await expect(confirm).toBeEnabled({ timeout: 60_000 });
  return confirm;
};
