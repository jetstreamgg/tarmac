import { type Page } from '@playwright/test';
import { expect, test } from '../fixtures-parallel';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms';
import {
  performAction,
  performSequentialAction,
  disableBundledTx,
  approveOrPerformAction
} from '../utils/approveOrPerformAction';
import {
  interceptAndRejectSecondTransaction,
  interceptAndAllowTransactions
} from '../utils/rejectTransaction';
import { NetworkName } from '../utils/constants';
import { switchToL2 } from '../utils/switchToL2';

const dismissCookieBanner = async (page: Page) => {
  const acceptButton = page.getByRole('button', { name: 'Accept All' });
  if (await acceptButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await acceptButton.click();
  }
};

const clickPsmCard = async (page: Page) => {
  await page.getByTestId('widget-container').getByRole('button', { name: '1:1 Conversion' }).click();
};

const navigateToPsm = async (page: Page, options?: { batch?: boolean }) => {
  const { batch = true } = options || {};
  await page.goto('/');
  await connectMockWalletAndAcceptTerms(page, { batch });
  await page.waitForTimeout(1000);
  await dismissCookieBanner(page);
  await page.getByRole('tab', { name: 'Convert' }).click();
  await clickPsmCard(page);
};

const navigateToPsmL2 = async (page: Page, networkName: NetworkName, options?: { batch?: boolean }) => {
  const { batch = true } = options || {};
  await page.goto('/');
  await connectMockWalletAndAcceptTerms(page, { batch });
  await page.waitForTimeout(1000);
  await switchToL2(page, networkName);
  await dismissCookieBanner(page);
  await page.getByRole('tab', { name: 'Convert' }).click();
  await clickPsmCard(page);
};

