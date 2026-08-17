// Phase B of the T&C flow (APP-501/APP-502): the pre-transaction gate and its
// conditional signature step, driven end-to-end on the /earn/savings supply
// modal. The e2e build skips the compliance surface (VITE_SKIP_AUTH_CHECK), so
// each test re-enables it per-page and mocks the surface's three endpoints —
// see mock-terms-gate.ts. These are also the only specs in which the terms
// modal actually opens, so the Phase A accept path of
// connectMockWalletAndAcceptTerms gets exercised here too.
//
// Not covered here, deliberately: the POST /sign contract (the mock wallet
// skips the POST; unit-covered in signTermsAcceptance.test.ts), the risky and
// screening-error verdicts at Confirm (the gate shares the connect-time query
// cache, so those states block at connect before a Confirm exists; the
// >4h-stale-cache shapes are unit-covered in useTermsSignatureGate.test.tsx),
// and the version-bump re-trigger (unit-covered).
import { type Page } from '@playwright/test';
import { expect, test } from '../fixtures-parallel';
import { connectAndVerify } from '../utils/connectAndVerify';
import {
  forceAuthChecks,
  mockAddressScreening,
  mockIpStatus,
  mockPersonalSign,
  mockTermsCheck
} from '../mock-terms-gate';

const SIGNATURE_STEP_LABEL = 'Terms of Use and Privacy Policy confirmation signature';

const setupCompliancePage = async (
  page: Page,
  { countryCode = 'US', signed = false }: { countryCode?: string; signed?: boolean } = {}
) => {
  await forceAuthChecks(page);
  await mockIpStatus(page, { countryCode });
  await mockAddressScreening(page);
  await mockTermsCheck(page, { signed });
};

/** Connects (accepting the terms modal on the way) and lands on an enabled Confirm. */
const openSavingsSupplyConfirm = async (page: Page) => {
  await page.goto('/earn/savings');
  await connectAndVerify(page, { batch: true });
  await page
    .getByTestId('savings-position-supply')
    .or(page.getByTestId('savings-supply-cta'))
    .first()
    .click();
  await expect(page.getByText('Supply to Sky Savings')).toBeVisible();
  await page.getByTestId('savings-modal-amount-input').fill('2');
  await page.getByText('Review').first().click();
  const confirm = page.getByRole('button', { name: 'Confirm', exact: true });
  await expect(confirm).toBeEnabled({ timeout: 60_000 });
  return confirm;
};

test('US user without a signature gets the signature step, then the transaction runs', async ({
  isolatedPage
}) => {
  await setupCompliancePage(isolatedPage, { countryCode: 'US', signed: false });
  await mockPersonalSign(isolatedPage);

  const confirm = await openSavingsSupplyConfirm(isolatedPage);
  await confirm.click();

  // The prelude step mounts ahead of the flow's own steps and is the current
  // step while the wallet signs.
  await expect(isolatedPage.getByText(SIGNATURE_STEP_LABEL).first()).toBeVisible();

  await expect(isolatedPage.getByText('Transaction completed successfully.')).toBeVisible({
    timeout: 60_000
  });
  // The completed signature row survives into the success view.
  await expect(isolatedPage.getByText(SIGNATURE_STEP_LABEL).first()).toBeVisible();
});

test('Rejecting the signature fails the step in place and retry recovers', async ({ isolatedPage }) => {
  await setupCompliancePage(isolatedPage, { countryCode: 'US', signed: false });
  const signControl = await mockPersonalSign(isolatedPage, { reject: true });

  const confirm = await openSavingsSupplyConfirm(isolatedPage);
  await confirm.click();

  // The C5 inline failure rendering: the step retitles, carries the
  // signature-specific sentence and the trailing retry.
  await expect(isolatedPage.getByText(`${SIGNATURE_STEP_LABEL} failed`)).toBeVisible();
  await expect(
    isolatedPage.getByText('The signature request was declined or could not be completed.')
  ).toBeVisible();

  // The wallet cooperates on the second attempt; retry re-runs the whole gate.
  signControl.mode = 'sign';
  await isolatedPage.getByRole('button', { name: 'Try again' }).click();
  await expect(isolatedPage.getByText('Transaction completed successfully.')).toBeVisible({
    timeout: 60_000
  });
});

test('US user already signed for the current version sees no added step', async ({ isolatedPage }) => {
  await setupCompliancePage(isolatedPage, { countryCode: 'US', signed: true });

  const confirm = await openSavingsSupplyConfirm(isolatedPage);
  await confirm.click();

  await expect(isolatedPage.getByText('Transaction completed successfully.')).toBeVisible({
    timeout: 60_000
  });
  await expect(isolatedPage.getByText(SIGNATURE_STEP_LABEL)).toHaveCount(0);
});

test('Non-US non-VPN user without a signature sees no added step', async ({ isolatedPage }) => {
  await setupCompliancePage(isolatedPage, { countryCode: 'XX', signed: false });

  const confirm = await openSavingsSupplyConfirm(isolatedPage);
  await confirm.click();

  await expect(isolatedPage.getByText('Transaction completed successfully.')).toBeVisible({
    timeout: 60_000
  });
  await expect(isolatedPage.getByText(SIGNATURE_STEP_LABEL)).toHaveCount(0);
});
