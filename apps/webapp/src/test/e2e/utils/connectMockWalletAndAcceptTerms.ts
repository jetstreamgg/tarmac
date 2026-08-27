import { expect, type Page } from '@playwright/test';

export type ConnectMockWalletOptions = {
  batch?: boolean;
  /**
   * For specs that force the compliance checks on (mock-terms-gate.ts): the
   * terms modal MUST appear — its absence would mean the seam silently never
   * landed, and every downstream "no gate" assertion would pass vacuously.
   */
  expectTerms?: boolean;
};

export const connectMockWalletAndAcceptTerms = async (
  page: Page,
  { batch, expectTerms }: ConnectMockWalletOptions = {}
) => {
  await page
    .getByRole('button', { name: batch ? 'Connect Batch Mock Wallet' : 'Connect Mock Wallet' })
    .first()
    .click();

  // The signature-free modal (APP-500): no scroll gate any more — the box is
  // tickable immediately and gates the CTA on its own.
  const modal = page.getByTestId('terms-modal');
  if (expectTerms) {
    await modal.waitFor({ timeout: 10_000 });
  } else {
    // Default e2e build: VITE_SKIP_AUTH_CHECK auto-accepts, so no modal is the
    // normal case — but only swallow its absence when the connect actually
    // landed. Anything else surfaces here, with the real cause, instead of as
    // a misleading timeout much later in the spec.
    try {
      await modal.waitFor({ timeout: 2000 });
    } catch {
      await expect(page.getByTestId('wallet-chip'), 'no terms modal and no connection').toContainText(/0x/, {
        timeout: 10_000
      });
      return;
    }
  }

  await page.getByRole('checkbox').click();
  await page.getByRole('button', { name: 'Agree and continue' }).click();
  // Deterministic completion instead of a fixed sleep: the modal closed and
  // the wallet stayed connected.
  await expect(modal).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByTestId('wallet-chip')).toContainText(/0x/, { timeout: 15_000 });
};
