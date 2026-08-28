import { expect, test } from '../fixtures-parallel';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.ts';
import { forceAuthChecks, mockAddressScreening, mockIpStatus, mockTermsCheck } from '../mock-terms-gate';

test.describe('accept terms', () => {
  // The default e2e build auto-accepts (VITE_SKIP_AUTH_CHECK), which made this
  // spec a no-op: the modal never opened and the helper timed out into its
  // skip branch. Forcing the checks back on turns it into the real Phase A
  // path (APP-502): modal opens, checkbox gates the CTA, accepting keeps the
  // wallet connected and dismisses the modal.
  test('accept terms', async ({ isolatedPage }) => {
    await forceAuthChecks(isolatedPage);
    await mockIpStatus(isolatedPage, { countryCode: 'XX' });
    await mockAddressScreening(isolatedPage);
    await mockTermsCheck(isolatedPage);
    await isolatedPage.goto('/');

    // expectTerms makes the modal's appearance an assertion (the seam really
    // landed), and the helper itself pins the completion: modal closed with
    // the wallet still connected.
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true, expectTerms: true });
  });
});

// The wallet drawer's network control used to be the app's one global chain
// *switcher*. It is the app-wide network *filter* now, and switching moved to
// where a chain actually decides something — a product page or a transaction
// modal. These two cover what is left here; the switch paths themselves live
// in network-switching.spec.ts, which already pins the product-page dropdown
// and the disconnected deep link.
test.describe('Network filter and deep links', () => {
  test('the drawer network control filters without moving the wallet', async ({ isolatedPage }) => {
    await isolatedPage.goto('/portfolio');
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });

    await isolatedPage.getByTestId('wallet-chip').getByRole('button').click();
    await isolatedPage.getByTestId('wallet-drawer-network').click();
    await isolatedPage.getByRole('option', { name: 'Tenderly Base' }).click();

    await expect(isolatedPage.getByTestId('wallet-drawer-network')).toHaveText(/Tenderly Base/);
    // The point of the change: picking a network here scopes what is shown and
    // nothing else. The wallet stays where it was, so the param does too.
    await expect(isolatedPage).toHaveURL(/network=tenderlymainnet/);

    // One value, four surfaces — the Portfolio header wears the same filter.
    await isolatedPage.getByTestId('wallet-drawer-collapse').click();
    await expect(isolatedPage.getByTestId('portfolio-network-filter')).toHaveText(/Tenderly Base/);
  });

  test('a connected deep link still puts the wallet on the named chain', async ({ isolatedPage }) => {
    await isolatedPage.goto('/earn/savings?network=tenderlybase');
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });

    // Savings runs on Base, so the param is honoured rather than corrected —
    // and the product pill names the chain the product is actually on.
    await expect(isolatedPage.getByTestId('product-detail-network')).toContainText('Tenderly Base');
    await expect(isolatedPage).toHaveURL(/network=tenderlybase/);
  });
});
