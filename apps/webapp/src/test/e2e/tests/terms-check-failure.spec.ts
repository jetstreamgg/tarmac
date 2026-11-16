// The aborted /check is the subject of this spec. An empty VITE_TERMS_ENDPOINT
// makes checkTermsWithRetry return before fetch, and the error modal still
// opens, so the POST itself has to be observed.
import { expect, test } from '../fixtures-parallel';
import { forceAuthChecks, mockAddressScreening, mockIpStatus } from '../mock-terms-gate';
import { suppressGovernanceMigrationToast } from '../utils/suppressGovernanceMigrationToast';

test.describe('Terms check — network failure', () => {
  test('shows error modal with Retry and Disconnect when terms /check fails', async ({ isolatedPage }) => {
    await forceAuthChecks(isolatedPage);
    await mockIpStatus(isolatedPage);
    await mockAddressScreening(isolatedPage);
    await isolatedPage.route('**/terms-acceptance/check', route => route.abort('failed'));

    const checkAborted = isolatedPage.waitForEvent('requestfailed', {
      predicate: request => request.method() === 'POST' && request.url().includes('/terms-acceptance/check'),
      timeout: 25000
    });

    await isolatedPage.goto('/');
    // Exact connector, and the migration toast suppressed. connectMockWalletAndAcceptTerms
    // does both, then clicks Agree — this card only offers Retry and Disconnect.
    await suppressGovernanceMigrationToast(isolatedPage);
    await isolatedPage.getByRole('button', { name: 'Connect Mock Wallet' }).first().click();

    const aborted = await checkAborted;
    expect(aborted.failure()?.errorText ?? '').toContain('ERR_FAILED');

    await expect(isolatedPage.getByText('Something went wrong')).toBeVisible({ timeout: 25000 });
    await expect(isolatedPage.getByText(/verify your terms acceptance/i)).toBeVisible();
    await expect(isolatedPage.getByRole('button', { name: 'Retry' })).toBeVisible();
    await expect(isolatedPage.getByRole('button', { name: 'Disconnect Wallet' })).toBeVisible();
  });
});
