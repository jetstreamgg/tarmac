import { expect, test } from '../fixtures-parallel';
import { RewardsProductPage } from '../pages/RewardsProductPage';
import { SPK_REWARD_CONTRACT } from '../utils/rewardsE2e';

// V2 rewrite: per-farm rewards on /earn/rewards/:contract. See rewards/QA-CASES.md §3.

test('SPK rewards product page renders the chart and transactions', async ({ isolatedPage }) => {
  const rewards = new RewardsProductPage(isolatedPage);
  await rewards.gotoConnected(SPK_REWARD_CONTRACT);
  await rewards.expectReadOnlyShell();
});

test('Supply modal validates the amount before enabling Review', async ({ isolatedPage }) => {
  const rewards = new RewardsProductPage(isolatedPage);
  await rewards.gotoConnected(SPK_REWARD_CONTRACT);
  await rewards.openSupplyModal();

  const review = isolatedPage.getByRole('dialog').getByRole('button', { name: 'Review', exact: true });
  await expect(review).toBeDisabled();

  await rewards.fillAmount('999999999');
  await expect(rewards.amountError()).toHaveText('Insufficient balance');
  await expect(review).toBeDisabled();

  await rewards.fillAmount('10');
  await expect(rewards.amountError()).not.toBeVisible();
  await expect(isolatedPage.getByTestId('rewards-modal-row-Supply')).toBeVisible();
  await expect(review).toBeEnabled({ timeout: 60_000 });
});

test('Max fills the full wallet balance', async ({ isolatedPage }) => {
  const rewards = new RewardsProductPage(isolatedPage);
  await rewards.gotoConnected(SPK_REWARD_CONTRACT);
  await rewards.openSupplyModal();

  await rewards.amountMax().click();
  const value = await rewards.amountInput().inputValue();
  expect(parseFloat(value)).toBeGreaterThan(0);
});

test('Supplies USDS to SPK Rewards and withdraws it back', async ({ isolatedPage }) => {
  const rewards = new RewardsProductPage(isolatedPage);
  await rewards.gotoConnected(SPK_REWARD_CONTRACT);

  await rewards.openSupplyModal();
  await rewards.fillAmount('10');
  await rewards.reviewAndConfirm();

  await expect(rewards.positionCard()).toBeVisible({ timeout: 15_000 });

  await rewards.openWithdrawModal();
  await rewards.fillAmount('9');
  await rewards.reviewAndConfirm();
});
