import type { Page } from '@playwright/test';
import { parseUnits } from 'viem';
import { expect, test } from '../fixtures-parallel';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.ts';
import { expectTransactionSuccess } from '../utils/expectTransactionSuccess.ts';
import {
  BORROW_SPEC_SKY,
  confirmTransactionModal,
  gotoManagePosition,
  openStakePosition,
  stakeDeepLink
} from '../utils/stakeV2.ts';
import {
  getEarned,
  getTokenBalance,
  getUrnAddress,
  getUrnDebt,
  getUrnFarm,
  getUrnInkArt,
  getUrnVoteDelegate,
  latestUrnIndex,
  mintFarmReward,
  stageLiquidatedUrn,
  LOCKSTAKE_CLIPPER,
  SKY_FARM,
  SKY_TOKEN,
  SPK_FARM,
  STAKE_ILK_SUBGRAPH,
  USDS_FARM,
  USDS_TOKEN,
  type StagedLiquidation
} from '../utils/stakeOnChain.ts';

// F10 curated stake e2e suite (APP-343): one spec per contract-write path plus
// read smokes. Success copy is never the oracle — the mock wallet's
// wallet_sendCalls is non-atomic and reports optimistically — so every write
// spec asserts the on-chain outcome (vat.urns ink/art, farm earned(), ERC-20
// balances) through utils/stakeOnChain.ts. UI assertions only steer the drive.
//
// Chain-state notes: the delegate-change and claim specs are per-account
// isolated, but the liquidation spec warps the vnet clock forward (+days) and
// un-stops the LockstakeClipper — it is declared last and the file is meant to
// run like stake.spec.ts: isolated, not alongside other specs on the same vnet.
//
// The vnet has no indexer, so the subgraph reward-contract list (3 real
// mainnet farms, identical on the fork) is fulfilled by interception, and the
// liquidation spec fabricates the subgraph "news" of its real on-chain bark.

const WAD = 10n ** 18n;

/** Headroom for stability-fee accrual between sequential txs on the vnet fork. */
const STABILITY_FEE_SLACK = parseUnits('1000', 18);

async function latestUrn(testAccount: `0x${string}`) {
  const urnIndex = await latestUrnIndex(testAccount);
  return {
    urnIndex,
    urn: await getUrnAddress(testAccount, BigInt(urnIndex))
  };
}

/**
 * The reward-contract enumeration is subgraph-backed (useStakeRewardContracts)
 * and the vnet indexer knows nothing — fulfill it with the real mainnet farms
 * so farm selection (open flow) and claimables enumeration behave as prod.
 */
async function interceptRewardsList(page: Page) {
  await page.route('**/indexer/**', async route => {
    const post = route.request().postData() ?? '';
    if (post.includes('rewards: Reward(')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { rewards: [{ address: SKY_FARM }, { address: USDS_FARM }, { address: SPK_FARM }] }
        })
      });
    }
    return route.fallback();
  });
}

/**
 * Feed the positions query one urn carrying the (real) bark that
 * `stageLiquidatedUrn` just executed — `isLiquidatedStakePosition` gates the
 * post-mortem modal on subgraph bark data the vnet indexer can't provide.
 */
async function interceptPositionsWithBark(page: Page, staged: StagedLiquidation) {
  await page.route('**/indexer/**', async route => {
    const post = route.request().postData() ?? '';
    if (post.includes('StakingUrn(')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            stakingUrns: [
              {
                index: Number(staged.urnIndex),
                skyLocked: staged.residualInk.toString(),
                usdsDebt: '0',
                barks: [
                  {
                    id: `${staged.bark.clipperId}-lsev2`,
                    ilk: STAKE_ILK_SUBGRAPH,
                    clip: LOCKSTAKE_CLIPPER.toLowerCase(),
                    clipperId: staged.bark.clipperId,
                    ink: staged.bark.ink,
                    art: staged.bark.art,
                    due: staged.bark.due,
                    blockTimestamp: String(staged.bark.blockTimestamp),
                    transactionHash: staged.bark.transactionHash
                  }
                ],
                locks: [{ blockTimestamp: String(staged.bark.blockTimestamp - 86400) }],
                frees: [],
                draws: [{ blockTimestamp: String(staged.bark.blockTimestamp - 86400) }],
                wipes: []
              }
            ]
          }
        })
      });
    }
    return route.fallback();
  });
}

