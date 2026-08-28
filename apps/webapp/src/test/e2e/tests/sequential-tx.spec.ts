/*
 * Sequential (non-batch) transaction flow tests — the canary for the
 * useSequentialTransactionFlow retry contract: after a step-2 rejection, a
 * changed amount (via close and reopen — Back is withheld once a step has
 * mined, APP-448) must be what the next attempt executes.
 *
 * V2 rewrite (see e2e-migration.md): flows run through the editable entry
 * modal on /earn/savings and /earn/rewards/:rewardContract. The legacy
 * upgrade block was dropped — /convert/upgrade is a parked surface.
 *
 * Bundling is a persisted user setting. It cannot be seeded through
 * localStorage — the mock wagmi config clears all of it at boot — so the tests
 * turn it off through the review screen's bundle badge, which persists for the
 * rest of the page's life. The modal runs the three-screen flow: entry (Review)
 * → review (Confirm) → wallet/status screen, whose multi-step failures render
 * inline in the step list with a "Try again" pill. A success closes the modal
 * itself and hands the outcome to a 10s toast, so completion is asserted on the
 * closed dialog and the position delta, not on the toast copy.
 */

import { type Page } from '@playwright/test';
import { expect, test } from '../fixtures-parallel';
import { connectAndVerify } from '../utils/connectAndVerify';
import {
  interceptAndAllowTransactions,
  interceptAndRejectSecondTransaction
} from '../utils/rejectTransaction';

// With: USDS Get: SPK — usdsSpkRewardAddress on the tenderly fork
const SPK_REWARD_CONTRACT = '0x173e314C7635B45322cd8Cb14f44b312e079F3af';

const connectOn = async (page: Page, path: string) => {
  // Connect AFTER the goto — a full navigation resets the mock connector.
  await page.goto(path);
  await connectAndVerify(page, { batch: true });
};

/**
 * The position card's leading number, or 0 when the account has no position
 * and the page shows the supply CTA instead. The CTA also renders while the
 * balance is still loading, so a card is given a moment to replace it. Funded
 * accounts already hold a position in some markets, so the canaries assert
 * DELTAS, never absolutes.
 */
const positionAmount = async (page: Page, market: 'savings' | 'rewards') => {
  const card = page.getByTestId(`${market}-position-card`);
  await expect(card.or(page.getByTestId(`${market}-supply-cta`)).first()).toBeVisible({ timeout: 15_000 });
  if (!(await card.isVisible())) {
    const appeared = await card
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    if (!appeared) return 0;
  }
  const cardText = await card.innerText();
  return parseFloat(cardText.replace(/,/g, '').match(/(\d+(\.\d+)?)/)?.[1] ?? '0');
};

/**
 * Turns bundling off from the review screen's badge (a click-opened popover
 * holding the switch). The switch writes the app-wide preference, so it stays
 * off for every later modal on this page.
 */
const disableBundling = async (page: Page) => {
  const dialog = page.getByRole('dialog');
  // The review screen draws the badge twice (fee row + actions header); either opens the panel.
  const badge = dialog.getByTestId('bundle-toggle-badge').first();
  await badge.waitFor({ state: 'visible', timeout: 60_000 });
  await badge.click();
  const toggle = page.getByTestId('bundle-panel-switch');
  await toggle.waitFor({ state: 'visible' });
  if (await toggle.isChecked()) {
    await toggle.click();
  }
  // Escape dismisses the topmost layer only — the popover, not the dialog.
  await page.keyboard.press('Escape');
  await expect(toggle).toBeHidden();
  await expect(dialog).toBeVisible();
  await expect(badge).toHaveText(/Not bundled/);
};

/** Advances the three-screen modal: entry's Review, bundling off, then the review's Confirm. */
const reviewAndConfirm = async (page: Page) => {
  const review = page.getByRole('dialog').getByRole('button', { name: 'Review', exact: true });
  await expect(review).toBeEnabled({ timeout: 60_000 });
  await review.click();
  await disableBundling(page);
  const confirm = page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true });
  await expect(confirm).toBeEnabled({ timeout: 60_000 });
  await confirm.click();
};

/** A success closes the modal itself; the toast that follows is too short to anchor on. */
const expectFlowCompleted = async (page: Page) => {
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 90_000 });
};

