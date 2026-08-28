import { expect, type Page } from '@playwright/test';

/**
 * The chain the app is on. Tests used to read this out of `?network=`, which
 * was the app's chain as much as it was a URL — writing it performed the
 * switch, so waiting for it in the URL was waiting for the switch to land. The
 * param is retired; the wagmi store it mirrored is the source now.
 */
export const expectAppChain = async (page: Page, chainName: string) => {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const read = window.__MOCK_APP_CHAIN__;
          if (!read) throw new Error('Mock app-chain hook is not installed (is this the mock build?)');
          return read().name;
        }),
      { timeout: 15000 }
    )
    .toBe(chainName);
};

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
 * Mainnet', 'Tenderly Base', …), matched case-insensitively.
 */
export const switchWalletNetwork = async (page: Page, chainName: string) => {
  const chainId = await page.evaluate(name => {
    const trigger = window.__MOCK_SWITCH_CHAIN__;
    if (!trigger) throw new Error('Mock wallet switch hook is not installed (is this the mock build?)');
    return trigger(name);
  }, chainName);

  // Callers act on the switched state, so wait for the app to have followed the
  // wallet rather than racing it.
  await expectAppChain(page, canonicalChainName(chainName));
  return chainId;
};

/**
 * Callers build the name from the lowercase `NetworkName` enum, so recover the
 * config's own casing before comparing against what the app reports.
 */
const canonicalChainName = (chainName: string) =>
  chainName.replace(/\b[a-z]/g, letter => letter.toUpperCase());

/**
 * Switches the network the way a user does inside the app: the network dropdown
 * on a product page. Savings is the vehicle — it is the product that runs on
 * every chain, so its selector is the one that offers a real choice.
 */
export const switchNetworkOnProductPage = async (page: Page, chainName: string) => {
  await page.getByTestId('product-detail-network').click();
  await page.getByRole('option', { name: chainName }).click();
  await expectAppChain(page, chainName);
};
