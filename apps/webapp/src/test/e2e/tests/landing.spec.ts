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
// modal, both pinned in network-switching.spec.ts.
//
// The filter itself is not reachable from here: it offers the connected chain
// FAMILY (getSupportedChainIds), which on a fork session collapses to the fork
// alone — deliberately, since fork data is all there is to read. So on this
// build it is a one-option control with nothing to pick. Its behaviour is
// covered by lib/networkFilter.test.ts and the component tests instead.
test.describe('Deep links', () => {
  test('a connected deep link still puts the wallet on the named chain', async ({ isolatedPage }) => {
    await isolatedPage.goto('/earn/savings?network=tenderlybase');
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });

    // `?network=` is retired as app state and honoured exactly once, so links
    // minted while it was live keep working. Savings runs on Base, so nothing
    // overrules it — and the param is spent rather than left in the URL.
    await expect(isolatedPage.getByTestId('product-detail-network')).toContainText('Tenderly Base');
    await expect(isolatedPage).not.toHaveURL(/network=/);
  });
});
