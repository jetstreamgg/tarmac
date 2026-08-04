import { expect, type Page } from '@playwright/test';
import { NetworkName } from './constants';

// Network switching moved into the wallet drawer when the legacy header/widget
// chain-modal triggers were retired with the B4 chrome removal. The drawer
// auto-closes once the switch lands `network=` in the URL (any navigation
// closes the preview), so no explicit close step is needed. Only meaningful
// when switching to a different network than the current one.
export const switchToL2 = async (page: Page, networkName: NetworkName) => {
  // Open the wallet drawer from the TopNav chip
  await page.getByTestId('wallet-chip').getByRole('button').click();
  // Open the network dialog embedded in the drawer
  await page.getByTestId('wallet-drawer-network').click();
  // Select the target chain; the mock connector switches without a wallet prompt
  await page.getByRole('button', { name: `Tenderly ${networkName}` }).click();
  // Chain names normalize to e.g. `tenderlybase` (normalizeUrlParam)
  await expect(page).toHaveURL(new RegExp(`network=tenderly${networkName}`), { timeout: 15000 });
};
