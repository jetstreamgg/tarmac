import { expect, test } from '../fixtures-parallel';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.ts';

test.describe('accept terms', () => {
  test('accept terms', async ({ isolatedPage }) => {
    await isolatedPage.goto('/');

    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
    await isolatedPage.waitForTimeout(1000);
  });
});

test.describe('Switch chains', () => {
  test('Can switch chains through the app header', async ({ isolatedPage }) => {
    await isolatedPage.goto('/');
    await isolatedPage.getByTestId('chain-modal-trigger-header').click();
    await isolatedPage.getByText('Tenderly Base').click();

    expect(isolatedPage.getByTestId('chain-modal-trigger-header')).toHaveText('Tenderly Base');
    expect(isolatedPage.url()).toContain('network=tenderlybase');
  });

  test('Can switch chains through the widget header', async ({ isolatedPage }) => {
    await isolatedPage.goto('/');
    await isolatedPage.getByTestId('chain-modal-trigger-widget').click();
    await isolatedPage.getByText('Tenderly Base').click();

    expect(isolatedPage.getByTestId('chain-modal-trigger-header')).toHaveText('Tenderly Base');
    expect(isolatedPage.url()).toContain('network=tenderlybase');
  });

  test('Can switch chains through the URL', async ({ isolatedPage }) => {
    await isolatedPage.goto('/?network=tenderlybase');
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
    await isolatedPage.waitForTimeout(1000);

    expect(isolatedPage.getByTestId('chain-modal-trigger-header')).toHaveText('Tenderly Base');

    await isolatedPage.goto('/?network=tenderlymainnet');
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
    await isolatedPage.waitForTimeout(1000);

    expect(isolatedPage.getByTestId('chain-modal-trigger-header')).toHaveText('Tenderly Mainnet');
  });
});
