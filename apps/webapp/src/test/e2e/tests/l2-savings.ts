import { test } from '../fixtures-parallel';
import { SavingsProductPage } from '../pages/SavingsProductPage';
import { NetworkName } from '../utils/constants';

// V2 rewrite: savings on /earn/savings with savings-modal-* testids and
// savings-origin-select for L2 USDS/USDC. See savings/QA-CASES.md §3.

export const runL2SavingsTests = async ({ networkName }: { networkName: NetworkName }) => {
  test(`Go to ${networkName} Savings, deposit usds and usdc, withdraw usdc and usds`, async ({
    isolatedPage
  }) => {
    const savings = new SavingsProductPage(isolatedPage);
    await savings.gotoConnectedOnL2(networkName);

    await savings.openSupplyModal();
    await savings.fillAmount('10');
    await savings.reviewAndConfirm();

    await savings.openSupplyModal();
    await savings.selectOrigin('USDC');
    await savings.fillAmount('10');
    await savings.reviewAndConfirm();

    await savings.openWithdrawModal();
    await savings.selectOrigin('USDC');
    await savings.fillAmount('10');
    await savings.reviewAndConfirm();

    await savings.openWithdrawModal();
    await savings.fillAmount('9');
    await savings.reviewAndConfirm();
  });

  test(`Batch - Go to ${networkName} Savings and perform a batch deposit and a batch withdrawal`, async ({
    isolatedPage
  }) => {
    const savings = new SavingsProductPage(isolatedPage);
    await savings.gotoConnectedOnL2(networkName);

    await savings.openSupplyModal();
    await savings.fillAmount('10');
    await savings.reviewAndConfirm();

    await savings.openWithdrawModal();
    await savings.fillAmount('9');
    await savings.reviewAndConfirm();
  });
};
