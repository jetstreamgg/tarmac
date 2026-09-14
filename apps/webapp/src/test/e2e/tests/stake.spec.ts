import { parseUnits } from 'viem';
import { expect, test } from '../fixtures-parallel';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.ts';
import { getUrnAddress, getUrnDebt, latestUrnIndex } from '../utils/stakeOnChain.ts';
import {
  BORROW_SPEC_SKY,
  confirmTransactionModal,
  gotoManagePosition,
  openStakePosition,
  stakeDeepLink
} from '../utils/stakeV2.ts';

// V2 rewrite (F7): /stake now serves the StakeProductPage destination — the
// legacy wizard widget (widget-navigation entry, supply-first-input-lse,
// widget-button steps) is gone. Coverage maps the old journeys onto the new
// IA: open-position takeover (single-page stacked form), details modal +
// manage sheet, and the flow/urn_index/stake_tab deep-link params.
//
// The positions table is subgraph-backed and cannot see test-vnet urns, so
// specs assert the empty-table state for fresh accounts and verify post-tx
// position state through the on-chain manage deep link instead of table rows.
// Write paths follow Gate 3: mock-wallet Success is optimistic — assert vat
// debt via stakeOnChain, not borrowed-amount copy.

test.beforeEach(async ({ isolatedPage }) => {
  await isolatedPage.goto('/');
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.waitForTimeout(1000);
});

test('destination shell renders tabs with the empty positions state', async ({ isolatedPage }) => {
  await stakeDeepLink(isolatedPage);
  await expect(isolatedPage.getByTestId('stake-tabs')).toBeVisible();

  // Fresh vnet account → no subgraph rows → the page defaults to Statistics
  // (post-review behavior: never land on an empty positions table).
  await expect(isolatedPage.getByTestId('stake-engine-card')).toBeVisible({ timeout: 15_000 });

  // The positions tab is still one click away and renders its empty state
  // with the Sky Staking Engine promo card as the flow entry point.
  await isolatedPage.getByTestId('stake-tab-positions').click();
  await expect(isolatedPage.getByTestId('stake-positions-empty')).toBeVisible({ timeout: 15_000 });
  await expect(isolatedPage.getByTestId('stake-open-position-cta')).toBeVisible();
});

test('opens a stake + borrow + delegate position through the takeover', async ({ isolatedPage }) => {
  const SKY_AMOUNT_TO_LOCK = BORROW_SPEC_SKY;
  const USDS_AMOUNT_TO_BORROW = '38000';

  await openStakePosition(isolatedPage, {
    sky: SKY_AMOUNT_TO_LOCK,
    usds: USDS_AMOUNT_TO_BORROW,
    delegate: true
  });

  // Verify the urn on-chain through the manage deep link: details modal shows
  // the position with a delegate attached.
  await gotoManagePosition(isolatedPage, 0);
  await expect(isolatedPage.getByText('25,000,000').first()).toBeVisible();
  await expect(isolatedPage.getByTestId('stake-position-delegate-link')).toBeVisible();
});

test('opens a stake-only position from the empty-state CTA', async ({ isolatedPage }) => {
  await stakeDeepLink(isolatedPage);
  // Empty account lands on Statistics (post-review default) — the empty
  // positions state is behind its tab.
  await isolatedPage.getByTestId('stake-tab-positions').click();
  await expect(isolatedPage.getByTestId('stake-positions-empty')).toBeVisible({ timeout: 15_000 });

  // Real CTA path (not the deep link): the engine promo card launches the takeover.
  await isolatedPage.getByTestId('stake-open-position-cta').click();
  await expect(isolatedPage.getByTestId('stake-takeover')).toBeVisible();

  await isolatedPage.getByTestId('stake-takeover-stake-amount').fill('2400000');
  const confirm = isolatedPage.getByTestId('stake-takeover-confirm');
  await expect(confirm).toBeEnabled({ timeout: 30_000 });
  await confirm.click();
  await confirmTransactionModal(isolatedPage);

  // No delegate was chosen — the details modal must not render a delegate link.
  await gotoManagePosition(isolatedPage, 0);
  await expect(isolatedPage.getByText('2,400,000').first()).toBeVisible();
  await expect(isolatedPage.getByTestId('stake-position-delegate-link')).not.toBeVisible();
});

