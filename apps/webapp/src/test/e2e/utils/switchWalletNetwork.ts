import { expect, type Page } from '@playwright/test';

/**
 * Changes the connected mock wallet's network the way a user does from their
 * wallet's own menu — no app UI involved.
 *
 * It used to drive the wallet drawer's chain modal. That drawer control is the
 * app-wide network *filter* now, and switching moved to where a chain actually
 * decides something: a product page, or a transaction modal. So on a
 * mainnet-only page like /stake there is no control to drive at all — which is
 * exactly where these tests need to switch, because the behaviour under test is
 * that the app honours a wallet-side change it never offered.
 *
 * `switchNetworkOnProductPage` is the counterpart that drives the in-app
 * dropdown; this one models the wallet.
 *
 * Chain names are the mock config's tenderly-flavoured ones ('Tenderly
 * Mainnet', 'Tenderly Base', …).
 */
export const switchWalletNetwork = async (page: Page, chainName: string) => {
  const chainId = await page.evaluate(name => {
    const trigger = window.__MOCK_SWITCH_CHAIN__;
    if (!trigger) throw new Error('Mock wallet switch hook is not installed (is this the mock build?)');
    return trigger(name);
  }, chainName);

  // The app mirrors the wallet's chain into the network param; waiting on it
  // means callers can act on the switched state rather than racing it.
  await expect(page).toHaveURL(new RegExp(`network=${chainSlug(chainName)}`), { timeout: 15000 });
  return chainId;
};

/** Chain names normalize to e.g. `tenderlybase` in the URL (normalizeUrlParam). */
const chainSlug = (chainName: string) => chainName.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Switches the network the way a user does inside the app: the network dropdown
 * on a product page. Savings is the vehicle — it is the product that runs on
 * every chain, so its selector is the one that offers a real choice.
 */
export const switchNetworkOnProductPage = async (page: Page, chainName: string) => {
  await page.getByTestId('product-detail-network').click();
  await page.getByRole('option', { name: chainName }).click();
  await expect(page).toHaveURL(new RegExp(`network=${chainSlug(chainName)}`), { timeout: 15000 });
};
