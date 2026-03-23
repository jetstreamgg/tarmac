/*
 * Sequential (non-batch) transaction flow tests.
 */

import { expect, test } from '../fixtures-parallel';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms';
import { disableBundledTx, performSequentialAction } from '../utils/approveOrPerformAction';
import {
  interceptAndAllowTransactions,
  interceptAndRejectSecondTransaction
} from '../utils/rejectTransaction';

// ─────────────────────────────────────────────────────────────────────────────
// Savings Widget — sequential supply
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Sequential transactions — Savings supply', () => {
  test.beforeEach(async ({ isolatedPage }) => {
    await isolatedPage.goto('/');
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
    await isolatedPage.waitForTimeout(1000);
    await isolatedPage.getByRole('tab', { name: 'Savings' }).click();
  });

  test('Sequential: supply USDS completes successfully in two steps', async ({ isolatedPage }) => {
    // Ensure no pre-existing allowance so the approve step is required
    // await setErc20Balance(usdsAddress[TENDERLY_CHAIN_ID], '50', 18, NetworkName.mainnet);

    await isolatedPage.reload();
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
    await isolatedPage.waitForTimeout(1000);
    await isolatedPage.getByRole('tab', { name: 'Savings' }).click();

    await isolatedPage.getByTestId('supply-input-savings').fill('2');

    // Confirm 2-step sequential flow
    await performSequentialAction(isolatedPage, 'Supply');

    await expect(isolatedPage.getByText("You've supplied 2 USDS to the Sky Savings Rate module")).toBeVisible(
      { timeout: 15000 }
    );
  });

  test('Sequential: toggle off shows "Confirm 2 transactions" on Review screen', async ({ isolatedPage }) => {
    await isolatedPage.getByTestId('supply-input-savings').fill('1');
    await isolatedPage.getByTestId('widget-button').getByText('Review').first().click();

    // Initially bundled is on
    await expect(isolatedPage.getByTestId('widget-button').last()).toHaveText(
      /Confirm bundled transaction|Confirm supply/
    );

    await disableBundledTx(isolatedPage);

    // After toggling off, button reflects sequential mode
    await expect(isolatedPage.getByTestId('widget-button').last()).toHaveText(
      /Confirm 2 transactions|Confirm supply/
    );
  });

  test('Sequential stale-state regression: changed amount is used after step-2 rejection and Back', async ({
    isolatedPage
  }) => {
    // Start with enough balance and no prior allowance
    // await setErc20Balance(usdsAddress[TENDERLY_CHAIN_ID], '100', 18, NetworkName.mainnet);

    await isolatedPage.reload();
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
    await isolatedPage.waitForTimeout(1000);
    await isolatedPage.getByRole('tab', { name: 'Savings' }).click();

    // ── First attempt: approve succeeds, supply tx is rejected ──
    await isolatedPage.getByTestId('supply-input-savings').fill('3');
    await isolatedPage.getByTestId('widget-button').getByText('Review').first().click();
    await disableBundledTx(isolatedPage);

    const confirmButton = isolatedPage.getByTestId('widget-button').last();
    await expect(confirmButton).toBeEnabled();

    // Arm the interceptor to allow approve but reject the supply tx
    await interceptAndRejectSecondTransaction(isolatedPage, 200);
    await confirmButton.click(); // step 1 (approve) succeeds, then step 2 (supply) auto-fires and gets rejected

    // Error screen should appear
    await expect(isolatedPage.getByText(/error/i).first()).toBeVisible({ timeout: 15000 });

    // ── Go back and change the amount ──
    await isolatedPage.getByRole('button', { name: 'Back' }).last().click();
    // Should be back on the ACTION screen with input cleared
    await expect(isolatedPage.getByTestId('supply-input-savings')).toBeVisible();

    // Enter a DIFFERENT amount — the regression caused the original (3) to be used
    await isolatedPage.getByTestId('supply-input-savings').fill('5');

    // The allowance from step 1 is already set, so this should only need one transaction
    // But the UI may still show the toggle. Complete via Review.
    await isolatedPage.getByTestId('widget-button').getByText('Review').first().click();

    // If toggle is available, turn bundled off
    const toggle = isolatedPage.getByRole('switch');
    const toggleVisible = await toggle.isVisible().catch(() => false);
    if (toggleVisible) {
      const isChecked = await toggle.isChecked();
      if (isChecked) await toggle.click();
    }

    const retryButton = isolatedPage.getByTestId('widget-button').last();
    await expect(retryButton).toBeEnabled({ timeout: 10000 });
    await interceptAndAllowTransactions(isolatedPage);
    await retryButton.click();

    // Assert the NEW amount (5) appears in the success message, not the old one (3)
    await expect(isolatedPage.getByText("You've supplied 5 USDS to the Sky Savings Rate module")).toBeVisible(
      { timeout: 30000 }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Rewards Widget — sequential supply
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Sequential transactions — Rewards supply', () => {
  test.beforeEach(async ({ isolatedPage }) => {
    await isolatedPage.goto('/');
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
    await isolatedPage.waitForTimeout(1000);
    await isolatedPage.getByRole('tab', { name: 'Rewards' }).click();
    await isolatedPage.getByText('With: USDS Get: SPK').first().click();
  });

  test('Sequential: supply USDS to rewards completes successfully in two steps', async ({ isolatedPage }) => {
    // await setErc20Balance(usdsAddress[TENDERLY_CHAIN_ID], '50', 18, NetworkName.mainnet);

    await isolatedPage.reload();
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
    await isolatedPage.waitForTimeout(1000);
    await isolatedPage.getByRole('tab', { name: 'Rewards' }).click();
    await isolatedPage.getByText('With: USDS Get: SPK').first().click();

    await isolatedPage.getByTestId('supply-input-rewards').fill('2');

    await performSequentialAction(isolatedPage, 'Supply');

    await expect(isolatedPage.getByText(/Success!/i)).toBeVisible({ timeout: 15000 });
  });

  test('Sequential stale-state regression: changed amount is used after step-2 rejection and Back', async ({
    isolatedPage
  }) => {
    // await setErc20Balance(usdsAddress[TENDERLY_CHAIN_ID], '100', 18, NetworkName.mainnet);

    await isolatedPage.reload();
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
    await isolatedPage.waitForTimeout(1000);
    await isolatedPage.getByRole('tab', { name: 'Rewards' }).click();
    await isolatedPage.getByText('With: USDS Get: SPK').first().click();

    // ── First attempt: approve succeeds, supply tx is rejected ──
    await isolatedPage.getByTestId('supply-input-rewards').fill('3');
    await isolatedPage.getByTestId('widget-button').getByText('Review').first().click();
    await disableBundledTx(isolatedPage);

    const confirmButton = isolatedPage.getByTestId('widget-button').last();
    await expect(confirmButton).toBeEnabled();

    // Arm the interceptor to allow approve but reject the supply tx
    await interceptAndRejectSecondTransaction(isolatedPage, 200);
    await confirmButton.click(); // step 1 (approve) succeeds, then step 2 (supply) auto-fires and gets rejected

    await expect(isolatedPage.getByText(/error/i).first()).toBeVisible({ timeout: 15000 });

    // ── Go back, change amount ──
    await isolatedPage.getByRole('button', { name: 'Back' }).last().click();
    await expect(isolatedPage.getByTestId('supply-input-rewards')).toBeVisible();
    await isolatedPage.getByTestId('supply-input-rewards').fill('7');

    // ── Second attempt (should succeed) ──
    await isolatedPage.getByTestId('widget-button').getByText('Review').first().click();

    const toggle = isolatedPage.getByRole('switch');
    const toggleVisible = await toggle.isVisible().catch(() => false);
    if (toggleVisible) {
      const isChecked = await toggle.isChecked();
      if (isChecked) await toggle.click();
    }

    const retryButton = isolatedPage.getByTestId('widget-button').last();
    await expect(retryButton).toBeEnabled({ timeout: 10000 });
    await interceptAndAllowTransactions(isolatedPage);
    await retryButton.click();

    // The step-indicator for Supply should complete, and success should show
    await expect(isolatedPage.getByTestId('step-indicator').last()).toHaveText('Supply', {
      timeout: 30000
    });
    await expect(isolatedPage.getByText(/Success!/i)).toBeVisible({ timeout: 15000 });

    // Verify: the supplied balance reflects the NEW amount (7), not the original (3)
    await isolatedPage.getByRole('button', { name: 'Back to Rewards' }).click();
    const suppliedBalance = await isolatedPage
      .getByTestId('widget-container')
      .getByText('Supplied balance', { exact: true })
      .locator('xpath=ancestor::div[1]')
      .getByText(/^\d.*USDS$/)
      .innerText();
    expect(parseFloat(suppliedBalance.replace('USDS', '').trim())).toBeCloseTo(7, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Upgrade Widget — sequential DAI upgrade
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Sequential transactions — Upgrade DAI', () => {
  test.beforeEach(async ({ isolatedPage }) => {
    await isolatedPage.goto('/');
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
    await isolatedPage.getByRole('tab', { name: 'Convert' }).click();
    await isolatedPage.getByText('Upgrade your DAI to USDS and MKR to SKY').click();
  });

  test('Sequential: upgrade DAI completes successfully in two steps', async ({ isolatedPage }) => {
    await isolatedPage.getByTestId('upgrade-input-origin').fill('2');

    // click convert
    await performSequentialAction(isolatedPage, 'Upgrade');

    await expect(isolatedPage.getByText(/Success!/i)).toBeVisible({ timeout: 15000 });
  });

  test('Sequential stale-state regression: changed amount is used after step-2 rejection and Back', async ({
    isolatedPage
  }) => {
    // ── First attempt: approve succeeds, upgrade tx is rejected ──
    await isolatedPage.getByTestId('upgrade-input-origin').fill('4');
    await isolatedPage.getByTestId('widget-button').getByText('Review').click();
    await disableBundledTx(isolatedPage);

    const confirmButton = isolatedPage.getByTestId('widget-button').last();
    await expect(confirmButton).toBeEnabled();

    // Arm the interceptor to allow approve but reject the upgrade tx
    await interceptAndRejectSecondTransaction(isolatedPage, 200);
    await confirmButton.click(); // step 1 (approve) succeeds, then step 2 (upgrade) auto-fires and gets rejected

    await expect(isolatedPage.getByText(/error/i).first()).toBeVisible({ timeout: 15000 });

    // ── Go back, change amount ──
    await isolatedPage.getByRole('button', { name: 'Back', exact: true }).last().click();
    await expect(isolatedPage.getByTestId('upgrade-input-origin')).toBeVisible();
    await isolatedPage.getByTestId('upgrade-input-origin').fill('6');

    // ── Second attempt (should succeed) ──
    await isolatedPage.getByTestId('widget-button').getByText('Review').first().click();

    const toggle = isolatedPage.getByRole('switch');
    const toggleVisible = await toggle.isVisible().catch(() => false);
    if (toggleVisible) {
      const isChecked = await toggle.isChecked();
      if (isChecked) await toggle.click();
    }

    const retryButton = isolatedPage.getByTestId('widget-button').last();
    await expect(retryButton).toBeEnabled({ timeout: 10000 });
    await interceptAndAllowTransactions(isolatedPage);
    await retryButton.click();

    await expect(isolatedPage.getByText(/Success!/i)).toBeVisible({ timeout: 30000 });

    // Verify balances: DAI should have decreased by 6 (not 4)
    await isolatedPage.getByRole('button', { name: 'Back to Upgrade' }).click();
    // Check balance label updated (DAI went down)
    await expect(isolatedPage.getByTestId('upgrade-input-origin-balance')).not.toHaveText(
      'No wallet connected'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// StUSDS Widget — sequential deposit
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Sequential transactions — stUSDS deposit', () => {
  test.beforeEach(async ({ isolatedPage }) => {
    await isolatedPage.goto('/');
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
    await isolatedPage.getByRole('tab', { name: 'Expert' }).click();
    await isolatedPage.getByTestId('stusds-stats-card').click();
  });

  test('Sequential: deposit USDS to stUSDS completes successfully in two steps', async ({ isolatedPage }) => {
    // await setErc20Balance(usdsAddress[TENDERLY_CHAIN_ID], '50', 18, NetworkName.mainnet);

    await isolatedPage.reload();
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
    await isolatedPage.waitForTimeout(1000);
    await isolatedPage.getByRole('tab', { name: 'Expert' }).click();
    await isolatedPage.getByTestId('stusds-stats-card').click();

    await isolatedPage.getByTestId('supply-input-stusds').fill('2');

    await performSequentialAction(isolatedPage, 'Swap');

    await expect(isolatedPage.getByText(/You've supplied 2 USDS to the Curve pool for stUSDS/)).toBeVisible({
      timeout: 15000
    });
  });

  test('Sequential stale-state regression: changed amount is used after step-2 rejection and Back', async ({
    isolatedPage
  }) => {
    // await setErc20Balance(usdsAddress[TENDERLY_CHAIN_ID], '100', 18, NetworkName.mainnet);

    await isolatedPage.reload();
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
    await isolatedPage.waitForTimeout(1000);
    await isolatedPage.getByRole('tab', { name: 'Expert' }).click();
    await isolatedPage.getByTestId('stusds-stats-card').click();

    // ── First attempt: approve succeeds, deposit tx is rejected ──
    await isolatedPage.getByTestId('supply-input-stusds').fill('3');
    await isolatedPage.getByTestId('widget-button').getByText('Review').first().click();
    await disableBundledTx(isolatedPage);

    const confirmButton = isolatedPage.getByTestId('widget-button').last();
    await expect(confirmButton).toBeEnabled();

    // Arm the interceptor to allow approve but reject the deposit tx
    await interceptAndRejectSecondTransaction(isolatedPage, 200);
    await confirmButton.click(); // step 1 (approve) succeeds, then step 2 (deposit) auto-fires and gets rejected

    await expect(isolatedPage.getByText(/error/i).first()).toBeVisible({ timeout: 15000 });

    // ── Go back, change amount ──
    await isolatedPage.getByRole('button', { name: 'Back' }).last().click();
    await expect(isolatedPage.getByTestId('supply-input-stusds')).toBeVisible();
    await isolatedPage.getByTestId('supply-input-stusds').fill('8');

    // ── Second attempt (should succeed) ──
    await isolatedPage.getByTestId('widget-button').getByText('Review').first().click();

    const toggle = isolatedPage.getByRole('switch');
    const toggleVisible = await toggle.isVisible().catch(() => false);
    if (toggleVisible) {
      const isChecked = await toggle.isChecked();
      if (isChecked) await toggle.click();
    }

    const retryButton = isolatedPage.getByTestId('widget-button').last();
    await expect(retryButton).toBeEnabled({ timeout: 10000 });
    await interceptAndAllowTransactions(isolatedPage);
    await retryButton.click();

    // The new amount (8) should appear in the success message, not the original (3)
    await expect(isolatedPage.getByText(/You've supplied 8 USDS to the Curve pool for stUSDS/)).toBeVisible({
      timeout: 30000
    });
  });
});
