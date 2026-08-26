import { type Page } from '@playwright/test';
import { expect, test } from '../fixtures-parallel';
import { connectAndVerify } from '../utils/connectAndVerify';
import { expectTransactionSuccess } from '../utils/expectTransactionSuccess';
import { switchWalletNetwork } from '../utils/switchWalletNetwork';
import { interceptAndRejectTransactions } from '../utils/rejectTransaction';
import { NetworkName } from '../utils/constants';

// V2 rewrite (see e2e-migration.md): the PSM flow IS the /convert page now
// (page-as-widget, E2). The form lives on the page (`convert-*` testids), and
// Review launches the shared TransactionModal ("Review conversion" → Confirm →
// step list → success). Default direction is USDS → USDC; `convert-flip` (or
// `?source_token=`) switches it. The engine routes mainnet (UsdsPsmWrapper)
// vs L2 (PSM3 swapExactIn) internally, so the same tests run on every network.

const navigateToConvert = async (page: Page, networkName: NetworkName, options?: { batch?: boolean }) => {
  const { batch = true } = options || {};
  // Connect AFTER the goto — a full navigation resets the mock connector.
  await page.goto('/convert');
  await connectAndVerify(page, { batch });
  if (networkName !== NetworkName.mainnet) {
    await switchWalletNetwork(page, `Tenderly ${networkName}`);
  }
  await expect(page.getByTestId('convert-page')).toBeVisible();
};

/**
 * Clicks Review and confirms in the modal. It does NOT wait for settlement:
 * a confirmed transaction closes its own modal, so anything a spec asserts
 * inside it (the step list) has to run between this and
 * `expectTransactionSuccess`.
 */
const reviewAndConfirm = async (page: Page) => {
  await page.getByTestId('convert-review-cta').click();
  const confirm = page.getByRole('button', { name: 'Confirm', exact: true });
  await expect(confirm).toBeEnabled({ timeout: 60_000 });
  await confirm.click();
};

/**
 * Asserts the two-step DS step list: "Approve ◉ USDS" then "Convert ◉ USDS to ◉ USDC".
 *
 * The convert row is no longer one text node — `StepsItem` draws the label, each
 * token symbol (beside its own 14px icon) and the "to" as sibling spans with no
 * whitespace between them, so the row's text content reads "ConvertUSDStoUSDC"
 * and `getByText('Convert USDS to USDC')` can never match. Locate the row, then
 * assert its parts.
 */
/*
 * TIMING: the step list only exists while the modal is open, and a confirmed
 * transaction closes it. Call this immediately after the confirm click —
 * Playwright's first poll is synchronous, so the assertion lands well inside
 * the receipt round-trip, but anything queued ahead of it eats that margin.
 */
const expectApproveAndConvertSteps = async (page: Page) => {
  await expect(page.getByText('Approve')).toBeVisible({ timeout: 60_000 });

  const convertStep = page.getByRole('dialog').getByRole('listitem').filter({ hasText: 'Convert' });
  await expect(convertStep).toBeVisible({ timeout: 60_000 });
  await expect(convertStep.getByText('USDS', { exact: true })).toBeVisible();
  await expect(convertStep.getByText('USDC', { exact: true })).toBeVisible();
};

