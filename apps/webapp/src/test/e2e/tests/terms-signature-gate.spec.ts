// Phase B of the T&C flow (APP-501/APP-502): the pre-transaction gate and its
// conditional signature step, driven end-to-end on the /earn/savings supply
// modal. The e2e build skips the compliance surface (VITE_SKIP_AUTH_CHECK), so
// each test re-enables it per-page and mocks the surface's three endpoints —
// see mock-terms-gate.ts. Connecting passes `expectTerms: true`: the terms
// modal appearing is the positive proof the forced checks are really running,
// so the "no added step" cases can't pass vacuously against a dead seam.
//
// Not covered here, deliberately: the POST /sign contract (the mock wallet
// skips the POST; unit-covered in signTermsAcceptance.test.ts), the risky and
// screening-error verdicts at Confirm (the gate shares the connect-time query
// cache, so those states block at connect before a Confirm exists; the
// >4h-stale-cache shapes are unit-covered in useTermsSignatureGate.test.tsx),
// and the version-bump re-trigger (unit-covered).
import { type Page } from '@playwright/test';
import { expect, test } from '../fixtures-parallel';
import { openSavingsSupplyConfirm } from '../utils/openSavingsSupplyConfirm';
import {
  forceAuthChecks,
  mockAddressScreening,
  mockIpStatus,
  mockPersonalSign,
  mockTermsCheck
} from '../mock-terms-gate';

const SIGNATURE_STEP_LABEL = 'Sign Terms of Use & Privacy Policy';

const setupCompliancePage = async (
  page: Page,
  { countryCode = 'US', signed = false }: { countryCode?: string; signed?: boolean } = {}
) => {
  await forceAuthChecks(page);
  await mockIpStatus(page, { countryCode });
  await mockAddressScreening(page);
  await mockTermsCheck(page, { signed });
};

test('US user without a signature gets the signature step, then the transaction runs', async ({
  isolatedPage
}) => {
  await setupCompliancePage(isolatedPage, { countryCode: 'US', signed: false });
  await mockPersonalSign(isolatedPage);

  const confirm = await openSavingsSupplyConfirm(isolatedPage, { connect: { expectTerms: true } });
  await confirm.click();

  // The prelude step mounts ahead of the flow's own steps and is the current
  // step while the wallet signs. Exact match: the failed retitle ("… failed")
  // must not satisfy this.
  await expect(isolatedPage.getByText(SIGNATURE_STEP_LABEL, { exact: true }).first()).toBeVisible();

  // The generic success sentence is gone — status now lives only in the
  // status badge, which cycles "Confirm in the wallet" → "Processing" →
  // "Success". toHaveText auto-retries, so this waits for the terminal text.
  await expect(isolatedPage.getByTestId('transaction-status-badge')).toHaveText('Success', {
    timeout: 60_000
  });
  // The completed signature row survives into the success view.
  await expect(isolatedPage.getByText(SIGNATURE_STEP_LABEL, { exact: true }).first()).toBeVisible();
});

test('Rejecting the signature fails the step in place and retry recovers', async ({ isolatedPage }) => {
  await setupCompliancePage(isolatedPage, { countryCode: 'US', signed: false });
  const signControl = await mockPersonalSign(isolatedPage, { reject: true });

  const confirm = await openSavingsSupplyConfirm(isolatedPage, { connect: { expectTerms: true } });
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
  await expect(isolatedPage.getByTestId('transaction-status-badge')).toHaveText('Success', {
    timeout: 60_000
  });
});

// The two no-step verdicts share one body: an already-recorded signature and a
// non-US non-VPN origin both mean the transaction runs untouched. The
// assertion waits for settlement first — checking for the step's absence at
// click-time would pass before the gate had rendered anything at all.
for (const { title, setup } of [
  {
    title: 'US user already signed for the current version sees no added step',
    setup: { countryCode: 'US', signed: true }
  },
  {
    title: 'Non-US non-VPN user without a signature sees no added step',
    setup: { countryCode: 'XX', signed: false }
  }
]) {
  test(title, async ({ isolatedPage }) => {
    await setupCompliancePage(isolatedPage, setup);

    const confirm = await openSavingsSupplyConfirm(isolatedPage, { connect: { expectTerms: true } });
    await confirm.click();

    await expect(isolatedPage.getByTestId('transaction-status-badge')).toHaveText('Success', {
      timeout: 60_000
    });
    await expect(isolatedPage.getByText(SIGNATURE_STEP_LABEL, { exact: true })).toHaveCount(0);
  });
}
