import { expect, test } from '../fixtures-parallel';
import { StUsdsProductPage } from '../pages/StUsdsProductPage';

// V2 rewrite: stUSDS on /earn/stusds (D7). See stusds/QA-CASES.md §3.

test('stUSDS product page renders chart and transactions', async ({ isolatedPage }) => {
  const stusds = new StUsdsProductPage(isolatedPage);
  await stusds.gotoConnected();
  await stusds.expectReadOnlyShell();
});

test('redirects legacy /earn/expert to /earn/stusds', async ({ isolatedPage }) => {
  await isolatedPage.goto('/earn/expert');
  await expect(isolatedPage).toHaveURL(/\/earn\/stusds(\?|$)/);
});

test('Supply modal validates the amount before enabling Review', async ({ isolatedPage }) => {
  const stusds = new StUsdsProductPage(isolatedPage);
  await stusds.gotoConnected();
  await stusds.openSupplyModal();

  // Provider notice is Curve/blocked/loading only — native route is intentionally silent
  // (see StUsdsProviderNotice). A-4 copy/oracle is covered in component tests.

  const review = isolatedPage.getByRole('dialog').getByRole('button', { name: 'Review', exact: true });
  await expect(review).toBeDisabled();

  await stusds.fillAmount('999999999');
  await expect(stusds.amountError()).toHaveText('Insufficient balance');
  await expect(review).toBeDisabled();
});

test.fixme('Supplies USDS and withdraws it back', async () => {
  // Deferred: on-chain oracle for stUSDS Curve pool on the parallel vnet
  // (stusds/QA-CASES.md §3; e2e-migration.md). No APP ticket yet — re-enable
  // when the write path has a fork-backed oracle.
});
