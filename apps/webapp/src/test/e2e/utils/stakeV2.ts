import { expect, type Page } from '@playwright/test';
import { expectTransactionSuccess } from './expectTransactionSuccess.ts';

/**
 * Collateral for every borrow-involving spec. The 30K-USDS dust floor needs
 * `ink ≥ dust × liqRatio / OSM price`, and forks inherit mainnet's LIVE OSM —
 * which has swung 10× between fork days ($0.025 → $0.0025, = a 1.44M → 14.4M
 * SKY floor). 25M SKY clears the floor at any OSM ≥ ~$0.00144 and stays well
 * inside the 100M-SKY account funding. Debt legs must stay under the vat
 * safety edge `ink × spot` (~52K USDS at $0.0025) — keep per-spec borrows
 * ≤ 43K so they survive the low end.
 */
export const BORROW_SPEC_SKY = '25000000';

/**
 * Shared driving helpers for the V2 /stake destination page (F7 flip).
 *
 * Navigation caveat: the mock-wallet connection does not survive a full page
 * load, so after connecting these helpers never call `page.goto()`. Deep links
 * are staged in-app via `history.pushState` + a synthetic `popstate`, which
 * TanStack Router picks up without reloading (`network=` preserved).
 *
 * Positions-table caveat: the My positions table is subgraph-backed
 * (useStakeUserPositions), and test-vnet urns are invisible to the indexer, so
 * specs never assert table rows. Post-transaction state is instead verified
 * through the `?flow=manage&urn_index=N` deep link, whose details modal and
 * manage sheet read the urn on-chain.
 */

/** In-app navigation to /stake with optional extra search params (no reload). */
export async function stakeDeepLink(page: Page, search = '') {
  await page.evaluate(qs => {
    const params = new URLSearchParams(window.location.search);
    const network = params.get('network');
    const target = new URLSearchParams(qs);
    if (network && !target.has('network')) target.set('network', network);
    history.pushState({}, '', `/stake${target.size ? `?${target.toString()}` : ''}`);
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  }, search);
  await expect(page.getByTestId('stake-product-page')).toBeVisible({ timeout: 15_000 });
}

/** Waits out the review screen and drives a launched TransactionModal to success. */
export async function confirmTransactionModal(page: Page) {
  const confirm = page.getByRole('button', { name: 'Confirm', exact: true });
  await expect(confirm).toBeEnabled({ timeout: 60_000 });
  await confirm.click();
  // A confirmed transaction closes its own modal and hands the outcome to a
  // toast — there is no success screen, and no Done button to click.
  await expectTransactionSuccess(page);
}

/**
 * Opens a position through the real takeover UI: stake `sky`, optionally
 * enable the borrow card for `usds`, optionally delegate to the first
 * available delegate. Resolves once the success screen has been dismissed.
 */
export async function openStakePosition(
  page: Page,
  { sky, usds, delegate = false }: { sky: string; usds?: string; delegate?: boolean }
) {
  await stakeDeepLink(page, 'flow=open');
  await expect(page.getByTestId('stake-takeover')).toBeVisible({ timeout: 15_000 });

  await page.getByTestId('stake-takeover-stake-amount').fill(sky);

  if (usds) {
    await page.getByTestId('stake-takeover-borrow-card-toggle').click();
    // The borrow input is disabled while the debounced vault simulation still
    // reflects a zero stake (`minCollateralNotMet`); on a loaded CI fork that
    // re-simulation can exceed fill()'s 30s action timeout, so wait for the
    // enabled state explicitly (fits the 120s test budget).
    const borrowAmount = page.getByTestId('stake-takeover-borrow-amount');
    await expect(borrowAmount).toBeEnabled({ timeout: 60_000 });
    await borrowAmount.fill(usds);
  }

  if (delegate) {
    await page.getByTestId('stake-takeover-delegate-card-toggle').click();
    await expect(page.getByTestId('stake-takeover-delegate-list')).toBeVisible({ timeout: 15_000 });
    await page
      .getByTestId('stake-takeover-delegate-list')
      .locator('[data-testid^="stake-takeover-delegate-0x"]')
      .first()
      .click();
  }

  const confirm = page.getByTestId('stake-takeover-confirm');
  await expect(confirm).toBeEnabled({ timeout: 60_000 });
  await confirm.click();
  await confirmTransactionModal(page);
}

/** Deep-links into the manage flow for an urn and waits for the details modal. */
export async function gotoManagePosition(page: Page, urnIndex = 0) {
  await stakeDeepLink(page, `flow=manage&urn_index=${urnIndex}`);
  await expect(page.getByTestId('stake-position-details')).toBeVisible({ timeout: 30_000 });
}
