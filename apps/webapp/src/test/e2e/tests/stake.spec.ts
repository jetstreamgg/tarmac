import { parseUnits } from 'viem';
import { expect, test } from '../fixtures-parallel';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.ts';
import { getUrnAddress, getUrnDebt, getUrnInkArt, latestUrnIndex } from '../utils/stakeOnChain.ts';
import {
  BORROW_SPEC_SKY,
  confirmTransactionModal,
  gotoManagePosition,
  openManageSheet,
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

test('empty state shows the overview tab, the empty positions tab, and the open-position modal', async ({
  isolatedPage
}) => {
  await stakeDeepLink(isolatedPage);
  await expect(isolatedPage.getByTestId('stake-tabs')).toBeVisible();

  // Fresh vnet account → no subgraph rows. The landing tab stays on My
  // positions until that query settles, so open Overview explicitly.
  await isolatedPage.getByTestId('stake-tab-overview').click();
  await expect(isolatedPage.getByTestId('stake-tab-content-overview')).toBeVisible();
  await expect(isolatedPage.getByTestId('stake-engine-card')).toBeVisible({ timeout: 15_000 });
  await expect(isolatedPage.getByTestId('stake-rate-chart')).toBeVisible({ timeout: 15_000 });
  await expect(isolatedPage.getByTestId('stake-details-strip')).toBeVisible();
  await expect(isolatedPage.getByTestId('stake-borrow-utilization')).toBeVisible();
  const links = isolatedPage.getByTestId('stake-overview-links');
  await expect(links.getByRole('link', { name: 'View contract' })).toBeVisible();
  await expect(links.getByRole('link', { name: 'Governance' })).toBeVisible();

  // The positions tab is still one click away and renders its empty state
  // with the Sky Staking Engine promo card as the flow entry point.
  await isolatedPage.getByTestId('stake-tab-positions').click();
  await expect(isolatedPage.getByTestId('stake-positions-empty')).toBeVisible({ timeout: 15_000 });
  await expect(isolatedPage.getByTestId('stake-open-position-cta')).toBeVisible();

  // The promo card opens the takeover: stake amount, and the optional borrow
  // and delegate cards, with nothing staged yet.
  await isolatedPage.getByTestId('stake-open-position-cta').click();
  await expect(isolatedPage.getByTestId('stake-takeover')).toBeVisible();
  await expect(isolatedPage.getByTestId('stake-takeover-stake-amount')).toHaveValue('');
  await expect(isolatedPage.getByTestId('stake-takeover-borrow-card-toggle')).toBeVisible();
  await expect(isolatedPage.getByTestId('stake-takeover-delegate-card-toggle')).toBeVisible();
  await expect(isolatedPage.getByTestId('stake-takeover-confirm')).toBeVisible();
  await isolatedPage.getByTestId('stake-takeover-close').click();
  await expect(isolatedPage.getByTestId('stake-takeover')).toBeHidden();
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
  // the position with a delegate attached, loan-to-value, and the actions list.
  await gotoManagePosition(isolatedPage, 0);
  await expect(isolatedPage.getByText('25,000,000').first()).toBeVisible();
  await expect(isolatedPage.getByTestId('stake-position-delegate-link')).toBeVisible();
  await expect(isolatedPage.getByTestId('stake-position-ltv')).toBeVisible({ timeout: 15_000 });
  await expect(isolatedPage.getByTestId('stake-position-risk-indicator')).toBeVisible();
  await expect(isolatedPage.getByTestId('stake-position-risk-pill')).toBeVisible();
  await expect(isolatedPage.getByRole('heading', { name: 'Actions' })).toBeVisible();
  await expect(isolatedPage.getByTestId('stake-manage-menu-manage')).toBeEnabled();
  await expect(isolatedPage.getByTestId('stake-manage-menu-change-reward')).toBeEnabled();
  await expect(isolatedPage.getByTestId('stake-manage-menu-change-delegate')).toBeEnabled();
  await expect(isolatedPage.getByTestId('stake-manage-menu-close-position')).toBeEnabled();
  await expect(isolatedPage.getByTestId('stake-manage-cta-claim')).toBeVisible();
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

  // No delegate and no debt: no delegate link, no loan-to-value, and the
  // actions list is still the way into manage / reward / delegate / close.
  await gotoManagePosition(isolatedPage, 0);
  await expect(isolatedPage.getByText('2,400,000').first()).toBeVisible();
  await expect(isolatedPage.getByTestId('stake-position-delegate-link')).toHaveCount(0);
  await expect(isolatedPage.getByTestId('stake-position-ltv')).toHaveCount(0);
  await expect(isolatedPage.getByTestId('stake-position-risk-indicator')).toHaveCount(0);
  await expect(isolatedPage.getByTestId('stake-manage-menu-manage')).toBeEnabled();
  await expect(isolatedPage.getByTestId('stake-manage-menu-change-reward')).toBeEnabled();
  await expect(isolatedPage.getByTestId('stake-manage-menu-change-delegate')).toBeEnabled();
  await expect(isolatedPage.getByTestId('stake-manage-menu-close-position')).toBeEnabled();
  await expect(isolatedPage.getByTestId('stake-manage-cta-claim')).toBeVisible();
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

  await openManageSheet(isolatedPage, urnIndex);

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
  await expect(isolatedPage.getByTestId('stake-manage-menu-manage')).toBeVisible();
});

test('risk slider two-way sync in the takeover borrow card', async ({ isolatedPage }) => {
  await stakeDeepLink(isolatedPage, 'flow=open');
  await expect(isolatedPage.getByTestId('stake-takeover')).toBeVisible({ timeout: 15_000 });

  await isolatedPage.getByTestId('stake-takeover-stake-amount').fill(BORROW_SPEC_SKY);
  await isolatedPage.getByTestId('stake-takeover-borrow-card-toggle').click();
  await isolatedPage.getByTestId('stake-takeover-borrow-amount').fill('20000');

  // The thumb is a zero-size focus anchor (the bar is the visual), so it is
  // attached and carries the aria value without being visible.
  const slider = isolatedPage.getByTestId('stake-takeover-borrow-slider').locator('[role="slider"]');
  await expect(slider).toBeAttached();
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

test('borrow toggle enables at 1,440,000.01 SKY and defaults to a 30,000 min and max', async ({
  isolatedPage
}) => {
  await stakeDeepLink(isolatedPage, 'flow=open');
  await expect(isolatedPage.getByTestId('stake-takeover')).toBeVisible({ timeout: 15_000 });

  // Dust is 30,000 USDS. The capped price makes that one cent of collateral:
  // 1,440,000.01 SKY. Below it the Borrow USDS switch stays off.
  const minStake = isolatedPage.getByTestId('stake-takeover-min-stake');
  await expect(minStake).toContainText('1,440,000.01', { timeout: 30_000 });
  const toggle = isolatedPage.getByTestId('stake-takeover-borrow-card-toggle');
  await expect(toggle).toBeDisabled();

  const stakeAmount = isolatedPage.getByTestId('stake-takeover-stake-amount');
  await stakeAmount.fill('1440000');
  await expect(isolatedPage.getByTestId('stake-min-stake-badge')).toHaveText('Not reached', {
    timeout: 30_000
  });
  await expect(toggle).toBeDisabled();

  await stakeAmount.fill('1440000.01');
  await expect(isolatedPage.getByTestId('stake-min-stake-badge')).toHaveAttribute('data-reached', 'true', {
    timeout: 30_000
  });
  // The switch follows the debounced simulation, a beat after the badge.
  await expect(toggle).toBeEnabled({ timeout: 30_000 });
  await toggle.click();

  const borrowAmount = isolatedPage.getByTestId('stake-takeover-borrow-amount');
  await expect(borrowAmount).toHaveValue('30,000');
  const borrowCard = isolatedPage.getByTestId('stake-takeover-borrow-card');
  await expect(borrowCard).toContainText('max. 30,000 USDS');
  await expect(isolatedPage.getByTestId('stake-takeover-borrow-slider-min-label')).toContainText('30,000');
  await expect(isolatedPage.getByTestId('stake-takeover-borrow-slider-max-label')).toContainText('30,000');

  // At the floor the only legal borrow is the dust amount, so Min and Max agree.
  await isolatedPage.getByTestId('stake-takeover-borrow-amount-chip-max').click();
  await expect(borrowAmount).toHaveValue('30,000');
  await isolatedPage.getByTestId('stake-takeover-borrow-amount-chip-min').click();
  await expect(borrowAmount).toHaveValue('30,000');
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

test('close position withdraws the stake and repays the debt, then reopen keeps the delegate switch', async ({
  isolatedPage,
  testAccount
}) => {
  await openStakePosition(isolatedPage, {
    sky: BORROW_SPEC_SKY,
    usds: '38000',
    delegate: true
  });
  const urnIndex = await latestUrnIndex(testAccount);
  const urn = await getUrnAddress(testAccount, BigInt(urnIndex));

  await gotoManagePosition(isolatedPage, urnIndex);
  // Close position opens the manage sheet already staged at a full withdraw
  // and a wipe-all repay. Debt accrued while that sheet stays open is re-read
  // on a 5 minute interval — covered in ManagePositionTakeover.test.tsx.
  await expect(isolatedPage.getByTestId('stake-manage-menu-close-position')).toBeEnabled({
    timeout: 30_000
  });
  await isolatedPage.getByTestId('stake-manage-menu-close-position').click();
  await expect(isolatedPage.getByTestId('stake-manage-takeover')).toBeVisible({ timeout: 30_000 });
  await expect(isolatedPage.getByTestId('stake-manage-stake-card-mode-withdraw')).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(isolatedPage.getByTestId('stake-manage-borrow-card-mode-repay')).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  const confirm = isolatedPage.getByTestId('stake-manage-confirm');
  await expect(confirm).toBeEnabled({ timeout: 60_000 });
  await expect(isolatedPage.getByTestId('stake-manage-stake-amount')).not.toHaveValue('');
  await expect(isolatedPage.getByTestId('stake-manage-borrow-amount')).not.toHaveValue('');
  await confirm.click();
  await confirmTransactionModal(isolatedPage);

  const { ink, art } = await getUrnInkArt(urn);
  expect(ink).toBe(0n);
  expect(art).toBe(0n);

  // Emptied urn: Change reward, Change delegate, and Close position are
  // disabled. Reopen is the only way back in, and it keeps the delegate card
  // on so the switch can be turned off and back on.
  await gotoManagePosition(isolatedPage, urnIndex);
  await expect(isolatedPage.getByTestId('stake-position-inactive-chip')).toBeVisible({ timeout: 15_000 });
  await expect(isolatedPage.getByTestId('stake-manage-menu-change-reward')).toBeDisabled();
  await expect(isolatedPage.getByTestId('stake-manage-menu-change-delegate')).toBeDisabled();
  await expect(isolatedPage.getByTestId('stake-manage-menu-close-position')).toBeDisabled();
  await isolatedPage.getByTestId('stake-manage-cta-reopen').click();
  await expect(isolatedPage.getByTestId('stake-takeover')).toBeVisible({ timeout: 15_000 });
  const delegateSearch = isolatedPage.getByTestId('stake-takeover-delegate-search');
  await expect(delegateSearch).toBeVisible({ timeout: 30_000 });
  const delegateToggle = isolatedPage.getByTestId('stake-takeover-delegate-card-toggle');
  await delegateToggle.click();
  await expect(delegateSearch).toBeHidden();
  await delegateToggle.click();
  await expect(delegateSearch).toBeVisible();
});
