import { type Locator, type Page } from '@playwright/test';
import { SavingsProductPage } from '../pages/SavingsProductPage';
import { type ConnectMockWalletOptions } from './connectMockWalletAndAcceptTerms';

/**
 * Canonical route to an armed Confirm on the /earn/savings supply modal:
 * navigate, connect (accepting terms when shown), open supply modal, fill
 * amount and pass Review. Returns the enabled Confirm button, unclicked.
 */
export const openSavingsSupplyConfirm = async (
  page: Page,
  { amount = '2', connect }: { amount?: string; connect?: ConnectMockWalletOptions } = {}
): Promise<Locator> => {
  const savings = new SavingsProductPage(page);
  await savings.gotoConnected(connect);
  return savings.openSupplyConfirm(amount);
};
