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

test('Supply modal validates the amount and shows provider notice', async ({ isolatedPage }) => {
  const stusds = new StUsdsProductPage(isolatedPage);
  await stusds.gotoConnected();
  await stusds.openSupplyModal();

  await expect(stusds.providerNotice()).toBeVisible();

  const review = isolatedPage.getByRole('dialog').getByRole('button', { name: 'Review', exact: true });
  await expect(review).toBeDisabled();

  await stusds.fillAmount('999999999');
  await expect(stusds.amountError()).toHaveText('Insufficient balance');
  await expect(review).toBeDisabled();
});

test.fixme('Supplies USDS and withdraws it back', async () => {
  // Pending on-chain oracle wiring for stUSDS Curve pool on the parallel vnet.
});
