import { expect, test } from '../fixtures-parallel';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.ts';

test.describe('accept terms', () => {
  test('accept terms', async ({ isolatedPage }) => {
    await isolatedPage.goto('/');

    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
    await isolatedPage.waitForTimeout(1000);
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