test('borrows more against an existing position through the manage sheet', async ({
  isolatedPage,
  testAccount
}) => {
  await openStakePosition(isolatedPage, { sky: BORROW_SPEC_SKY, usds: '30000' });
  // `--last-failed` can reclaim a dirty pool account that already had urns —
  // always manage the urn this open just created.
  const urnIndex = await latestUrnIndex(testAccount);
  const urn = await getUrnAddress(testAccount, BigInt(urnIndex));
  const initialDebt = await getUrnDebt(urn);
  expect(initialDebt).toBeGreaterThanOrEqual(parseUnits('30000', 18));
  expect(initialDebt).toBeLessThan(parseUnits('30100', 18));

  await gotoManagePosition(isolatedPage, urnIndex);
  await isolatedPage.getByTestId('stake-manage-menu-borrow').click();
  await expect(isolatedPage.getByTestId('stake-manage-takeover')).toBeVisible();

  // Borrow card arrives enabled in borrow mode; stage an extra 5K USDS.
  await expect(isolatedPage.getByTestId('stake-manage-borrow-card-mode-borrow')).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await isolatedPage.getByTestId('stake-manage-borrow-amount').fill('5000');

  const confirm = isolatedPage.getByTestId('stake-manage-confirm');
  await expect(confirm).toBeEnabled({ timeout: 30_000 });
  await confirm.click();
  await confirmTransactionModal(isolatedPage);

  // On-chain oracle (Gate 3): success copy is optimistic under wallet_sendCalls.
  const borrowMore = parseUnits('5000', 18);
  const debt = await getUrnDebt(urn);
  expect(debt).toBeGreaterThanOrEqual(initialDebt + borrowMore);
  expect(debt).toBeLessThan(initialDebt + borrowMore + parseUnits('1000', 18));

  await gotoManagePosition(isolatedPage, urnIndex);
  await expect(isolatedPage.getByTestId('stake-manage-menu-borrow')).toBeVisible();
});

test('risk slider two-way sync in the takeover borrow card', async ({ isolatedPage }) => {
  await stakeDeepLink(isolatedPage, 'flow=open');
  await expect(isolatedPage.getByTestId('stake-takeover')).toBeVisible({ timeout: 15_000 });

  await isolatedPage.getByTestId('stake-takeover-stake-amount').fill(BORROW_SPEC_SKY);
  await isolatedPage.getByTestId('stake-takeover-borrow-card-toggle').click();
  await isolatedPage.getByTestId('stake-takeover-borrow-amount').fill('20000');

  const slider = isolatedPage.getByTestId('stake-takeover-borrow-slider').locator('[role="slider"]');
  await expect(slider).toBeVisible();
  await isolatedPage.waitForTimeout(500);
  const initial = Number(await slider.getAttribute('aria-valuenow'));

  // Typing a higher borrow amount moves the slider right once the simulated
  // vault settles (an async on-chain simulation, not a synchronous update).
  await isolatedPage.getByTestId('stake-takeover-borrow-amount').fill('40000');
  await expect
    .poll(async () => Number(await slider.getAttribute('aria-valuenow')), { timeout: 15_000 })
    .toBeGreaterThan(initial);

  // The staged risk pill tracks the simulated position.
  await expect(isolatedPage.getByTestId('stake-takeover-risk-pill')).toBeVisible();
});

test('honors stake deep-link params and ignores the retired legacy ones', async ({ isolatedPage }) => {
  // flow=open mounts the takeover; retired params (input_amount, linked_action
  // — dropped migration-wide, plan §4.1) are inert: no prefill, no crash.
  await stakeDeepLink(isolatedPage, 'flow=open&input_amount=123&linked_action=nope&reward=0x0');
  await expect(isolatedPage.getByTestId('stake-takeover')).toBeVisible({ timeout: 15_000 });
  await expect(isolatedPage.getByTestId('stake-takeover-stake-amount')).toHaveValue('');

  // stake_tab=free pre-toggles the manage sheet into withdraw + repay modes
  // (the legacy "Unstake and pay back" tab deep link).
  await openStakePosition(isolatedPage, { sky: '2400000' });
  await stakeDeepLink(isolatedPage, 'flow=manage&urn_index=0&stake_tab=free');
  await expect(isolatedPage.getByTestId('stake-manage-takeover')).toBeVisible({ timeout: 30_000 });
  await expect(isolatedPage.getByTestId('stake-manage-stake-card-mode-withdraw')).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(isolatedPage.getByTestId('stake-manage-borrow-card-mode-repay')).toHaveAttribute(
    'aria-pressed',
    'true'
  );
});