test.beforeEach(async ({ isolatedPage }) => {
  await interceptRewardsList(isolatedPage);
  await isolatedPage.goto('/');
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.waitForTimeout(1000);
});

// ---------------------------------------------------------------------------
// Read smokes
// ---------------------------------------------------------------------------

test('smoke: destination shell renders all three tabs with live engine reads', async ({ isolatedPage }) => {
  await stakeDeepLink(isolatedPage);
  await expect(isolatedPage.getByTestId('stake-tabs')).toBeVisible();

  // Empty account → Statistics is the landing tab (post-review default).
  await expect(isolatedPage.getByTestId('stake-engine-card')).toBeVisible({ timeout: 15_000 });

  await isolatedPage.getByTestId('stake-tab-positions').click();
  await expect(isolatedPage.getByTestId('stake-positions-empty')).toBeVisible({ timeout: 15_000 });
  await expect(isolatedPage.getByTestId('stake-open-position-cta')).toBeVisible();

  await isolatedPage.getByTestId('stake-tab-about').click();
  await expect(isolatedPage.getByTestId('stake-about-links')).toBeVisible();
});

test('smoke: flow deep links mount the takeover and reject junk urn indexes', async ({ isolatedPage }) => {
  // flow=open mounts the takeover pristine (no legacy prefill params).
  await stakeDeepLink(isolatedPage, 'flow=open');
  await expect(isolatedPage.getByTestId('stake-takeover')).toBeVisible({ timeout: 15_000 });
  await expect(isolatedPage.getByTestId('stake-takeover-stake-amount')).toHaveValue('');

  // Non-numeric urn_index is ignored: no manage dialog, page stays healthy.
  await stakeDeepLink(isolatedPage, 'flow=manage&urn_index=abc');
  await expect(isolatedPage.getByTestId('stake-position-details')).not.toBeVisible();
  await expect(isolatedPage.getByTestId('stake-tabs')).toBeVisible();
});

// ---------------------------------------------------------------------------
// Write paths — one spec per contract write, on-chain oracles
// ---------------------------------------------------------------------------

test('open + borrow + delegate multicall lands ink, art, farm and delegate on-chain', async ({
  isolatedPage,
  testAccount
}) => {
  test.setTimeout(240_000);
  await openStakePosition(isolatedPage, { sky: BORROW_SPEC_SKY, usds: '38000', delegate: true });

  const { urnIndex, urn } = await latestUrn(testAccount);
  const { ink } = await getUrnInkArt(urn);
  expect(ink).toBe(parseUnits(BORROW_SPEC_SKY, 18));

  const debt = await getUrnDebt(urn);
  expect(debt).toBeGreaterThanOrEqual(parseUnits('38000', 18));
  expect(debt).toBeLessThan(parseUnits('38000', 18) + STABILITY_FEE_SLACK);

  expect((await getUrnFarm(urn)).toLowerCase()).toBe(SKY_FARM.toLowerCase());
  expect(await getUrnVoteDelegate(urn)).not.toBe('0x0000000000000000000000000000000000000000');

  // UI cross-check: the details modal reads the same urn back on-chain.
  await gotoManagePosition(isolatedPage, urnIndex);
  await expect(isolatedPage.getByTestId('stake-position-delegate-link')).toBeVisible();
});

