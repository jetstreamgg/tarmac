import { expect, type Page } from '@playwright/test';
import { NetworkName } from './constants';

const TENDERLY_CHAIN_LABEL: Record<NetworkName, string> = {
  [NetworkName.mainnet]: 'Tenderly Mainnet',
  [NetworkName.base]: 'Tenderly Base',
  [NetworkName.arbitrum]: 'Tenderly Arbitrum',
  [NetworkName.optimism]: 'Tenderly Optimism',
  [NetworkName.unichain]: 'Tenderly Unichain'
};

/** Mock-wallet chain button label for a Tenderly fork network. */
export const tenderlyChainLabel = (network: NetworkName) => TENDERLY_CHAIN_LABEL[network];

/**
 * Switches the connected mock wallet's network through the V2 shell: wallet
 * chip → preview drawer → network selector → chain button. Chain names are
 * the mock config's tenderly-flavored ones ('Tenderly Mainnet', 'Tenderly
 * Base', ...). Replaces the V1 switchToL2 helper (widget/header chain-modal
 * triggers) for the V2 shell. The drawer dismisses itself after a selection,
 * so this only collapses it explicitly if it lingers.
 *
 * Pass `network` when the caller needs wagmi to finish switching before the
 * next assertion (balance reads, tx flows). Waits for `network=tenderly*` in
 * the URL, matching `switchToL2`.
 */
export const switchWalletNetwork = async (
  page: Page,
  chainName: string,
  network?: NetworkName
) => {
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
  if (network && network !== NetworkName.mainnet) {
    await expect(page).toHaveURL(new RegExp(`network=tenderly${network}`), { timeout: 15_000 });
  }
};
