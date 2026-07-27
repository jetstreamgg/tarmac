import { expect, test } from '../fixtures-parallel';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.ts';
import { BORROW_SPEC_SKY, openStakePosition, stakeDeepLink } from '../utils/stakeV2.ts';

// M6.5 (APP-404): the open-position takeover at the phone tier, per comp
// 1222:19733 "Open a position / Full overlay" (Sky App: UI, 393px). The flow
// logic is covered by stake.spec.ts at the desktop viewport — these specs pin
// the mobile presentation (12px insets, stepped-down type, stat hairlines,
// sticky footer) and prove the full journey works with 393px tap targets.
//
// The isolatedPage fixture builds its own browser context, so `test.use`
// viewport options don't reach it — each test sets the viewport explicitly.

const MOBILE_VIEWPORT = { width: 393, height: 852 };

test.beforeEach(async ({ isolatedPage }) => {
  await isolatedPage.setViewportSize(MOBILE_VIEWPORT);
  // The cookie banner is full-width at the phone tier and sits over the
  // takeover's footer/toggles, intercepting taps (desktop tucks it in the
  // corner). Seed the decided state so it never mounts.
  await isolatedPage.context().addCookies([
    {
      name: 'sky_consent',
      value: encodeURIComponent(JSON.stringify({ posthog: false, google_analytics: false })),
      domain: 'localhost',
      path: '/'
    }
  ]);
  await isolatedPage.goto('/');
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await isolatedPage.waitForTimeout(1000);
});

test('mobile takeover renders the full-overlay comp presentation', async ({ isolatedPage }) => {
  await stakeDeepLink(isolatedPage, 'flow=open');
  const takeover = isolatedPage.getByTestId('stake-takeover');
  await expect(takeover).toBeVisible({ timeout: 15_000 });

  // Full-screen overlay, not a sheet: the shell spans the whole viewport.
  const shellBox = await takeover.boundingBox();
  expect(shellBox?.width).toBe(MOBILE_VIEWPORT.width);
  expect(shellBox?.height).toBe(MOBILE_VIEWPORT.height);

  // Cards sit at the comp's 12px outer insets (393 - 24 = 369).
  const cardBox = await isolatedPage.getByTestId('stake-takeover-stake-card').boundingBox();
  expect(cardBox?.x).toBe(12);
  expect(cardBox?.width).toBe(MOBILE_VIEWPORT.width - 24);

  // Stepped-down mobile type: amount input renders Heading 4 (22px), not the
  // desktop text-3xl (30px).
  const stakeAmount = isolatedPage.getByTestId('stake-takeover-stake-amount');
  await expect(stakeAmount).toHaveCSS('font-size', '22px');

  // Stake an amount and enable Borrow: card 1 grows its third stat and the
  // mobile-only vertical hairlines split the stats into the comp's 3 columns.
  await stakeAmount.fill(BORROW_SPEC_SKY);
  await isolatedPage.getByTestId('stake-takeover-borrow-card-toggle').click();
  await expect(isolatedPage.getByTestId('stake-takeover-min-stake')).toBeVisible({ timeout: 30_000 });

  // Enable Delegate so the overlay is at its tallest, then check the footer
  // stays pinned: Confirm is inside the viewport without scrolling.
  await isolatedPage.getByTestId('stake-takeover-delegate-card-toggle').click();
  await expect(isolatedPage.getByTestId('stake-takeover-delegate-list')).toBeVisible({ timeout: 15_000 });
  const confirmBox = await isolatedPage.getByTestId('stake-takeover-confirm').boundingBox();
  expect(confirmBox).not.toBeNull();
  expect(confirmBox!.y + confirmBox!.height).toBeLessThanOrEqual(MOBILE_VIEWPORT.height);
  // Comp footer CTA is the 48px L button (desktop keeps the 56px XL).
  expect(confirmBox!.height).toBe(48);
});

test('percent chips and optional-card collapse work at the phone tier', async ({ isolatedPage }) => {
  await stakeDeepLink(isolatedPage, 'flow=open');
  await expect(isolatedPage.getByTestId('stake-takeover')).toBeVisible({ timeout: 15_000 });

  // The percent chips no-op until the balance query resolves — wait for the
  // loaded "Balance: N SKY" line before tapping.
  await expect(isolatedPage.getByText(/Balance: [\d,.]+ SKY/)).toBeVisible({ timeout: 30_000 });

  // The pool account is funded with SKY — 25% stages a quarter of it through
  // the mini chip's mobile 32px hit target.
  const chip = isolatedPage.getByTestId('stake-takeover-stake-amount-percent-25');
  const chipBox = await chip.boundingBox();
  expect(chipBox?.height).toBe(32);
  await chip.click();
  await expect(isolatedPage.getByTestId('stake-takeover-stake-amount')).not.toHaveValue('');

  // Optional cards collapse to their header row when toggled off again.
  const borrowToggle = isolatedPage.getByTestId('stake-takeover-borrow-card-toggle');
  await borrowToggle.click();
  await expect(isolatedPage.getByTestId('stake-takeover-borrow-amount')).toBeVisible({ timeout: 30_000 });
  await borrowToggle.click();
  await expect(isolatedPage.getByTestId('stake-takeover-borrow-amount')).not.toBeVisible();
});