test('stake more and withdraw move vat ink by the exact staged amounts', async ({
  isolatedPage,
  testAccount
}) => {
  test.setTimeout(240_000);
  await openStakePosition(isolatedPage, { sky: '2000000' });
  const { urnIndex, urn } = await latestUrn(testAccount);
  expect((await getUrnInkArt(urn)).ink).toBe(parseUnits('2000000', 18));

  // Stake 500K more through the details-modal CTA → manage sheet.
  await gotoManagePosition(isolatedPage, urnIndex);
  await isolatedPage.getByTestId('stake-manage-cta-stake').click();
  await expect(isolatedPage.getByTestId('stake-manage-takeover')).toBeVisible();
  await isolatedPage.getByTestId('stake-manage-stake-amount').fill('500000');
  const confirm = isolatedPage.getByTestId('stake-manage-confirm');
  await expect(confirm).toBeEnabled({ timeout: 30_000 });
  await confirm.click();
  await confirmTransactionModal(isolatedPage);
  expect((await getUrnInkArt(urn)).ink).toBe(parseUnits('2500000', 18));

  // Withdraw 1M: ink drops exactly; the freed SKY reaches the wallet.
  const skyBefore = await getTokenBalance(SKY_TOKEN, testAccount);
  await gotoManagePosition(isolatedPage, urnIndex);
  await isolatedPage.getByTestId('stake-manage-menu-withdraw').click();
  await expect(isolatedPage.getByTestId('stake-manage-takeover')).toBeVisible();
  await isolatedPage.getByTestId('stake-manage-stake-amount').fill('1000000');
  await expect(confirm).toBeEnabled({ timeout: 30_000 });
  await confirm.click();
  await confirmTransactionModal(isolatedPage);

  expect((await getUrnInkArt(urn)).ink).toBe(parseUnits('1500000', 18));
  const skyDelta = (await getTokenBalance(SKY_TOKEN, testAccount)) - skyBefore;
  expect(skyDelta).toBeGreaterThanOrEqual(parseUnits('800000', 18)); // any exit fee stays sub-20%
  expect(skyDelta).toBeLessThanOrEqual(parseUnits('1000000', 18));
});

test('borrow more, dust-gap repay guard, then wipe-all clears art on-chain', async ({
  isolatedPage,
  testAccount
}) => {
  test.setTimeout(240_000);
  await openStakePosition(isolatedPage, { sky: BORROW_SPEC_SKY, usds: '38000' });
  const { urnIndex, urn } = await latestUrn(testAccount);
  const debtBeforeBorrowMore = await getUrnDebt(urn);
  const borrowMore = parseUnits('5000', 18);

  // Borrow 5K more.
  await gotoManagePosition(isolatedPage, urnIndex);
  await isolatedPage.getByTestId('stake-manage-menu-borrow').click();
  await expect(isolatedPage.getByTestId('stake-manage-takeover')).toBeVisible();
  await isolatedPage.getByTestId('stake-manage-borrow-amount').fill('5000');
  const confirm = isolatedPage.getByTestId('stake-manage-confirm');
  await expect(confirm).toBeEnabled({ timeout: 30_000 });
  await confirm.click();
  await confirmTransactionModal(isolatedPage);
  const debt = await getUrnDebt(urn);
  expect(debt).toBeGreaterThanOrEqual(debtBeforeBorrowMore + borrowMore);
  expect(debt).toBeLessThan(debtBeforeBorrowMore + borrowMore + STABILITY_FEE_SLACK);

  // Dust-gap guard: repaying 20K would leave ~23K < the 30K floor — blocked
  // before any transaction exists, so this leg is UI-only by design.
  await gotoManagePosition(isolatedPage, urnIndex);
  await isolatedPage.getByTestId('stake-manage-menu-repay').click();
  await expect(isolatedPage.getByTestId('stake-manage-takeover')).toBeVisible();
  await isolatedPage.getByTestId('stake-manage-borrow-amount').fill('20000');
  await expect(isolatedPage.getByText(/Debt must be paid off entirely/)).toBeVisible({ timeout: 15_000 });
  await expect(confirm).toBeDisabled();

  // Full repay via the 100% chip (wipeAll semantics) zeroes art.
  const usdsBefore = await getTokenBalance(USDS_TOKEN, testAccount);
  await isolatedPage.getByTestId('stake-manage-borrow-amount-percent-100').click();
  await expect(confirm).toBeEnabled({ timeout: 30_000 });
  await confirm.click();
  await confirmTransactionModal(isolatedPage);

  expect((await getUrnInkArt(urn)).art).toBe(0n);
  const usdsSpent = usdsBefore - (await getTokenBalance(USDS_TOKEN, testAccount));
  expect(usdsSpent).toBeGreaterThanOrEqual(debt); // debt + accrued fee left the wallet
});

