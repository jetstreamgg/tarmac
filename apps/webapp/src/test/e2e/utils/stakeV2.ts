/**
 * Back-compat re-exports — prefer `StakePage` from `../pages/StakePage` in new specs.
 */
export { BORROW_SPEC_SKY, StakePage } from '../pages/StakePage';

import { type Page } from '@playwright/test';
import { StakePage } from '../pages/StakePage';

export async function stakeDeepLink(page: Page, search = '') {
  await new StakePage(page).deepLink(search);
}

export async function confirmTransactionModal(page: Page) {
  await new StakePage(page).confirmTransactionModal();
}

export async function openStakePosition(
  page: Page,
  opts: { sky: string; usds?: string; delegate?: boolean }
) {
  await new StakePage(page).openPosition(opts);
}

export async function gotoManagePosition(page: Page, urnIndex = 0) {
  await new StakePage(page).gotoManage(urnIndex);
}
