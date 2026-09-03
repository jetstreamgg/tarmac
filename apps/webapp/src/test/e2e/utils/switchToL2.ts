import { type Page } from '@playwright/test';
import { NetworkName } from './constants';
import { switchWalletNetwork } from './switchWalletNetwork';

/**
 * The older of the two network-switch helpers, kept for its `NetworkName`
 * call sites. Both now go through `switchWalletNetwork`, which models the
 * wallet's own menu — the drawer control they used to drive is the app-wide
 * network filter now, and in-app switching lives on the product pages.
 */
export const switchToL2 = async (page: Page, networkName: NetworkName) => {
  await switchWalletNetwork(page, `Tenderly ${capitalize(networkName)}`);
};

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
