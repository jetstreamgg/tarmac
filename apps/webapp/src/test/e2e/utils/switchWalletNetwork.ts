import { type Page } from '@playwright/test';

/**
 * Switches the connected mock wallet's network through the V2 shell: wallet
 * chip → preview drawer → network selector → chain button. Chain names are
 * the mock config's tenderly-flavored ones ('Tenderly Mainnet', 'Tenderly
 * Base', ...). Replaces the V1 switchToL2 helper (widget/header chain-modal
 * triggers) for the V2 shell. The drawer dismisses itself after a selection,
 * so this only collapses it explicitly if it lingers.
 */
export const switchWalletNetwork = async (page: Page, chainName: string) => {
  await page.getByTestId('wallet-chip').getByRole('button').first().click();
  await page.getByTestId('wallet-drawer-network').click();
  await page.getByRole('button', { name: chainName }).click();
  const drawer = page.getByTestId('wallet-drawer');
  try {
    await drawer.waitFor({ state: 'hidden', timeout: 5000 });
  } catch {
    await page.getByTestId('wallet-drawer-collapse').click();
    await drawer.waitFor({ state: 'hidden' });
  }
};