// Mixed flows (PR #1710 review follow-up): both manage cards staged in ONE
// sheet session → one bundle mixing opposite-direction legs. The engine
// orders repay → free → lock → borrow, so these cross combos are legal but
// were never exercised by the single-card specs above.

test('mixed flow: withdraw + borrow in one bundle moves ink down and art up together', async ({
  isolatedPage,
  testAccount
}) => {
  test.setTimeout(240_000);
  await openStakePosition(isolatedPage, { sky: BORROW_SPEC_SKY });
  const { urnIndex, urn } = await latestUrn(testAccount);
  expect((await getUrnInkArt(urn)).ink).toBe(parseUnits(BORROW_SPEC_SKY, 18));

  // Withdraw card via the menu deep pre-toggle, then hand-enable the borrow
  // card in the same sheet (fresh toggle defaults to borrow mode).
  await gotoManagePosition(isolatedPage, urnIndex);
  await isolatedPage.getByTestId('stake-manage-menu-withdraw').click();
  await expect(isolatedPage.getByTestId('stake-manage-takeover')).toBeVisible();
  await isolatedPage.getByTestId('stake-manage-stake-amount').fill('400000');
  await isolatedPage.getByTestId('stake-manage-borrow-card-toggle').click();
  const borrowInput = isolatedPage.getByTestId('stake-manage-borrow-amount');
  await expect(borrowInput).toBeEnabled({ timeout: 60_000 });
  await borrowInput.fill('31000');

  const usdsBefore = await getTokenBalance(USDS_TOKEN, testAccount);
  const confirm = isolatedPage.getByTestId('stake-manage-confirm');
  await expect(confirm).toBeEnabled({ timeout: 60_000 });
  await confirm.click();
  await confirmTransactionModal(isolatedPage);

  const { ink } = await getUrnInkArt(urn);
  expect(ink).toBe(parseUnits('24600000', 18));
  const borrowWad = parseUnits('31000', 18);
  const debt = await getUrnDebt(urn);
  expect(debt).toBeGreaterThanOrEqual(borrowWad);
  expect(debt).toBeLessThan(borrowWad + STABILITY_FEE_SLACK);
  expect((await getTokenBalance(USDS_TOKEN, testAccount)) - usdsBefore).toBe(parseUnits('31000', 18));
});

test('mixed flow: supply + repay in one bundle moves ink up and art down together', async ({
  isolatedPage,
  testAccount
}) => {
  test.setTimeout(240_000);
  await openStakePosition(isolatedPage, { sky: BORROW_SPEC_SKY, usds: '38000' });
  const { urnIndex, urn } = await latestUrn(testAccount);
  const debtBeforeMixed = await getUrnDebt(urn);
  const repayWad = parseUnits('7000', 18);

  // Stake card via the details CTA, then hand-enable the borrow card and flip
  // it to repay. Partial repay of 7K leaves ~31K debt — above the 30K dust
  // floor, so the mixed bundle must not trip the dust-gap guard.
  await gotoManagePosition(isolatedPage, urnIndex);
  await isolatedPage.getByTestId('stake-manage-cta-stake').click();
  await expect(isolatedPage.getByTestId('stake-manage-takeover')).toBeVisible();
  await isolatedPage.getByTestId('stake-manage-stake-amount').fill('200000');
  await isolatedPage.getByTestId('stake-manage-borrow-card-toggle').click();
  await isolatedPage.getByTestId('stake-manage-borrow-card-mode-repay').click();
  const repayAmount = isolatedPage.getByTestId('stake-manage-borrow-amount');
  await expect(repayAmount).toBeEnabled({ timeout: 60_000 });
  await repayAmount.fill('7000');

  const usdsBefore = await getTokenBalance(USDS_TOKEN, testAccount);
  const confirm = isolatedPage.getByTestId('stake-manage-confirm');
  await expect(confirm).toBeEnabled({ timeout: 60_000 });
  await confirm.click();
  await confirmTransactionModal(isolatedPage);

  const { ink } = await getUrnInkArt(urn);
  expect(ink).toBe(parseUnits('25200000', 18));
  const debt = await getUrnDebt(urn);
  expect(debt).toBeGreaterThanOrEqual(debtBeforeMixed - repayWad);
  expect(debt).toBeLessThan(debtBeforeMixed - repayWad + STABILITY_FEE_SLACK);
  expect(usdsBefore - (await getTokenBalance(USDS_TOKEN, testAccount))).toBe(parseUnits('7000', 18));
});

