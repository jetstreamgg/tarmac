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
 * Bundling is a persisted user setting now (the nav-menu switch, not an
 * in-modal toggle), so the tests seed it off before the app boots. The modal
 * itself runs the three-screen flow: entry (Review) → review (Confirm) →
 * wallet/status screen, whose multi-step failures render inline in the step
 * list with a "Try again" pill.
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

/**
 * Turns the persisted bundling preference off before the app boots, so
 * multi-call flows run sequentially. Must run before the first goto.
 */
const seedBundlingOff = async (page: Page) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('user-settings', JSON.stringify({ batchEnabled: false }));
  });
};

const connectOn = async (page: Page, path: string) => {
  await seedBundlingOff(page);
  // Connect AFTER the goto — a full navigation resets the mock connector.
  await page.goto(path);
  await connectAndVerify(page, { batch: true });
};

/**
 * The position card's leading number, or 0 while the account has no position
 * and the page shows the supply CTA instead. Funded accounts already hold a
 * position in some markets, so the canaries assert DELTAS, never absolutes.
 */
const positionAmount = async (page: Page, market: 'savings' | 'rewards') => {
  const card = page.getByTestId(`${market}-position-card`);
  await expect(card.or(page.getByTestId(`${market}-supply-cta`)).first()).toBeVisible({ timeout: 15_000 });
  if (!(await card.isVisible())) return 0;
  const cardText = await card.innerText();
  return parseFloat(cardText.replace(/,/g, '').match(/(\d+(\.\d+)?)/)?.[1] ?? '0');
};

/** Advances the three-screen modal: entry's Review, then the review's Confirm. */
const reviewAndConfirm = async (page: Page) => {
  const review = page.getByRole('dialog').getByRole('button', { name: 'Review', exact: true });
  await expect(review).toBeEnabled({ timeout: 60_000 });
  await review.click();
  const confirm = page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true });
  await expect(confirm).toBeEnabled({ timeout: 60_000 });
  await confirm.click();
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
    await openSupplyModal(isolatedPage);

    await isolatedPage.getByTestId('savings-modal-amount-input').fill('2');
    await reviewAndConfirm(isolatedPage);

    // Approve and Supply run as two sequential wallet confirmations
    await expect(isolatedPage.getByText('Approve')).toBeVisible({ timeout: 60_000 });

    await expect(isolatedPage.getByText("You've successfully supplied to Sky Savings.")).toBeVisible({
      timeout: 60_000
    });
    await isolatedPage.getByRole('button', { name: 'Done' }).click();
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

    await expect(isolatedPage.getByText("You've successfully supplied to Sky Savings.")).toBeVisible({
      timeout: 60_000
    });
    await isolatedPage.getByRole('button', { name: 'Done' }).click();

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
    await openSupplyModal(isolatedPage);

    await isolatedPage.getByTestId('rewards-modal-amount-input').fill('2');
    await reviewAndConfirm(isolatedPage);

    await expect(isolatedPage.getByText("You've successfully supplied to SPK Rewards.")).toBeVisible({
      timeout: 60_000
    });
    await isolatedPage.getByRole('button', { name: 'Done' }).click();
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

    await expect(isolatedPage.getByText("You've successfully supplied to SPK Rewards.")).toBeVisible({
      timeout: 60_000
    });
    await isolatedPage.getByRole('button', { name: 'Done' }).click();

    // The position grew by the NEW amount (7), not the rejected one (3)
    expect((await positionAmount(isolatedPage, 'rewards')) - positionBefore).toBeCloseTo(7, 0);
  });
});
