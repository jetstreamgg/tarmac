import { expect, test } from '../fixtures.ts';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.ts';

test.describe('accept terms', () => {
  test('accept terms', async ({ page }) => {
    await page.goto('/');

    await connectMockWalletAndAcceptTerms(page);
  });
});

test.describe('Switch chains', () => {
  test('Can switch chains through the app header', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('chain-modal-trigger-header').click();
    await page.getByText('Tenderly Base').click();

    expect(page.getByTestId('chain-modal-trigger-header')).toHaveText('Tenderly Base');
    expect(page.url()).toContain('network=tenderlybase');
    expect(page.getByTestId('widget-navigation')).not.toContainText('Seal');
  });

  test('Can switch chains through the widget header', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('chain-modal-trigger-widget').click();
    await page.getByText('Tenderly Base').click();

    expect(page.getByTestId('chain-modal-trigger-header')).toHaveText('Tenderly Base');
    expect(page.url()).toContain('network=tenderlybase');
    expect(page.getByTestId('widget-navigation')).not.toContainText('Seal');
  });

  test('Can switch chains through the URL', async ({ page }) => {
    await page.goto('/?network=tenderlybase');
    await connectMockWalletAndAcceptTerms(page);

    expect(page.getByTestId('chain-modal-trigger-header')).toHaveText('Tenderly Base');
    expect(page.getByTestId('widget-navigation')).not.toContainText('Seal');

    await page.goto('/?network=tenderlymainnet');
    await connectMockWalletAndAcceptTerms(page);

    expect(page.getByTestId('chain-modal-trigger-header')).toHaveText('Tenderly Mainnet');
    expect(page.getByTestId('widget-navigation')).toContainText('Seal');
  });
});