test('delegate change rewires the urn vote delegate on-chain', async ({ isolatedPage, testAccount }) => {
  test.setTimeout(240_000);
  await openStakePosition(isolatedPage, { sky: '2400000', delegate: true });
  const { urnIndex, urn } = await latestUrn(testAccount);
  const delegateBefore = await getUrnVoteDelegate(urn);
  expect(delegateBefore).not.toBe('0x0000000000000000000000000000000000000000');

  await gotoManagePosition(isolatedPage, urnIndex);
  await isolatedPage.getByTestId('stake-manage-menu-change-delegate').click();
  await expect(isolatedPage.getByTestId('stake-manage-takeover')).toBeVisible();
  await expect(isolatedPage.getByTestId('stake-manage-delegate-list')).toBeVisible({ timeout: 15_000 });

  // The current delegate arrives pre-selected (aria-pressed) — pick another.
  await isolatedPage
    .locator('[data-testid^="stake-manage-delegate-0x"][aria-pressed="false"]')
    .first()
    .click();
  const confirm = isolatedPage.getByTestId('stake-manage-confirm');
  await expect(confirm).toBeEnabled({ timeout: 30_000 });
  await confirm.click();
  await confirmTransactionModal(isolatedPage);

  const delegateAfter = await getUrnVoteDelegate(urn);
  expect(delegateAfter).not.toBe('0x0000000000000000000000000000000000000000');
  expect(delegateAfter.toLowerCase()).not.toBe(delegateBefore.toLowerCase());
});

