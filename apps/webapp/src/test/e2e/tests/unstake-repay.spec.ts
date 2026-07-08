import { expect, test } from '../fixtures-parallel';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.ts';
import {
  confirmTransactionModal,
  gotoManagePosition,
  openStakePosition,
  stakeDeepLink
} from '../utils/stakeV2.ts';

// V2 rewrite (F7): the legacy "Unstake and pay back" widget tab became the
// manage sheet's Withdraw/Repay cards (details modal → menu → sheet). Coverage
// keeps the legacy intent — repay-all lands in the no-debt state, withdraw-all
// empties the position — expressed against the V2 IA, where an emptied urn
// shows the Inactive chip and the Reopen CTA (F6 states).

test.beforeEach(async ({ isolatedPage }) => {
  await isolatedPage.goto('/');
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.waitForTimeout(1000);
});

test('repays all debt and the position lands in the no-debt state', async ({ isolatedPage }) => {
  await openStakePosition(isolatedPage, { sky: '2400000', usds: '38000' });

  // Legacy deep link into the withdraw/repay side of the sheet.
  await stakeDeepLink(isolatedPage, 'flow=manage&urn_index=0&stake_tab=free');
  await expect(isolatedPage.getByTestId('stake-manage-takeover')).toBeVisible({ timeout: 30_000 });
  await expect(isolatedPage.getByTestId('stake-manage-borrow-card-mode-repay')).toHaveAttribute(
    'aria-pressed',
    'true'
  );

  // Stage a full repay via the 100% chip (wipeAll semantics).
  await isolatedPage.getByTestId('stake-manage-borrow-amount-percent-100').click();
  const confirm = isolatedPage.getByTestId('stake-manage-confirm');
  await expect(confirm).toBeEnabled({ timeout: 30_000 });
  await confirm.click();
  await confirmTransactionModal(isolatedPage);

  // Debt-free position: the details menu drops the debt-only rows (repay,
  // borrow-more) while withdraw stays available.
  await gotoManagePosition(isolatedPage, 0);
  await expect(isolatedPage.getByTestId('stake-manage-menu-withdraw')).toBeVisible();
  await expect(isolatedPage.getByTestId('stake-manage-menu-repay')).not.toBeVisible();
  await expect(isolatedPage.getByTestId('stake-manage-menu-borrow')).not.toBeVisible();
});

test('withdraws the full stake and the position goes inactive with a reopen CTA', async ({
  isolatedPage
}) => {
  await openStakePosition(isolatedPage, { sky: '2400000' });

  await gotoManagePosition(isolatedPage, 0);
  await isolatedPage.getByTestId('stake-manage-menu-withdraw').click();
  await expect(isolatedPage.getByTestId('stake-manage-takeover')).toBeVisible();
  await expect(isolatedPage.getByTestId('stake-manage-stake-card-mode-withdraw')).toHaveAttribute(
    'aria-pressed',
    'true'
  );

  // 100% chip stages the exact staked base for a full withdrawal.
  await isolatedPage.getByTestId('stake-manage-stake-amount-percent-100').click();
  const confirm = isolatedPage.getByTestId('stake-manage-confirm');
  await expect(confirm).toBeEnabled({ timeout: 30_000 });
  await confirm.click();
  await confirmTransactionModal(isolatedPage);

  // Emptied urn → Inactive chip, reopen CTA, withdraw disabled (F6 states).
  await gotoManagePosition(isolatedPage, 0);
  await expect(isolatedPage.getByTestId('stake-position-inactive-chip')).toBeVisible({ timeout: 15_000 });
  await expect(isolatedPage.getByTestId('stake-manage-cta-reopen')).toBeVisible();
  await expect(isolatedPage.getByTestId('stake-manage-menu-withdraw')).toBeDisabled();
});
