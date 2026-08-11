/*
 * Sequential (non-batch) transaction flow tests — the canary for the
 * useSequentialTransactionFlow retry contract: a changed amount after a
 * step-2 rejection and Back must be used on the next attempt.
 *
 * V2 rewrite (see e2e-migration.md): flows run through the editable entry
 * modal on /earn/savings and /earn/rewards/:rewardContract. The legacy
 * upgrade block was dropped — /convert/upgrade is a parked surface.
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

/** Switches the modal's bundle toggle off so the flow runs sequentially. */
const disableBundling = async (page: Page) => {
  const toggle = page.getByRole('dialog').getByRole('switch');
  await toggle.waitFor({ state: 'visible' });
  if (await toggle.isChecked()) {
    await toggle.click();
  }
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

  test.fixme('Sequential: supply USDS completes successfully in two steps', async ({ isolatedPage }) => {
    await connectOn(isolatedPage, '/earn/savings');
    await openSupplyModal(isolatedPage);

    await isolatedPage.getByTestId('savings-modal-amount-input').fill('2');
    await disableBundling(isolatedPage);

    const confirm = isolatedPage.getByRole('dialog').getByRole('button', { name: 'Supply', exact: true });
    await expect(confirm).toBeEnabled({ timeout: 60_000 });
    await confirm.click();

    // Approve and Supply run as two sequential wallet confirmations
    await expect(isolatedPage.getByText('Approve')).toBeVisible({ timeout: 60_000 });

    await expect(isolatedPage.getByText("You've successfully supplied to Sky Savings.")).toBeVisible({
      timeout: 60_000
    });
    await isolatedPage.getByRole('button', { name: 'Done' }).click();
  });

  test('Sequential stale-state regression: changed amount is used after step-2 rejection and Back', async ({
    isolatedPage
  }) => {
    await connectOn(isolatedPage, '/earn/savings');
    await openSupplyModal(isolatedPage);

    // ── First attempt: approve succeeds, the supply tx is rejected ──
    await isolatedPage.getByTestId('savings-modal-amount-input').fill('3');
    await disableBundling(isolatedPage);

    const confirm = isolatedPage.getByRole('dialog').getByRole('button', { name: 'Supply', exact: true });
    await expect(confirm).toBeEnabled({ timeout: 60_000 });

    await interceptAndRejectSecondTransaction(isolatedPage, 200);
    await confirm.click();

    await expect(isolatedPage.getByText('Transaction failed. Please try again.')).toBeVisible({
      timeout: 60_000
    });

    // ── Back to the editable entry, change the amount ──
    await isolatedPage.getByRole('button', { name: 'Back', exact: true }).last().click();
    const amountInput = isolatedPage.getByTestId('savings-modal-amount-input');
    await expect(amountInput).toBeVisible();
    await amountInput.fill('5');

    // ── Second attempt succeeds; the allowance from step 1 already covers it ──
    await interceptAndAllowTransactions(isolatedPage);
    const retry = isolatedPage.getByRole('dialog').getByRole('button', { name: 'Supply', exact: true });
    await expect(retry).toBeEnabled({ timeout: 60_000 });
    await retry.click();

    await expect(isolatedPage.getByText("You've successfully supplied to Sky Savings.")).toBeVisible({
      timeout: 60_000
    });
    await isolatedPage.getByRole('button', { name: 'Done' }).click();

    // The position reflects the NEW amount (5), not the rejected one (3)
    const card = isolatedPage.getByTestId('savings-position-card');
    await expect(card).toBeVisible({ timeout: 15_000 });
    const cardText = await card.innerText();
    const amount = parseFloat(cardText.replace(/,/g, '').match(/(\d+(\.\d+)?)/)?.[1] ?? '0');
    expect(amount).toBeCloseTo(5, 0);
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

  test.fixme('Sequential: supply USDS to rewards completes successfully in two steps', async ({
    isolatedPage
  }) => {
    await connectOn(isolatedPage, `/earn/rewards/${SPK_REWARD_CONTRACT}`);
    await openSupplyModal(isolatedPage);

    await isolatedPage.getByTestId('rewards-modal-amount-input').fill('2');
    await disableBundling(isolatedPage);

    const confirm = isolatedPage.getByRole('dialog').getByRole('button', { name: 'Supply', exact: true });
    await expect(confirm).toBeEnabled({ timeout: 60_000 });
    await confirm.click();

    await expect(isolatedPage.getByText("You've successfully supplied to SPK Rewards.")).toBeVisible({
      timeout: 60_000
    });
    await isolatedPage.getByRole('button', { name: 'Done' }).click();
  });

  test('Sequential stale-state regression: changed amount is used after step-2 rejection and Back', async ({
    isolatedPage
  }) => {
    await connectOn(isolatedPage, `/earn/rewards/${SPK_REWARD_CONTRACT}`);
    await openSupplyModal(isolatedPage);

    // ── First attempt: approve succeeds, the supply tx is rejected ──
    await isolatedPage.getByTestId('rewards-modal-amount-input').fill('3');
    await disableBundling(isolatedPage);

    const confirm = isolatedPage.getByRole('dialog').getByRole('button', { name: 'Supply', exact: true });
    await expect(confirm).toBeEnabled({ timeout: 60_000 });

    await interceptAndRejectSecondTransaction(isolatedPage, 200);
    await confirm.click();

    await expect(isolatedPage.getByText('Transaction failed. Please try again.')).toBeVisible({
      timeout: 60_000
    });

    // ── Back to the editable entry, change the amount ──
    await isolatedPage.getByRole('button', { name: 'Back', exact: true }).last().click();
    const amountInput = isolatedPage.getByTestId('rewards-modal-amount-input');
    await expect(amountInput).toBeVisible();
    await amountInput.fill('7');

    // ── Second attempt succeeds ──
    await interceptAndAllowTransactions(isolatedPage);
    const retry = isolatedPage.getByRole('dialog').getByRole('button', { name: 'Supply', exact: true });
    await expect(retry).toBeEnabled({ timeout: 60_000 });
    await retry.click();

    await expect(isolatedPage.getByText("You've successfully supplied to SPK Rewards.")).toBeVisible({
      timeout: 60_000
    });
    await isolatedPage.getByRole('button', { name: 'Done' }).click();

    // The position reflects the NEW amount (7), not the rejected one (3)
    const card = isolatedPage.getByTestId('rewards-position-card');
    await expect(card).toBeVisible({ timeout: 15_000 });
    const cardText = await card.innerText();
    const amount = parseFloat(cardText.replace(/,/g, '').match(/(\d+(\.\d+)?)/)?.[1] ?? '0');
    expect(amount).toBeCloseTo(7, 0);
  });
});