// --- M6.6 (APP-405): the /stake page itself at the phone tier, per comps
// 1222:16771 (My positions) / 1222:17089 (Statistics) / 1222:17233 (About).
// The positions/activity surfaces are subgraph-backed and the vnet's urns are
// invisible to the indexer, so the populated spec route-stubs the two staking
// queries; on-chain per-row reads still hit the fork and settle to zeroes.

const E18 = '0'.repeat(18);

function stubStakeSubgraph(page: Parameters<typeof stakeDeepLink>[0]) {
  const now = Math.floor(Date.now() / 1000);
  const urn = (index: number, sky: string, usds: string) => ({
    index,
    skyLocked: sky + E18,
    usdsDebt: usds + E18,
    barks: [],
    locks: [{ blockTimestamp: String(now - 2100) }],
    frees: [],
    draws: [],
    wipes: []
  });
  const event = (index: number, wad: string, ts: number, hash: string) => ({
    index,
    wad: wad + E18,
    blockTimestamp: String(ts),
    transactionHash: hash
  });
  return page.route('**/indexer/**', async route => {
    const body = route.request().postData() ?? '';
    if (body.includes('stakingUrns: StakingUrn')) {
      return route.fulfill({
        json: {
          data: {
            // Four active urns (two with debt) + one emptied urn behind the
            // Hide inactive toggle — the comp's card mix.
            stakingUrns: [
              urn(0, '700550', '30000'),
              urn(1, '780212', '30000'),
              urn(2, '50000', '0'),
              urn(3, '27127', '0'),
              urn(4, '0', '0')
            ]
          }
        }
      });
    }
    if (body.includes('stakingOpens: StakingOpen')) {
      return route.fulfill({
        json: {
          data: {
            stakingOpens: [],
            stakingSelectVoteDelegates: [],
            stakingSelectRewards: [],
            stakingLocks: [
              event(0, '700000', now - 2100, `0x${'a'.repeat(64)}`),
              event(1, '700000', now - 86400, `0x${'b'.repeat(64)}`)
            ],
            stakingDraws: [event(0, '30000', now - 2100, `0x${'a'.repeat(64)}`)],
            stakingFrees: [event(3, '700000', now - 172800, `0x${'c'.repeat(64)}`)],
            stakingWipes: [event(3, '30000', now - 172800, `0x${'c'.repeat(64)}`)],
            stakingGetRewards: [],
            stakingOnKicks: []
          }
        }
      });
    }
    return route.fallback();
  });
}

test('statistics and about tabs lead with the promo card at the phone tier', async ({ isolatedPage }) => {
  // Connected with zero positions → the page lands on Statistics.
  await stakeDeepLink(isolatedPage);
  const engineCard = isolatedPage.getByTestId('stake-engine-card');
  await expect(engineCard).toBeVisible({ timeout: 15_000 });

  // Comp 1222:17089 order: promo card above the chart card.
  const chart = isolatedPage.getByTestId('stake-rate-chart');
  await expect(chart).toBeVisible({ timeout: 15_000 });
  const engineBox = await engineCard.boundingBox();
  const chartBox = await chart.boundingBox();
  expect(engineBox!.y).toBeLessThan(chartBox!.y);

  // Comp 1222:17233 order: promo card above the About copy; links stack as
  // full-width rows.
  await stakeDeepLink(isolatedPage, 'tab=about');
  const aboutCopy = isolatedPage.getByTestId('stake-about-copy');
  await expect(aboutCopy).toBeVisible({ timeout: 15_000 });
  const engineBox2 = await isolatedPage.getByTestId('stake-engine-card').boundingBox();
  const aboutBox = await aboutCopy.boundingBox();
  expect(engineBox2!.y).toBeLessThan(aboutBox!.y);
  const docsLink = isolatedPage.getByRole('link', { name: 'Docs' });
  const docsBox = await docsLink.boundingBox();
  expect(docsBox!.width).toBeGreaterThan(300);
});

