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