// ─────────────────────────────────────────────────────────────────────────────
// Savings — sequential supply
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Sequential transactions — Savings supply', () => {
  const openSupplyModal = async (page: Page) => {
    await page
      .getByTestId('savings-position-supply')
      .or(page.getByTestId('savings-supply-cta'))
      .first()
      .click();
    await expect(page.getByText('Supply to Sky Savings')).toBeVisible();
  };

  test('Sequential: supply USDS completes successfully in two steps', async ({ isolatedPage }) => {
    await connectOn(isolatedPage, '/earn/savings');
    const positionBefore = await positionAmount(isolatedPage, 'savings');
    await openSupplyModal(isolatedPage);

    await isolatedPage.getByTestId('savings-modal-amount-input').fill('2');
    await reviewAndConfirm(isolatedPage);

    // Approve and Supply run as two sequential wallet confirmations
    await expect(isolatedPage.getByText('Approve')).toBeVisible({ timeout: 60_000 });

    await expectFlowCompleted(isolatedPage);
    expect((await positionAmount(isolatedPage, 'savings')) - positionBefore).toBeCloseTo(2, 0);
  });

  test('Sequential stale-state regression: changed amount is used after step-2 rejection, close and reopen', async ({
    isolatedPage
  }) => {
    await connectOn(isolatedPage, '/earn/savings');
    const positionBefore = await positionAmount(isolatedPage, 'savings');

    await openSupplyModal(isolatedPage);

    // ── First attempt: approve succeeds, the supply tx is rejected ──
    await isolatedPage.getByTestId('savings-modal-amount-input').fill('3');
    await interceptAndRejectSecondTransaction(isolatedPage, 200);
    await reviewAndConfirm(isolatedPage);

    // The failed step renders inline in the step list with a retry pill
    await expect(isolatedPage.getByRole('button', { name: 'Try again' })).toBeVisible({
      timeout: 60_000
    });

    // ── A step has mined, so Back is withheld: close, reopen, change the amount ──
    await expect(isolatedPage.getByTestId('transaction-modal-back')).toBeDisabled();
    await isolatedPage.getByTestId('transaction-modal-close').click();
    await expect(isolatedPage.getByRole('dialog')).toBeHidden();
    await openSupplyModal(isolatedPage);
    const amountInput = isolatedPage.getByTestId('savings-modal-amount-input');
    await expect(amountInput).toBeVisible();
    await amountInput.fill('5');

    // ── Second attempt succeeds; the allowance from step 1 already covers it ──
    await interceptAndAllowTransactions(isolatedPage);
    await reviewAndConfirm(isolatedPage);

    await expectFlowCompleted(isolatedPage);

    // The position grew by the NEW amount (5), not the rejected one (3)
    expect((await positionAmount(isolatedPage, 'savings')) - positionBefore).toBeCloseTo(5, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Rewards — sequential supply
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Sequential transactions — Rewards supply', () => {
  const openSupplyModal = async (page: Page) => {
    await page
      .getByTestId('rewards-position-supply')
      .or(page.getByTestId('rewards-supply-cta'))
      .first()
      .click();
    await expect(page.getByText('Supply to SPK Rewards')).toBeVisible();
  };

  test('Sequential: supply USDS to rewards completes successfully in two steps', async ({ isolatedPage }) => {
    await connectOn(isolatedPage, `/earn/rewards/${SPK_REWARD_CONTRACT}`);
    const positionBefore = await positionAmount(isolatedPage, 'rewards');
    await openSupplyModal(isolatedPage);

    await isolatedPage.getByTestId('rewards-modal-amount-input').fill('2');
    await reviewAndConfirm(isolatedPage);

    await expectFlowCompleted(isolatedPage);
    expect((await positionAmount(isolatedPage, 'rewards')) - positionBefore).toBeCloseTo(2, 0);
  });

  test('Sequential stale-state regression: changed amount is used after step-2 rejection, close and reopen', async ({
    isolatedPage
  }) => {
    await connectOn(isolatedPage, `/earn/rewards/${SPK_REWARD_CONTRACT}`);
    const positionBefore = await positionAmount(isolatedPage, 'rewards');

    await openSupplyModal(isolatedPage);

    // ── First attempt: approve succeeds, the supply tx is rejected ──
    await isolatedPage.getByTestId('rewards-modal-amount-input').fill('3');
    await interceptAndRejectSecondTransaction(isolatedPage, 200);
    await reviewAndConfirm(isolatedPage);

    // The failed step renders inline in the step list with a retry pill
    await expect(isolatedPage.getByRole('button', { name: 'Try again' })).toBeVisible({
      timeout: 60_000
    });

    // ── A step has mined, so Back is withheld: close, reopen, change the amount ──
    await expect(isolatedPage.getByTestId('transaction-modal-back')).toBeDisabled();
    await isolatedPage.getByTestId('transaction-modal-close').click();
    await expect(isolatedPage.getByRole('dialog')).toBeHidden();
    await openSupplyModal(isolatedPage);
    const amountInput = isolatedPage.getByTestId('rewards-modal-amount-input');
    await expect(amountInput).toBeVisible();
    await amountInput.fill('7');

    // ── Second attempt succeeds ──
    await interceptAndAllowTransactions(isolatedPage);
    await reviewAndConfirm(isolatedPage);

    await expectFlowCompleted(isolatedPage);

    // The position grew by the NEW amount (7), not the rejected one (3)
    expect((await positionAmount(isolatedPage, 'rewards')) - positionBefore).toBeCloseTo(7, 0);
  });
});