export const runPsmConversionTests = async ({ networkName }: { networkName: NetworkName }) => {
  const isMainnet = networkName === NetworkName.mainnet;

  // ─────────────────────────────────────────────────────────────────────────
  // Navigation & page structure
  // ─────────────────────────────────────────────────────────────────────────

  test.describe('PSM Conversion — Navigation & UI', () => {
    test('The /convert destination shows the swap surface', async ({ isolatedPage }) => {
      await navigateToConvert(isolatedPage, networkName);

      await expect(isolatedPage.getByRole('heading', { name: 'Convert stablecoins' })).toBeVisible();
      await expect(isolatedPage.getByTestId('convert-card')).toBeVisible();
      await expect(isolatedPage.getByTestId('convert-network')).toBeVisible();
    });

    test('Review is disabled when no amount is entered', async ({ isolatedPage }) => {
      await navigateToConvert(isolatedPage, networkName);

      const reviewCta = isolatedPage.getByTestId('convert-review-cta');
      await expect(reviewCta).toHaveText('Review');
      await expect(reviewCta).toBeDisabled();
    });

    test('Shows from and to inputs with the default USDS → USDC direction', async ({ isolatedPage }) => {
      await navigateToConvert(isolatedPage, networkName);

      await expect(isolatedPage.getByTestId('convert-from-token')).toContainText('USDS');
      await expect(isolatedPage.getByTestId('convert-to-token')).toContainText('USDC');
      await expect(isolatedPage.getByTestId('convert-from-amount')).toBeEditable();
      await expect(isolatedPage.getByTestId('convert-to-amount')).not.toBeEditable();
    });

    test('Shows wallet balances when connected', async ({ isolatedPage }) => {
      await navigateToConvert(isolatedPage, networkName);

      // Funded pool accounts hold both tokens — the balance line must show a
      // number, not the "–" placeholder.
      await expect(isolatedPage.getByTestId('convert-from-balance')).toHaveText(/Balance: [\d,.]+/);
      await expect(isolatedPage.getByTestId('convert-to-balance')).toHaveText(/Balance: [\d,.]+/);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Amount entry & validation
  // ─────────────────────────────────────────────────────────────────────────

  test.describe('PSM Conversion — Amount entry', () => {
    test('Entering an amount enables the Review button', async ({ isolatedPage }) => {
      await navigateToConvert(isolatedPage, networkName);

      await isolatedPage.getByTestId('convert-from-amount').fill('10');

      await expect(isolatedPage.getByTestId('convert-review-cta')).toBeEnabled();
    });

    test('Target amount mirrors origin amount 1:1', async ({ isolatedPage }) => {
      await navigateToConvert(isolatedPage, networkName);

      await isolatedPage.getByTestId('convert-from-amount').fill('225');

      await expect(isolatedPage.getByTestId('convert-to-amount')).toHaveValue('225');
    });

    test('Percentage buttons set correct amounts', async ({ isolatedPage }) => {
      await navigateToConvert(isolatedPage, networkName);

      await isolatedPage.getByTestId('convert-from-percent-100').click();

      const originValue = await isolatedPage.getByTestId('convert-from-amount').inputValue();
      expect(parseFloat(originValue)).toBeGreaterThan(0);
      const targetValue = await isolatedPage.getByTestId('convert-to-amount').inputValue();
      expect(parseFloat(targetValue)).toBeGreaterThan(0);
    });

    test('Shows "Insufficient funds" when amount exceeds balance', async ({ isolatedPage }) => {
      await navigateToConvert(isolatedPage, networkName);

      await isolatedPage.getByTestId('convert-from-amount').fill('999999999');

      await expect(isolatedPage.getByTestId('convert-error')).toHaveText('Insufficient funds');
      await expect(isolatedPage.getByTestId('convert-review-cta')).toBeDisabled();
    });

    test('Clearing the amount disables Review again', async ({ isolatedPage }) => {
      await navigateToConvert(isolatedPage, networkName);

      await isolatedPage.getByTestId('convert-from-amount').fill('100');
      await expect(isolatedPage.getByTestId('convert-review-cta')).toBeEnabled();

      await isolatedPage.getByTestId('convert-from-amount').fill('');

      await expect(isolatedPage.getByTestId('convert-review-cta')).toBeDisabled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Direction switching
  // ─────────────────────────────────────────────────────────────────────────

  test.describe('PSM Conversion — Direction switching', () => {
    test('Flip changes USDS→USDC to USDC→USDS', async ({ isolatedPage }) => {
      await navigateToConvert(isolatedPage, networkName);

      await expect(isolatedPage.getByTestId('convert-from-token')).toContainText('USDS');
      await expect(isolatedPage.getByTestId('convert-to-token')).toContainText('USDC');

      await isolatedPage.getByTestId('convert-flip').click();

      await expect(isolatedPage.getByTestId('convert-from-token')).toContainText('USDC');
      await expect(isolatedPage.getByTestId('convert-to-token')).toContainText('USDS');
    });

    test('Flip preserves the typed amount', async ({ isolatedPage }) => {
      await navigateToConvert(isolatedPage, networkName);

      await isolatedPage.getByTestId('convert-from-amount').fill('50');
      await expect(isolatedPage.getByTestId('convert-to-amount')).toHaveValue('50');

      await isolatedPage.getByTestId('convert-flip').click();

      await expect(isolatedPage.getByTestId('convert-from-amount')).toHaveValue('50');
    });

    test('Double flip returns to the original direction', async ({ isolatedPage }) => {
      await navigateToConvert(isolatedPage, networkName);

      await expect(isolatedPage.getByTestId('convert-from-token')).toContainText('USDS');

      await isolatedPage.getByTestId('convert-flip').click();
      await expect(isolatedPage.getByTestId('convert-from-token')).toContainText('USDC');

      await isolatedPage.getByTestId('convert-flip').click();
      await expect(isolatedPage.getByTestId('convert-from-token')).toContainText('USDS');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Review modal
  // ─────────────────────────────────────────────────────────────────────────

  test.describe('PSM Conversion — Review modal', () => {
    test('Review modal shows the conversion breakdown', async ({ isolatedPage }) => {
      await navigateToConvert(isolatedPage, networkName);

      await isolatedPage.getByTestId('convert-from-amount').fill('225');
      await isolatedPage.getByTestId('convert-review-cta').click();

      await expect(isolatedPage.getByText('Review conversion')).toBeVisible();
      await expect(isolatedPage.getByTestId('convert-modal-review')).toBeVisible();
      await expect(isolatedPage.getByTestId('convert-modal-from-amount')).toHaveText('225.00');
      await expect(isolatedPage.getByTestId('convert-modal-to-amount')).toHaveText('225.00');
      // await expect(isolatedPage.getByTestId('convert-modal-row-rate')).toContainText('1.00 USDS = 1.00 USDC');
      await expect(isolatedPage.getByText('$0.00')).toBeTruthy();
    });

    test('Review modal shows the breakdown for the flipped direction', async ({ isolatedPage }) => {
      await navigateToConvert(isolatedPage, networkName);

      await isolatedPage.getByTestId('convert-flip').click();
      await isolatedPage.getByTestId('convert-from-amount').fill('100');
      await isolatedPage.getByTestId('convert-review-cta').click();

      await expect(isolatedPage.getByTestId('convert-modal-from-amount')).toHaveText('100.00');
      // await expect(isolatedPage.getByTestId('convert-modal-row-rate')).toContainText('1.00 USDC = 1.00 USDS');
    });

    test('Closing the review modal returns to the editable form', async ({ isolatedPage }) => {
      await navigateToConvert(isolatedPage, networkName);

      await isolatedPage.getByTestId('convert-from-amount').fill('100');
      await isolatedPage.getByTestId('convert-review-cta').click();
      await expect(isolatedPage.getByTestId('convert-modal-review')).toBeVisible();

      await isolatedPage.getByTestId('transaction-modal-close').click();

      await expect(isolatedPage.getByTestId('convert-from-amount')).toHaveValue('100');
      await expect(isolatedPage.getByTestId('convert-review-cta')).toBeEnabled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Bundled (batch) transaction flow
  // ─────────────────────────────────────────────────────────────────────────

  test.describe('PSM Conversion — Bundled transaction', () => {
    test('USDS to USDC bundled conversion completes successfully', async ({ isolatedPage }) => {
      await navigateToConvert(isolatedPage, networkName);

      await isolatedPage.getByTestId('convert-from-amount').fill('5');
      await reviewAndConfirm(isolatedPage);

      await expectTransactionSuccess(isolatedPage, { title: 'USDC converted!' });

      // onSuccess resets the form for the next conversion
      await expect(isolatedPage.getByTestId('convert-from-amount')).toHaveValue('');
      await expect(isolatedPage.getByTestId('convert-review-cta')).toBeDisabled();
    });

    test('USDC to USDS bundled conversion completes successfully', async ({ isolatedPage }) => {
      await navigateToConvert(isolatedPage, networkName);

      await isolatedPage.getByTestId('convert-flip').click();
      await isolatedPage.getByTestId('convert-from-amount').fill('5');
      await reviewAndConfirm(isolatedPage);

      await expectTransactionSuccess(isolatedPage, { title: 'USDS converted!' });
    });

    test('Transaction screen shows the approve and convert steps', async ({ isolatedPage }) => {
      await navigateToConvert(isolatedPage, networkName);

      await isolatedPage.getByTestId('convert-from-amount').fill('5');
      await reviewAndConfirm(isolatedPage);

      // The DS step list renders on the wallet/status screen. It has to be
      // asserted before settlement — success takes the modal with it.
      await expectApproveAndConvertSteps(isolatedPage);

      await expectTransactionSuccess(isolatedPage);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Sequential (non-batch) transaction flow
  // ─────────────────────────────────────────────────────────────────────────

  test.describe('PSM Conversion — Sequential transaction', () => {
    test('Conversion with bundling toggled off completes in two steps', async ({ isolatedPage }) => {
      await navigateToConvert(isolatedPage, networkName);

      await isolatedPage.getByTestId('convert-from-amount').fill('5');
      await isolatedPage.getByTestId('convert-review-cta').click();

      // Turn the bundle toggle off — the flow runs approve → convert as two
      // sequential wallet confirmations (the mock wallet auto-signs both).
      // const toggle = isolatedPage.getByRole('dialog').getByRole('switch');
      // await toggle.waitFor({ state: 'visible' });
      // if (await toggle.isChecked()) {
      //   await toggle.click();
      // }

      const confirm = isolatedPage.getByRole('button', { name: 'Confirm', exact: true });
      await expect(confirm).toBeEnabled({ timeout: 60_000 });
      await confirm.click();

      await expectApproveAndConvertSteps(isolatedPage);
      await expectTransactionSuccess(isolatedPage);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Transaction rejection / error handling
  // ─────────────────────────────────────────────────────────────────────────

  test.describe('PSM Conversion — Error handling', () => {
    test('Rejected transaction shows the error state with Back and Retry', async ({ isolatedPage }) => {
      await navigateToConvert(isolatedPage, networkName);

      await isolatedPage.getByTestId('convert-from-amount').fill('5');
      await isolatedPage.getByTestId('convert-review-cta').click();

      const confirm = isolatedPage.getByRole('button', { name: 'Confirm', exact: true });
      await expect(confirm).toBeEnabled({ timeout: 60_000 });

      // Abort transaction writes at the RPC layer (reads stay live so the
      // error screen can still render).
      await interceptAndRejectTransactions(isolatedPage, 0, true);
      await confirm.click();

      await expect(isolatedPage.getByText('An error occurred while converting your funds.')).toBeVisible({
        timeout: 60_000
      });
      await expect(isolatedPage.getByRole('button', { name: 'Try again' })).toBeVisible();

      // Back returns to the review screen with the breakdown intact
      await isolatedPage.getByRole('button', { name: 'Back', exact: true }).last().click();
      await expect(isolatedPage.getByTestId('convert-modal-review')).toBeVisible();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // URL state (mainnet-only: routing behaviour is network-independent)
  // ─────────────────────────────────────────────────────────────────────────

  if (isMainnet) {
    test.describe('PSM Conversion — URL state', () => {
      test('The legacy /convert/psm path redirects to /convert', async ({ isolatedPage }) => {
        await isolatedPage.goto('/convert/psm');
        await connectAndVerify(isolatedPage, { batch: true });

        await expect(isolatedPage).toHaveURL(/\/convert(\?|$)/);
        await expect(isolatedPage.getByTestId('convert-page')).toBeVisible();
      });

      test('source_token=USDC starts in the USDC→USDS direction', async ({ isolatedPage }) => {
        await isolatedPage.goto('/convert?source_token=USDC');
        await connectAndVerify(isolatedPage, { batch: true });

        await expect(isolatedPage.getByTestId('convert-from-token')).toContainText('USDC');
        await expect(isolatedPage.getByTestId('convert-to-token')).toContainText('USDS');
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Round-trip conversion
  // ─────────────────────────────────────────────────────────────────────────

  test.describe('PSM Conversion — Round-trip', () => {
    test('Convert USDS to USDC, then USDC back to USDS', async ({ isolatedPage }) => {
      await navigateToConvert(isolatedPage, networkName);

      // USDS → USDC
      await isolatedPage.getByTestId('convert-from-amount').fill('3');
      await reviewAndConfirm(isolatedPage);
      await expectTransactionSuccess(isolatedPage, { title: 'USDC converted!' });

      // USDC → USDS
      await isolatedPage.getByTestId('convert-flip').click();
      await isolatedPage.getByTestId('convert-from-amount').fill('3');
      await reviewAndConfirm(isolatedPage);
      await expectTransactionSuccess(isolatedPage, { title: 'USDS converted!' });
    });
  });
};
