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
    expect(page.url()).toContain('network=tenderly+base');
    expect(page.getByTestId('widget-navigation')).not.toContainText('Activation');
  });

  test('Can switch chains through the widget header', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('chain-modal-trigger-widget').click();
    await page.getByText('Tenderly Base').click();

    expect(page.getByTestId('chain-modal-trigger-header')).toHaveText('Tenderly Base');
    expect(page.url()).toContain('network=tenderly+base');
    expect(page.getByTestId('widget-navigation')).not.toContainText('Activation');
  });

  test('Can switch chains through the URL', async ({ page }) => {
    await page.goto('/?network=tenderly+base');
    await connectMockWalletAndAcceptTerms(page);

    expect(page.getByTestId('chain-modal-trigger-header')).toHaveText('Tenderly Base');
    expect(page.getByTestId('widget-navigation')).not.toContainText('Activation');

    await page.goto('/?network=tenderly+mainnet');
    await connectMockWalletAndAcceptTerms(page);

    expect(page.getByTestId('chain-modal-trigger-header')).toHaveText('Tenderly Mainnet');
    expect(page.getByTestId('widget-navigation')).toContainText('Activation');
  });
});
