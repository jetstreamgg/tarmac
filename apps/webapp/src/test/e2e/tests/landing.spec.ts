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

// Network switching moved into the wallet drawer (and per-product selectors)
// when the legacy chain-modal-trigger-header/-widget chrome was retired.
test.describe('Switch chains', () => {
  test('Can switch chains through the wallet drawer', async ({ isolatedPage }) => {
    await isolatedPage.goto('/');
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });

    await isolatedPage.getByTestId('wallet-chip').getByRole('button').click();
    await isolatedPage.getByTestId('wallet-drawer-network').click();
    await isolatedPage.getByRole('button', { name: 'Tenderly Base' }).click();

    await expect(isolatedPage).toHaveURL(/network=tenderlybase/);
    // The drawer auto-closes on navigation; reopen it to read the selector label
    await isolatedPage.getByTestId('wallet-chip').getByRole('button').click();
    await expect(isolatedPage.getByTestId('wallet-drawer-network')).toHaveText(/Tenderly Base/);
  });

  test('Can switch chains through a product page selector', async ({ isolatedPage }) => {
    await isolatedPage.goto('/earn/savings');
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });

    await isolatedPage.getByTestId('product-detail-network').click();
    await isolatedPage.getByRole('button', { name: 'Tenderly Base' }).click();

    await expect(isolatedPage).toHaveURL(/network=tenderlybase/);
  });

  test('Can switch chains through the URL', async ({ isolatedPage }) => {
    await isolatedPage.goto('/?network=tenderlybase');
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });

    await isolatedPage.getByTestId('wallet-chip').getByRole('button').click();
    await expect(isolatedPage.getByTestId('wallet-drawer-network')).toHaveText(/Tenderly Base/);

    await isolatedPage.goto('/?network=tenderlymainnet');
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });

    await isolatedPage.getByTestId('wallet-chip').getByRole('button').click();
    await expect(isolatedPage.getByTestId('wallet-drawer-network')).toHaveText(/Tenderly Mainnet/);
  });
});