export const runPsmConversionTests = async ({ networkName }: { networkName: NetworkName }) => {
  const isMainnet = networkName === NetworkName.mainnet;

  // ─────────────────────────────────────────────────────────────────────────
  // Navigation & page structure
  // ─────────────────────────────────────────────────────────────────────────

  test.describe('PSM Conversion — Navigation & UI', () => {
    test('Navigating to 1:1 Conversion shows the widget', async ({ isolatedPage }) => {
      if (isMainnet) {
        await navigateToPsm(isolatedPage);
      } else {
        await navigateToPsmL2(isolatedPage, networkName);
      }

      await expect(
        isolatedPage.getByTestId('widget-container').getByRole('heading', { name: '1:1 Conversion' })
      ).toBeVisible();
      await expect(
        isolatedPage.getByText(
          'Convert your USDC to USDS, or USDS to USDC at 1:1 rate with no fees and slippage'
        )
      ).toBeVisible();
    });

    test('Shows "Enter amount" button when no amount is entered', async ({ isolatedPage }) => {
      if (isMainnet) {
        await navigateToPsm(isolatedPage);
      } else {
        await navigateToPsmL2(isolatedPage, networkName);
      }

      await expect(isolatedPage.getByTestId('widget-button').getByText('Enter amount')).toBeVisible();
      await expect(isolatedPage.getByTestId('widget-button').last()).toBeDisabled();
    });

    test('Shows origin and target token inputs with correct labels', async ({ isolatedPage }) => {
      if (isMainnet) {
        await navigateToPsm(isolatedPage);
      } else {
        await navigateToPsmL2(isolatedPage, networkName);
      }

      await expect(isolatedPage.getByText('Enter the amount to convert')).toBeVisible();
      await expect(isolatedPage.getByText('You will receive')).toBeVisible();
      await expect(isolatedPage.locator('[data-testid="psm-conversion-origin"]')).toBeVisible();
      await expect(isolatedPage.locator('[data-testid="psm-conversion-target"]')).toBeVisible();
    });

    test('Back to Convert returns to Convert landing', async ({ isolatedPage }) => {
      if (isMainnet) {
        await navigateToPsm(isolatedPage);
      } else {
        await navigateToPsmL2(isolatedPage, networkName);
      }

      await expect(
        isolatedPage.getByTestId('widget-container').getByRole('heading', { name: '1:1 Conversion' })
      ).toBeVisible();
      await isolatedPage.getByRole('button', { name: 'Back to Convert' }).click();

      await expect(
        isolatedPage.getByTestId('widget-container').getByRole('heading', { name: 'Convert', exact: true })
      ).toBeVisible();
      await expect(
        isolatedPage
          .getByTestId('widget-container')
          .getByText('Get Sky ecosystem tokens with best possible rates')
      ).toBeVisible();
    });

    test('Shows wallet balances when connected', async ({ isolatedPage }) => {
      if (isMainnet) {
        await navigateToPsm(isolatedPage);
      } else {
        await navigateToPsmL2(isolatedPage, networkName);
      }

      await expect(isolatedPage.getByTestId('psm-conversion-origin-balance')).toBeVisible();
      await expect(isolatedPage.getByTestId('psm-conversion-target-balance')).toBeVisible();
      await expect(isolatedPage.getByTestId('psm-conversion-origin-balance')).not.toHaveText(
        'No wallet connected'
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Amount entry & validation
  // ─────────────────────────────────────────────────────────────────────────

  test.describe('PSM Conversion — Amount entry', () => {
    test('Entering an amount enables the Review button', async ({ isolatedPage }) => {
      if (isMainnet) {
        await navigateToPsm(isolatedPage);
      } else {
        await navigateToPsmL2(isolatedPage, networkName);
      }

      await isolatedPage.getByTestId('psm-conversion-origin').fill('10');

      await expect(isolatedPage.getByTestId('widget-button').getByText('Review')).toBeVisible();
      await expect(isolatedPage.getByTestId('widget-button').last()).toBeEnabled();
    });

    test('Target amount mirrors origin amount 1:1', async ({ isolatedPage }) => {
      if (isMainnet) {
        await navigateToPsm(isolatedPage);
      } else {
        await navigateToPsmL2(isolatedPage, networkName);
      }

      await isolatedPage.getByTestId('psm-conversion-origin').fill('225');

      await expect(isolatedPage.getByTestId('psm-conversion-target')).toHaveValue('225');
    });

    test('Shows Transaction overview when amount is entered', async ({ isolatedPage }) => {
      if (isMainnet) {
        await navigateToPsm(isolatedPage);
      } else {
        await navigateToPsmL2(isolatedPage, networkName);
      }

      await isolatedPage.getByTestId('psm-conversion-origin').fill('100');

      await expect(isolatedPage.getByText('Transaction overview')).toBeVisible();
      await expect(isolatedPage.getByText('Exchange Rate')).toBeVisible();
      await expect(isolatedPage.getByText('1:1', { exact: true })).toBeVisible();
      await expect(isolatedPage.getByText('Tokens to receive')).toBeVisible();
    });
    test('Percentage buttons set correct amounts', async ({ isolatedPage }) => {
      if (isMainnet) {
        await navigateToPsm(isolatedPage);
      } else {
        await navigateToPsmL2(isolatedPage, networkName);
      }

      // Click the 100% button to set max amount
      await isolatedPage.getByTestId('psm-conversion-origin-max').click();

      // The origin input should have a non-zero value
      const originValue = await isolatedPage.getByTestId('psm-conversion-origin').inputValue();
      expect(parseFloat(originValue)).toBeGreaterThan(0);

      // The target should match
      const targetValue = await isolatedPage.getByTestId('psm-conversion-target').inputValue();
      expect(parseFloat(targetValue)).toBeGreaterThan(0);
    });

    test('Shows "Insufficient funds" when amount exceeds balance', async ({ isolatedPage }) => {
      if (isMainnet) {
        await navigateToPsm(isolatedPage);
      } else {
        await navigateToPsmL2(isolatedPage, networkName);
      }

      await isolatedPage.getByTestId('psm-conversion-origin').fill('999999999');

      await expect(isolatedPage.getByText('Insufficient funds')).toBeVisible();
      await expect(isolatedPage.getByTestId('widget-button').last()).toBeDisabled();
    });

    test('Clearing amount resets to "Enter amount" state', async ({ isolatedPage }) => {
      if (isMainnet) {
        await navigateToPsm(isolatedPage);
      } else {
        await navigateToPsmL2(isolatedPage, networkName);
      }

      await isolatedPage.getByTestId('psm-conversion-origin').fill('100');
      await expect(isolatedPage.getByTestId('widget-button').getByText('Review')).toBeVisible();

      await isolatedPage.getByTestId('psm-conversion-origin').fill('');

      await expect(isolatedPage.getByTestId('widget-button').getByText('Enter amount')).toBeVisible();
      await expect(isolatedPage.getByTestId('widget-button').last()).toBeDisabled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Direction switching
  // ─────────────────────────────────────────────────────────────────────────

  test.describe('PSM Conversion — Direction switching', () => {
    test('Switch direction changes USDC→USDS to USDS→USDC', async ({ isolatedPage }) => {
      if (isMainnet) {
        await navigateToPsm(isolatedPage);
      } else {
        await navigateToPsmL2(isolatedPage, networkName);
      }

      // Default: USDC → USDS (balance labels contain the token symbol)
      await expect(isolatedPage.getByTestId('psm-conversion-origin-balance')).toContainText('USDC');
      await expect(isolatedPage.getByTestId('psm-conversion-target-balance')).toContainText('USDS');

      // Click the switch direction button
      await isolatedPage.getByLabel('Switch conversion direction').click();

      // After switch: USDS → USDC
      await expect(isolatedPage.getByTestId('psm-conversion-origin-balance')).toContainText('USDS');
      await expect(isolatedPage.getByTestId('psm-conversion-target-balance')).toContainText('USDC');
    });

    test('Switch direction preserves the converted amount', async ({ isolatedPage }) => {
      if (isMainnet) {
        await navigateToPsm(isolatedPage);
      } else {
        await navigateToPsmL2(isolatedPage, networkName);
      }

      await isolatedPage.getByTestId('psm-conversion-origin').fill('50');
      await expect(isolatedPage.getByTestId('psm-conversion-target')).toHaveValue('50');

      await isolatedPage.getByLabel('Switch conversion direction').click();

      // The target amount from before (50 USDS) becomes the new origin
      const originValue = await isolatedPage.getByTestId('psm-conversion-origin').inputValue();
      expect(parseFloat(originValue)).toBe(50);
    });

    test('Double switch returns to original direction', async ({ isolatedPage }) => {
      if (isMainnet) {
        await navigateToPsm(isolatedPage);
      } else {
        await navigateToPsmL2(isolatedPage, networkName);
      }

      await expect(isolatedPage.getByTestId('psm-conversion-origin-balance')).toContainText('USDC');

      await isolatedPage.getByLabel('Switch conversion direction').click();
      await expect(isolatedPage.getByTestId('psm-conversion-origin-balance')).toContainText('USDS');

      await isolatedPage.getByLabel('Switch conversion direction').click();
      await expect(isolatedPage.getByTestId('psm-conversion-origin-balance')).toContainText('USDC');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Review screen
  // ─────────────────────────────────────────────────────────────────────────

  test.describe('PSM Conversion — Review screen', () => {
    test('Review screen shows correct conversion details (USDC → USDS)', async ({ isolatedPage }) => {
      if (isMainnet) {
        await navigateToPsm(isolatedPage);
      } else {
        await navigateToPsmL2(isolatedPage, networkName);
      }

      await isolatedPage.getByTestId('psm-conversion-origin').fill('225');
      await isolatedPage.getByTestId('widget-button').getByText('Review').click();

      const reviewCard = isolatedPage.getByTestId('widget-container');
      await expect(reviewCard.getByRole('heading', { name: 'Review conversion' })).toBeVisible();
      await expect(reviewCard.getByText('225 USDC').first()).toBeVisible();
      await expect(reviewCard.getByText('225 USDS').first()).toBeVisible();
      await expect(reviewCard.getByText('Approve').first()).toBeVisible();
      await expect(reviewCard.getByText('Convert').first()).toBeVisible();
    });

    test('Review screen shows correct details for USDS → USDC', async ({ isolatedPage }) => {
      if (isMainnet) {
        await navigateToPsm(isolatedPage);
      } else {
        await navigateToPsmL2(isolatedPage, networkName);
      }

      await isolatedPage.getByLabel('Switch conversion direction').click();
      await isolatedPage.getByTestId('psm-conversion-origin').fill('100');
      await isolatedPage.getByTestId('widget-button').getByText('Review').click();

      const reviewCard = isolatedPage.getByTestId('widget-container');
      await expect(reviewCard.getByRole('heading', { name: 'Review conversion' })).toBeVisible();
      await expect(reviewCard.getByText('100 USDS').first()).toBeVisible();
      await expect(reviewCard.getByText('100 USDC').first()).toBeVisible();
    });

    test('Back button on review returns to input screen', async ({ isolatedPage }) => {
      if (isMainnet) {
        await navigateToPsm(isolatedPage);
      } else {
        await navigateToPsmL2(isolatedPage, networkName);
      }

      await isolatedPage.getByTestId('psm-conversion-origin').fill('100');
      await isolatedPage.getByTestId('widget-button').getByText('Review').click();

      await expect(isolatedPage.getByText('Review conversion')).toBeVisible();

      await isolatedPage.getByRole('button', { name: 'Back' }).last().click();

      await expect(isolatedPage.getByText('Enter the amount to convert')).toBeVisible();
      await expect(isolatedPage.getByTestId('psm-conversion-origin')).toBeVisible();
    });

    test('Review screen shows bundle transactions toggle', async ({ isolatedPage }) => {
      if (isMainnet) {
        await navigateToPsm(isolatedPage);
      } else {
        await navigateToPsmL2(isolatedPage, networkName);
      }

      await isolatedPage.getByTestId('psm-conversion-origin').fill('100');
      await isolatedPage.getByTestId('widget-button').getByText('Review').click();

      await expect(isolatedPage.getByText('Bundle transactions')).toBeVisible();
      await expect(isolatedPage.getByRole('switch')).toBeVisible();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Bundled (batch) transaction flow
  // ─────────────────────────────────────────────────────────────────────────

  test.describe('PSM Conversion — Bundled transaction', () => {
    test('USDC to USDS bundled conversion completes successfully', async ({ isolatedPage }) => {
      if (isMainnet) {
        await navigateToPsm(isolatedPage);
      } else {
        await navigateToPsmL2(isolatedPage, networkName);
      }

      await isolatedPage.getByTestId('psm-conversion-origin').fill('5');

      await performAction(isolatedPage, 'Convert');

      await expect(isolatedPage.getByText('Conversion complete')).toBeVisible({ timeout: 15000 });
      await expect(isolatedPage.getByText(/Converted 5 USDC into 5 USDS/)).toBeVisible();
    });

    test('USDS to USDC bundled conversion completes successfully', async ({ isolatedPage }) => {
      if (isMainnet) {
        await navigateToPsm(isolatedPage);
      } else {
        await navigateToPsmL2(isolatedPage, networkName);
      }

      await isolatedPage.getByLabel('Switch conversion direction').click();
      await isolatedPage.getByTestId('psm-conversion-origin').fill('5');

      await performAction(isolatedPage, 'Convert');

      await expect(isolatedPage.getByText('Conversion complete')).toBeVisible({ timeout: 15000 });
      await expect(isolatedPage.getByText(/Converted 5 USDS into 5 USDC/)).toBeVisible();
    });

    test('Bundled conversion shows step indicators', async ({ isolatedPage }) => {
      if (isMainnet) {
        await navigateToPsm(isolatedPage);
      } else {
        await navigateToPsmL2(isolatedPage, networkName);
      }

      await isolatedPage.getByTestId('psm-conversion-origin').fill('5');
      await isolatedPage.getByTestId('widget-button').getByText('Review').first().click();

      const stepIndicators = isolatedPage.getByTestId('step-indicator');
      await expect(stepIndicators.filter({ hasText: 'Approve' })).toBeVisible();
      await expect(stepIndicators.filter({ hasText: 'Convert' })).toBeVisible();
    });

    test('Confirm button text shows "Confirm bundled transaction" when batch enabled', async ({
      isolatedPage
    }) => {
      if (isMainnet) {
        await navigateToPsm(isolatedPage);
      } else {
        await navigateToPsmL2(isolatedPage, networkName);
      }

      await isolatedPage.getByTestId('psm-conversion-origin').fill('5');
      await isolatedPage.getByTestId('widget-button').getByText('Review').first().click();

      await expect(isolatedPage.getByTestId('widget-button').last()).toHaveText(
        /Confirm bundled transaction|Confirm conversion/
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Sequential (non-batch) transaction flow
  // ─────────────────────────────────────────────────────────────────────────

  test.describe('PSM Conversion — Sequential transaction', () => {
    test('USDC to USDS sequential conversion completes in two steps', async ({ isolatedPage }) => {
      if (isMainnet) {
        await navigateToPsm(isolatedPage);
      } else {
        await navigateToPsmL2(isolatedPage, networkName);
      }

      await isolatedPage.getByTestId('psm-conversion-origin').fill('5');

      await performSequentialAction(isolatedPage, 'Convert');

      await expect(isolatedPage.getByRole('heading', { name: 'Conversion complete' })).toBeVisible({
        timeout: 15000
      });
    });

    test('Toggle off shows "Confirm 2 transactions" on Review screen', async ({ isolatedPage }) => {
      if (isMainnet) {
        await navigateToPsm(isolatedPage);
      } else {
        await navigateToPsmL2(isolatedPage, networkName);
      }

      await isolatedPage.getByTestId('psm-conversion-origin').fill('5');
      await isolatedPage.getByTestId('widget-button').getByText('Review').first().click();

      await expect(isolatedPage.getByTestId('widget-button').last()).toHaveText(
        /Confirm bundled transaction|Confirm conversion/
      );

      await disableBundledTx(isolatedPage);

      await expect(isolatedPage.getByTestId('widget-button').last()).toHaveText(
        /Confirm 2 transactions|Confirm conversion/
      );
    });

    test('USDS to USDC sequential conversion completes in two steps', async ({ isolatedPage }) => {
      if (isMainnet) {
        await navigateToPsm(isolatedPage);
      } else {
        await navigateToPsmL2(isolatedPage, networkName);
      }

      await isolatedPage.getByLabel('Switch conversion direction').click();
      await isolatedPage.getByTestId('psm-conversion-origin').fill('5');

      await performSequentialAction(isolatedPage, 'Convert');

      await expect(isolatedPage.getByRole('heading', { name: 'Conversion complete' })).toBeVisible({
        timeout: 15000
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Convert again (post-success flow)
  // ─────────────────────────────────────────────────────────────────────────

  test.describe('PSM Conversion — Post-transaction', () => {
    test('Convert again resets the widget for a new conversion', async ({ isolatedPage }) => {
      if (isMainnet) {
        await navigateToPsm(isolatedPage);
      } else {
        await navigateToPsmL2(isolatedPage, networkName);
      }

      await isolatedPage.getByTestId('psm-conversion-origin').fill('2');

      await performAction(isolatedPage, 'Convert');

      await expect(isolatedPage.getByText('Conversion complete')).toBeVisible({ timeout: 15000 });

      // Click "Convert again"
      await isolatedPage.getByTestId('widget-button').getByText('Convert again').click();

      // Should be back on the input screen
      await expect(isolatedPage.getByText('Enter the amount to convert')).toBeVisible();
      await expect(isolatedPage.getByTestId('psm-conversion-origin')).toBeVisible();
      await expect(isolatedPage.getByTestId('widget-button').getByText('Enter amount')).toBeVisible();
    });

    test('Etherscan link is visible after successful conversion', async ({ isolatedPage }) => {
      if (isMainnet) {
        await navigateToPsm(isolatedPage);
      } else {
        await navigateToPsmL2(isolatedPage, networkName);
      }

      await isolatedPage.getByTestId('psm-conversion-origin').fill('2');

      await performAction(isolatedPage, 'Convert');

      await expect(isolatedPage.getByText('Conversion complete')).toBeVisible({ timeout: 15000 });
      // await expect(isolatedPage.getByText('View on Etherscan')).toBeVisible();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Transaction rejection / error handling
  // ─────────────────────────────────────────────────────────────────────────

  test.describe('PSM Conversion — Error handling', () => {
    test('Rejected bundled transaction shows error screen', async ({ isolatedPage }) => {
      if (isMainnet) {
        await navigateToPsm(isolatedPage);
      } else {
        await navigateToPsmL2(isolatedPage, networkName);
      }

      await isolatedPage.getByTestId('psm-conversion-origin').fill('5');

      await approveOrPerformAction(isolatedPage, 'Convert', { reject: true });

      await expect(isolatedPage.getByText(/error|failed/i).first()).toBeVisible({ timeout: 15000 });
    });

    test.skip('Retry after error re-executes the transaction', async ({ isolatedPage }) => {
      if (isMainnet) {
        await navigateToPsm(isolatedPage);
      } else {
        await navigateToPsmL2(isolatedPage, networkName);
      }

      await isolatedPage.getByTestId('psm-conversion-origin').fill('2');

      // Reject the transaction
      await approveOrPerformAction(isolatedPage, 'Convert', { reject: true });
      await expect(isolatedPage.getByText(/error|failed/i).first()).toBeVisible({ timeout: 15000 });

      //retry button
      const retryButton = isolatedPage.getByTestId('widget-button').last();
      await expect(retryButton).toBeEnabled({ timeout: 10000 });

      // Remove the rejection interceptor
      await interceptAndAllowTransactions(isolatedPage);

      // Click Retry (last widget-button; first is Back)
      await isolatedPage.getByTestId('widget-button').last().click();

      await expect(isolatedPage.getByRole('heading', { name: 'Conversion complete' })).toBeVisible({
        timeout: 30000
      });
    });

    test('Back button after error returns to input screen', async ({ isolatedPage }) => {
      if (isMainnet) {
        await navigateToPsm(isolatedPage);
      } else {
        await navigateToPsmL2(isolatedPage, networkName);
      }

      await isolatedPage.getByTestId('psm-conversion-origin').fill('2');

      await approveOrPerformAction(isolatedPage, 'Convert', { reject: true });
      await expect(isolatedPage.getByText(/error|failed/i).first()).toBeVisible({ timeout: 15000 });

      await isolatedPage.getByRole('button', { name: 'Back' }).last().click();

      await expect(isolatedPage.getByText('Enter the amount to convert')).toBeVisible();
      await expect(isolatedPage.getByTestId('psm-conversion-origin')).toBeVisible();
    });

    test.skip('Sequential: approve succeeds but convert rejected shows error', async ({ isolatedPage }) => {
      if (isMainnet) {
        await navigateToPsm(isolatedPage);
      } else {
        await navigateToPsmL2(isolatedPage, networkName);
      }

      await isolatedPage.getByTestId('psm-conversion-origin').fill('2');

      await performSequentialAction(isolatedPage, 'Convert', { rejectStep2: true });

      await expect(isolatedPage.getByText(/error|failed/i).first()).toBeVisible({ timeout: 15000 });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Stale-state regression (sequential flow)
  // ─────────────────────────────────────────────────────────────────────────

  test.describe('PSM Conversion — Stale-state regression', () => {
    test.skip('Changed amount is used after step-2 rejection and Back', async ({ isolatedPage }) => {
      if (isMainnet) {
        await navigateToPsm(isolatedPage);
      } else {
        await navigateToPsmL2(isolatedPage, networkName);
      }

      // First attempt: approve succeeds, convert tx is rejected
      await isolatedPage.getByTestId('psm-conversion-origin').fill('3');
      await isolatedPage.getByTestId('widget-button').getByText('Review').first().click();
      await disableBundledTx(isolatedPage);

      const confirmButton = isolatedPage.getByTestId('widget-button').last();
      await expect(confirmButton).toBeEnabled();

      await interceptAndRejectSecondTransaction(isolatedPage, 200);
      await confirmButton.click();

      await expect(isolatedPage.getByText(/error/i).first()).toBeVisible({ timeout: 15000 });

      // Go back and change the amount
      await isolatedPage.getByRole('button', { name: 'Back' }).last().click();
      await expect(isolatedPage.getByTestId('psm-conversion-origin')).toBeVisible();
      await isolatedPage.getByTestId('psm-conversion-origin').fill('5');

      // Second attempt should succeed
      await isolatedPage.getByTestId('widget-button').getByText('Review').first().click();

      const toggle = isolatedPage.getByRole('switch');
      const toggleVisible = await toggle.isVisible().catch(() => false);
      if (toggleVisible) {
        const isChecked = await toggle.isChecked();
        if (isChecked) await toggle.click();
      }

      const retryButton = isolatedPage.getByTestId('widget-button').last();
      await expect(retryButton).toBeEnabled({ timeout: 10000 });
      await interceptAndAllowTransactions(isolatedPage);
      await retryButton.click();

      await expect(isolatedPage.getByRole('heading', { name: 'Conversion complete' })).toBeVisible({
        timeout: 30000
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // URL state sync
  // ─────────────────────────────────────────────────────────────────────────

  test.describe('PSM Conversion — URL state', () => {
    test('Navigating directly via URL params loads PSM widget', async ({ isolatedPage }) => {
      if (isMainnet) {
        await isolatedPage.goto('/?widget=convert&convert_module=psm');
      } else {
        await isolatedPage.goto('/?widget=convert&convert_module=psm');
        await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
        await isolatedPage.waitForTimeout(1000);
        await switchToL2(isolatedPage, networkName);
        // Re-navigate after network switch
        await isolatedPage.goto('/?widget=convert&convert_module=psm');
      }

      await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
      await isolatedPage.waitForTimeout(1000);

      await expect(
        isolatedPage.getByTestId('widget-container').getByRole('heading', { name: '1:1 Conversion' })
      ).toBeVisible();
    });

    test('URL params with source_token=USDS starts in USDS→USDC direction', async ({ isolatedPage }) => {
      if (isMainnet) {
        await isolatedPage.goto('/?widget=convert&convert_module=psm&source_token=USDS');
        await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
      } else {
        await isolatedPage.goto('/?widget=convert&convert_module=psm&source_token=USDS');
        await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
        await isolatedPage.waitForTimeout(1000);
        await switchToL2(isolatedPage, networkName);
      }

      await isolatedPage.waitForTimeout(1000);

      await expect(isolatedPage.getByTestId('psm-conversion-origin-balance')).toContainText('USDS');
      await expect(isolatedPage.getByTestId('psm-conversion-target-balance')).toContainText('USDC');
    });

    test('URL params with input_amount pre-fills the origin amount', async ({ isolatedPage }) => {
      if (isMainnet) {
        await isolatedPage.goto('/?widget=convert&convert_module=psm&input_amount=42');
        await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
      } else {
        await isolatedPage.goto('/?widget=convert&convert_module=psm&input_amount=42');
        await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
        await isolatedPage.waitForTimeout(1000);
        await switchToL2(isolatedPage, networkName);
      }

      await isolatedPage.waitForTimeout(1000);

      await expect(isolatedPage.getByTestId('psm-conversion-origin')).toHaveValue('42');
      await expect(isolatedPage.getByTestId('psm-conversion-target')).toHaveValue('42');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Round-trip conversion
  // ─────────────────────────────────────────────────────────────────────────

  test.describe('PSM Conversion — Round-trip', () => {
    test('Convert USDC to USDS, then USDS back to USDC', async ({ isolatedPage }) => {
      if (isMainnet) {
        await navigateToPsm(isolatedPage);
      } else {
        await navigateToPsmL2(isolatedPage, networkName);
      }

      // USDC → USDS
      await isolatedPage.getByTestId('psm-conversion-origin').fill('3');
      await performAction(isolatedPage, 'Convert');
      await expect(isolatedPage.getByText('Conversion complete')).toBeVisible({ timeout: 15000 });
      await expect(isolatedPage.getByText(/Converted 3 USDC into 3 USDS/)).toBeVisible();

      // Convert again
      await isolatedPage.getByTestId('widget-button').getByText('Convert again').click();

      // Switch to USDS → USDC
      await isolatedPage.getByLabel('Switch conversion direction').click();
      await isolatedPage.getByTestId('psm-conversion-origin').fill('3');

      await performAction(isolatedPage, 'Convert');
      await expect(isolatedPage.getByText('Conversion complete')).toBeVisible({ timeout: 15000 });
      await expect(isolatedPage.getByText(/Converted 3 USDS into 3 USDC/)).toBeVisible();
    });
  });
};
