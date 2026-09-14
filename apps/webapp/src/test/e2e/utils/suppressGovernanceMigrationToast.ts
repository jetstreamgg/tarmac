import type { Page } from '@playwright/test';

/** MKR→SKY migration toast blocks clicks on funded pool accounts for ~10s. */
export async function suppressGovernanceMigrationToast(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem('governance-migration-notice-shown', 'true');
  });
}
