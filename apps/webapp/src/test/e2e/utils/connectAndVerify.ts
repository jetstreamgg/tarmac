import { expect, type Page } from '@playwright/test';
import { connectMockWalletAndAcceptTerms } from './connectMockWalletAndAcceptTerms';

/**
 * connectMockWalletAndAcceptTerms with verification: retries until the wallet
 * chip shows the connected address. The bare helper clicks the mock connect
 * button without checking the outcome — a click that lands before wagmi is
 * ready silently no-ops and leaves the run disconnected.
 */
export const connectAndVerify = async (page: Page, options?: { batch?: boolean }) => {
  const chip = page.getByTestId('wallet-chip');
  await expect(async () => {
    const text = await chip.innerText().catch(() => '');
    if (!/0x/.test(text)) {
      await connectMockWalletAndAcceptTerms(page, options);
    }
    await expect(chip).toContainText(/0x/, { timeout: 10_000 });
  }).toPass({ timeout: 90_000 });
};