test('populated positions tab stacks per the mobile comp', async ({ isolatedPage }) => {
  await stubStakeSubgraph(isolatedPage);
  await stakeDeepLink(isolatedPage, 'tab=positions');

  // Comp 1222:16771 order: summary hero → Active positions → My activity.
  const summary = isolatedPage.getByTestId('stake-summary-card');
  await expect(summary).toBeVisible({ timeout: 15_000 });
  const summaryBox = await summary.boundingBox();
  const positionsHeading = isolatedPage.getByRole('heading', { name: 'Active positions' });
  const positionsBox = await positionsHeading.boundingBox();
  const activityHeading = isolatedPage.getByRole('heading', { name: 'My activity' });
  const activityBox = await activityHeading.boundingBox();
  expect(summaryBox!.y).toBeLessThan(positionsBox!.y);
  expect(positionsBox!.y).toBeLessThan(activityBox!.y);

  // Summary hero keeps its connect-gated CTA at the phone tier.
  await expect(summary.getByTestId('stake-open-new-position-cta')).toBeVisible();

  // Position cards: one "View more" per active urn; the emptied urn stays
  // behind the Hide inactive toggle (comp label "Hide inactive").
  const viewMore = isolatedPage.getByRole('button', { name: 'View more' });
  await expect(viewMore).toHaveCount(4, { timeout: 15_000 });
  await isolatedPage.getByTestId('stake-hide-inactive-toggle').click();
  await expect(viewMore).toHaveCount(5);
  await isolatedPage.getByTestId('stake-hide-inactive-toggle').click();

  // Tapping View more opens the manage flow for that urn (bubbles to the
  // card's row handler). At the phone tier the details modal hides the menu
  // panel behind a pinned footer pair (comp 1292:63278); Manage position
  // raises the menu as a bottom sheet (comp 1222:16239) whose close returns
  // to the details view underneath.
  await viewMore.first().click();
  const details = isolatedPage.getByTestId('stake-position-details');
  await expect(details).toBeVisible({ timeout: 30_000 });
  // The stubbed urns are subgraph-only, so the on-chain reads decide whether
  // the urn resolves active or inactive here — assert the footer-pair shape,
  // not the specific primary verb.
  const footerPrimary = isolatedPage
    .getByTestId('stake-details-cta-stake')
    .or(isolatedPage.getByTestId('stake-details-cta-reopen'));
  await expect(footerPrimary).toBeVisible({ timeout: 30_000 });
  await isolatedPage.getByTestId('stake-details-cta-manage').click();
  const sheet = isolatedPage.getByTestId('stake-manage-sheet');
  await expect(sheet).toBeVisible();
  await expect(isolatedPage.getByTestId('stake-manage-menu-withdraw-sheet')).toBeVisible();
  const sheetPrimary = isolatedPage
    .getByTestId('stake-manage-cta-stake-sheet')
    .or(isolatedPage.getByTestId('stake-manage-cta-reopen-sheet'));
  await expect(sheetPrimary).toBeVisible();
  await isolatedPage.getByTestId('stake-manage-sheet-close').click();
  await expect(sheet).not.toBeVisible();
  await expect(details).toBeVisible();
  await isolatedPage.getByTestId('stake-position-details-close').click();

  // Activity: full-width pill filter under the heading, grouped verbs as
  // cards with View transaction footers.
  const filter = isolatedPage.getByTestId('stake-activity-filter');
  const filterBox = await filter.boundingBox();
  expect(filterBox!.width).toBeGreaterThan(300);
  await expect(isolatedPage.getByText('Stake & Borrow')).toBeVisible();
  await expect(isolatedPage.getByText('Unstake & Repay')).toBeVisible();
  await expect(isolatedPage.getByRole('link', { name: 'View transaction' }).first()).toBeVisible();

  // Filter to Position 1: only its transactions remain.
  await filter.click();
  await isolatedPage.getByTestId('stake-activity-filter-0').click();
  await expect(isolatedPage.getByText('Unstake & Repay')).not.toBeVisible();
  await expect(isolatedPage.getByText('Stake & Borrow')).toBeVisible();
});

test('opens a stake + borrow + delegate position end-to-end on mobile', async ({ isolatedPage }) => {
  // The shared helper drives the real UI (chips, toggles, delegate list,
  // Confirm, transaction modal) — running it at 393px proves every control
  // stays reachable and tappable under the mobile presentation.
  await openStakePosition(isolatedPage, {
    sky: BORROW_SPEC_SKY,
    usds: '38000',
    delegate: true
  });

  // Post-tx state is verified on-chain via the manage deep link (the
  // positions table is subgraph-backed and cannot see vnet urns).
  await stakeDeepLink(isolatedPage, 'flow=manage&urn_index=0');
  await expect(isolatedPage.getByTestId('stake-position-details')).toBeVisible({ timeout: 30_000 });
  await expect(isolatedPage.getByText('25,000,000').first()).toBeVisible();
  await expect(isolatedPage.getByTestId('stake-position-delegate-link')).toBeVisible();
});
