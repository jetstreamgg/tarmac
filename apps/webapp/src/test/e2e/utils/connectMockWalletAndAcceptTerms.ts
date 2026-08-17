import { type Page } from '@playwright/test';

export const connectMockWalletAndAcceptTerms = async (page: Page, { batch }: { batch?: boolean } = {}) => {
  await page
    .getByRole('button', { name: batch ? 'Connect Batch Mock Wallet' : 'Connect Mock Wallet' })
    .first()
    .click();

  try {
    // The signature-free modal (APP-500): no scroll gate any more — the box is
    // tickable immediately and gates the CTA on its own.
    await page.getByTestId('terms-modal').waitFor({ timeout: 2000 });
    await page.getByRole('checkbox').click();
    await page.getByRole('button', { name: 'Agree and continue' }).click();
    await page.waitForTimeout(5000);
  } catch (error) {
    console.error('Error accepting terms: ', error);
    console.log('Skipping terms acceptance');
    return;
  }
};
