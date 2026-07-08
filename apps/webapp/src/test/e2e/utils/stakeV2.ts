import { expect, type Page } from '@playwright/test';

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
  await expect(confirm).toBeEnabled({ timeout: 30_000 });
  await confirm.click();
  await expect(page.getByText('Transaction completed successfully.')).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Done' }).click();
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
    await page.getByTestId('stake-takeover-borrow-amount').fill(usds);
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
  await expect(confirm).toBeEnabled({ timeout: 30_000 });
  await confirm.click();
  await confirmTransactionModal(page);
}

/** Deep-links into the manage flow for an urn and waits for the details modal. */
export async function gotoManagePosition(page: Page, urnIndex = 0) {
  await stakeDeepLink(page, `flow=manage&urn_index=${urnIndex}`);
  await expect(page.getByTestId('stake-position-details')).toBeVisible({ timeout: 30_000 });
}
