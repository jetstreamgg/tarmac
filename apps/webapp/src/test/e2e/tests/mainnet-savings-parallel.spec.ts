import { expect, test } from '../fixtures-parallel';
import { SavingsProductPage } from '../pages/SavingsProductPage';
import { setErc20Balance } from '../utils/setBalance';
import { usdsAddress } from '@/hooks';
import { TENDERLY_CHAIN_ID } from '@/data/wagmi/config/testTenderlyChain';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms';
import { NetworkName } from '../utils/constants';

// V2 rewrite: parallel account-pool isolation on /earn/savings modal flow.
// See savings/QA-CASES.md §2 D-1, §3 #7.

test('Supply and withdraw from Savings - Parallel Safe', async ({ isolatedPage }) => {
  const savings = new SavingsProductPage(isolatedPage);
  await isolatedPage.goto('/earn/savings');
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await savings.expectProductShell();

  await savings.openSupplyModal();
  await savings.fillAmount('.02');
  await savings.reviewAndConfirm();

  await savings.openWithdrawModal();
  await savings.fillAmount('.01');
  await savings.reviewAndConfirm();
});

test('Balance isolation - parallel workers see unique wallet balances', async ({
  isolatedPage,
  testAccount
}) => {
  const uniqueBalance = 100 + parseInt(testAccount.slice(-2), 16);
  await setErc20Balance(
    usdsAddress[TENDERLY_CHAIN_ID],
    uniqueBalance.toString(),
    18,
    NetworkName.mainnet,
    testAccount
  );

  const savings = new SavingsProductPage(isolatedPage);
  await isolatedPage.goto('/earn/savings');
  await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  await savings.expectProductShell();

  await savings.openSupplyModal();
  await savings.amountMax().click();
  const maxValue = parseFloat(await savings.amountInput().inputValue());
  expect(maxValue).toBeGreaterThan(0);
  expect(maxValue).toBeLessThanOrEqual(uniqueBalance + 1);
});