test('claim pays rewards out and claim & restake locks them back into the urn', async ({
  isolatedPage,
  testAccount
}) => {
  test.setTimeout(360_000);
  await openStakePosition(isolatedPage, { sky: '2000000' });
  const { urnIndex, urn } = await latestUrn(testAccount);

  // Deterministic claimables instead of waiting out emissions: SKY (the urn's
  // farm) + USDS (a second farm) → the stacked two-reward modal.
  await mintFarmReward(SKY_FARM, urn, parseUnits('31.4', 18));
  await mintFarmReward(USDS_FARM, urn, parseUnits('22.9', 18));

  // Fresh load for fresh claimable reads (capped-osm pattern), then reconnect.
  await isolatedPage.goto('/');
  await isolatedPage.waitForTimeout(2000);
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });

  // Leg 1 — plain claim. The redesigned modal claims the urn's FULL claimable
  // set (Figma 1036:213978 draws no per-token selection): both rewards pay out
  // to the wallet. The entry CTA executes directly — no review Confirm.
  const usdsBefore = await getTokenBalance(USDS_TOKEN, testAccount);
  const skyWalletBefore = await getTokenBalance(SKY_TOKEN, testAccount);
  await gotoManagePosition(isolatedPage, urnIndex);
  await isolatedPage.getByTestId('stake-manage-menu-claim').click();
  await expect(isolatedPage.getByTestId('stake-claim-form')).toBeVisible();
  await expect(isolatedPage.getByTestId('stake-claim-reward-sky')).toBeVisible({ timeout: 15_000 });
  await isolatedPage.getByRole('button', { name: 'Claim', exact: true }).click();
  // A confirmed transaction closes its own modal and hands the outcome to a
  // toast — there is no success screen, and no Done button to click.
  await expectTransactionSuccess(isolatedPage);

  expect(await getEarned(USDS_FARM, urn)).toBe(0n);
  expect((await getTokenBalance(USDS_TOKEN, testAccount)) - usdsBefore).toBe(parseUnits('22.9', 18));
  expect(await getEarned(SKY_FARM, urn)).toBeLessThan(WAD); // re-accrual epsilon while staked
  expect((await getTokenBalance(SKY_TOKEN, testAccount)) - skyWalletBefore).toBeGreaterThanOrEqual(
    parseUnits('31.4', 18)
  );

  // Leg 2 — claim & restake a fresh SKY reward: earned drains into vat ink,
  // not the wallet (D-7, the pass-1 not-exercisable case this spec exists for).
  await mintFarmReward(SKY_FARM, urn, parseUnits('31.4', 18));
  const { ink: inkBefore } = await getUrnInkArt(urn);
  const skyBefore = await getTokenBalance(SKY_TOKEN, testAccount);
  await gotoManagePosition(isolatedPage, urnIndex);
  await isolatedPage.getByTestId('stake-manage-menu-claim').click();
  await expect(isolatedPage.getByTestId('stake-claim-reward-sky')).toBeVisible({ timeout: 15_000 });
  await isolatedPage.getByRole('button', { name: 'Claim & Restake SKY' }).click();
  // A confirmed transaction closes its own modal and hands the outcome to a
  // toast — there is no success screen, and no Done button to click.
  await expectTransactionSuccess(isolatedPage);

  expect(await getEarned(SKY_FARM, urn)).toBeLessThan(WAD); // re-accrual epsilon while staked
  const inkDelta = (await getUrnInkArt(urn)).ink - inkBefore;
  expect(inkDelta).toBeGreaterThanOrEqual(parseUnits('31.4', 18));
  const walletDrift = (await getTokenBalance(SKY_TOKEN, testAccount)) - skyBefore;
  expect(walletDrift > -WAD && walletDrift < WAD).toBe(true); // claimed SKY restaked, not paid out
});

test('liquidation recovery bundle claims rewards and frees the refunded SKY', async ({
  isolatedPage,
  testAccount
}) => {
  test.setTimeout(360_000);

  // Real bark + auction against this account's own urn (direct engine calls —
  // the write path under test is the recovery, not the liquidation).
  const staged = await stageLiquidatedUrn(testAccount);
  expect(staged.residualInk).toBeGreaterThan(0n);
  await mintFarmReward(USDS_FARM, staged.urn, parseUnits('10', 18));
  await mintFarmReward(SKY_FARM, staged.urn, parseUnits('5', 18));

  // The vnet has no indexer — hand the app the subgraph record of the bark it
  // just genuinely experienced, then reload for fresh reads and reconnect.
  await interceptPositionsWithBark(isolatedPage, staged);
  await isolatedPage.goto('/');
  await isolatedPage.waitForTimeout(2000);
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });

  await stakeDeepLink(isolatedPage, `flow=manage&urn_index=${staged.urnIndex}`);
  await expect(isolatedPage.getByTestId('stake-postmortem-modal')).toBeVisible({ timeout: 30_000 });

  const usdsBefore = await getTokenBalance(USDS_TOKEN, testAccount);
  const skyBefore = await getTokenBalance(SKY_TOKEN, testAccount);
  const cta = isolatedPage.getByTestId('stake-postmortem-claim-cta');
  await expect(cta).toBeEnabled({ timeout: 30_000 });
  await cta.click();
  await confirmTransactionModal(isolatedPage);

  // The bundle must have claimed every farm and freed the entire refund.
  const { ink, art } = await getUrnInkArt(staged.urn);
  expect(ink).toBe(0n);
  expect(art).toBe(0n);
  expect(await getEarned(USDS_FARM, staged.urn)).toBe(0n);
  expect(await getEarned(SKY_FARM, staged.urn)).toBe(0n);
  expect((await getTokenBalance(USDS_TOKEN, testAccount)) - usdsBefore).toBe(parseUnits('10', 18));
  expect((await getTokenBalance(SKY_TOKEN, testAccount)) - skyBefore).toBeGreaterThan(0n);
});
