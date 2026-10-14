// Where address screening runs. Every screening can bill the provider, so these
// pin WHEN the app screens, not what it does with a verdict (the unit suites
// cover the verdicts):
//  - a new wallet is screened between the terms check and the terms modal, and
//    a screened-out one gets the blocked screen instead of the terms;
//  - a wallet that has already accepted the terms is NOT screened on connect;
//  - a transaction is screened on its first screen once the amount is valid —
//    the step where the $250k+ enhanced check runs too — with the review's
//    Confirm held until the verdict lands, and no second screening at Confirm.
// That the default skip-auth build never screens at all is enforced for every
// spec by the fixture (see the unmocked screening handler in fixtures-parallel.ts).
import { type Page } from '@playwright/test';
import { expect, test } from '../fixtures-parallel';
import { SavingsProductPage } from '../pages/SavingsProductPage';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms';
import { expectTransactionSuccess } from '../utils/expectTransactionSuccess';
import { suppressGovernanceMigrationToast } from '../utils/suppressGovernanceMigrationToast';
import {
  forceAuthChecks,
  mockAddressScreening,
  mockIpStatus,
  mockTermsCheck,
  seedLocalTermsAcceptance
} from '../mock-terms-gate';

// Non-US, non-VPN: no terms signature is owed at Confirm, so these specs
// exercise screening alone (the signature step has its own spec).
const forceChecks = async (page: Page) => {
  await forceAuthChecks(page);
  await mockIpStatus(page, { countryCode: 'XX' });
};

/** The compliance requests, in the order the app sent them. */
const recordComplianceRequests = (page: Page) => {
  const order: string[] = [];
  page.on('request', request => {
    if (request.url().includes('/terms-acceptance/check') && request.method() === 'POST') {
      order.push('check');
    } else if (/\/address\/status/.test(request.url())) {
      order.push('screening');
    }
  });
  return order;
};

test('a new wallet is screened after the terms check and before the terms modal', async ({
  isolatedPage
}) => {
  await forceChecks(isolatedPage);
  const screening = await mockAddressScreening(isolatedPage);
  await mockTermsCheck(isolatedPage);
  const order = recordComplianceRequests(isolatedPage);
  await isolatedPage.goto('/');

  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true, expectTerms: true });

  // Once, and only after /check said the terms must be shown — accepting
  // them doesn't screen again.
  expect(order).toEqual(['check', 'screening']);
  expect(screening.requests).toBe(1);
});

test('a screened-out new wallet gets the blocked screen, never the terms', async ({ isolatedPage }) => {
  await forceChecks(isolatedPage);
  await mockAddressScreening(isolatedPage, { allowed: false });
  await mockTermsCheck(isolatedPage);
  await isolatedPage.goto('/');
  await suppressGovernanceMigrationToast(isolatedPage);

  await isolatedPage.getByRole('button', { name: 'Connect Batch Mock Wallet' }).first().click();

  // The blocked state renders in both AuthWrapper and the wallet chip.
  await expect(isolatedPage.getByText('Wallet blocked').first()).toBeVisible({ timeout: 15_000 });
  await expect(isolatedPage.getByTestId('terms-modal')).toHaveCount(0);
});

test("a returning wallet is screened on the transaction's first screen, not on connect", async ({
  isolatedPage,
  testAccount
}) => {
  await forceChecks(isolatedPage);
  // Every screening waits for `answer` — the Confirm hold is asserted while
  // the verdict is still pending.
  let answer!: () => void;
  const screening = await mockAddressScreening(isolatedPage, {
    until: new Promise<void>(resolve => (answer = resolve))
  });
  await mockTermsCheck(isolatedPage, { accepted: true });

  const savings = new SavingsProductPage(isolatedPage);
  await savings.goto();
  // Both halves of an accepted terms gate: the DB's (the /check mock) and
  // this browser's flag — seeded after the load that clears storage.
  await seedLocalTermsAcceptance(isolatedPage, testAccount);
  await savings.connect();

  // The chip only shows the address once the terms verdict landed, and by the
  // time the supply modal is open any connect-time screening would have fired.
  await savings.openSupplyModal();
  expect(screening.requests).toBe(0);

  // A valid amount arms the check on this first screen, before Review.
  await savings.fillAmount('2');
  await expect.poll(() => screening.requests).toBe(1);

  await isolatedPage.getByText('Review').first().click();
  const confirm = isolatedPage.getByRole('button', { name: 'Confirm', exact: true });
  // The loader only renders on the firing Confirm while the screening
  // verdict is pending (the flow's own gating disables it without one).
  await expect(confirm.getByTestId('loader')).toBeVisible({ timeout: 60_000 });
  await expect(confirm).toBeDisabled();

  answer();
  await expect(confirm).toBeEnabled({ timeout: 60_000 });
  await confirm.click();
  await expectTransactionSuccess(isolatedPage);

  // The gate at Confirm used the verdict warmed on the first screen.
  expect(screening.requests).toBe(1);
});
