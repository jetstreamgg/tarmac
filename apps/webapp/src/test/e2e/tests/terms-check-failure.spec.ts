import { expect, test } from '@playwright/test';
import { setupTermsCheckFailureRoutes } from '../utils/setupTermsCheckFailureRoutes';

test.describe('Terms check — network failure', () => {
  test.beforeEach(async ({ page }) => {
    await setupTermsCheckFailureRoutes(page);
  });

  test('shows error modal with Retry and Disconnect when terms /check fails', async ({ page }) => {
    await page.goto('/');

    await page
      .getByRole('button', { name: /Connect .*Mock Wallet/i })
      .first()
      .click();

    await expect(page.getByText('Something went wrong')).toBeVisible({ timeout: 25000 });
    await expect(page.getByText(/verify your terms acceptance/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Disconnect Wallet' })).toBeVisible();
  });
});
