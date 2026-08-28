import { expect, test } from '../fixtures-parallel';
import { PendleProductPage } from '../pages/PendleProductPage';
import {
  PT_SUSDS_MARKET_ADDRESS,
  PT_SUSDS_MODAL_NAME,
  PT_SUSDS_SLUG,
  pendleLegacyMarketPath
} from '../utils/pendleE2e';

// V2 rewrite: Pendle on /earn/fixed/:slug. Read smokes active; write paths
// skipped pending Pendle quote API on vnet. See pendle/QA-CASES.md §3.

test('PT-sUSDS detail page renders chart and transactions', async ({ isolatedPage }) => {
  const pendle = new PendleProductPage(isolatedPage);
  await pendle.gotoConnected(PT_SUSDS_SLUG);
  await pendle.expectReadOnlyShell();
  await expect(pendle.supplyCard().or(pendle.positionCard())).toBeVisible();
});

test('opens a market detail page via its slug deeplink', async ({ isolatedPage }) => {
  const pendle = new PendleProductPage(isolatedPage);
  await pendle.gotoConnected(PT_SUSDS_SLUG);
  await expect(pendle.productDetail()).toBeVisible();
  await expect(pendle.supplyCard()).toBeVisible();
});

test('redirects the legacy market/:address path to the slug route', async ({ isolatedPage }) => {
  await isolatedPage.goto(pendleLegacyMarketPath(PT_SUSDS_MARKET_ADDRESS));
  await expect(isolatedPage).toHaveURL(new RegExp(`/earn/fixed/${PT_SUSDS_SLUG}`));
});

test('falls back to the Earn marketplace for an unknown slug', async ({ isolatedPage }) => {
  await isolatedPage.goto('/earn/fixed/pt-does-not-exist');
  await expect(isolatedPage).toHaveURL(/\/earn(\?|$)/);
});

test('supply modal opens for PT-sUSDS', async ({ isolatedPage }) => {
  const pendle = new PendleProductPage(isolatedPage);
  await pendle.gotoConnected(PT_SUSDS_SLUG);
  await pendle.openSupplyModal(PT_SUSDS_MODAL_NAME);
  // Slippage gear lives on the review grid only (PendleModalForm); Review stays
  // disabled until a prepared quote — covered by SlippageMenu + Pendle modal
  // unit tests, not e2e (same vnet-quote limitation as the buy fixme below).
  await expect(isolatedPage.getByRole('textbox', { name: 'Supply amount' })).toBeVisible();
});

test.fixme('buy PT completes successfully on-chain', async () => {
  // Pending Pendle quote API wiring on the Tenderly fork + router write oracle.
});

// Matured PT Portfolio coverage: portfolio.spec.ts (cheat-mint + UI clock + chain warp).
