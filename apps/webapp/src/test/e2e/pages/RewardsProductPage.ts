import { expect, type Locator, type Page } from '@playwright/test';
import { rewardsProductDefaultContract } from '../contracts/rewards-product-default.contract';
import { rewardsSupplyFlowContract } from '../contracts/rewards-supply-flow.contract';
import { rewardsWithdrawFlowContract } from '../contracts/rewards-withdraw-flow.contract';
import { connectAndVerify } from '../utils/connectAndVerify';
import { type ConnectMockWalletOptions } from '../utils/connectMockWalletAndAcceptTerms';
import { expectTransactionSuccess } from '../utils/expectTransactionSuccess';
import { formatContractContext, locate } from './locate';

/** Semantic page object for /earn/rewards/:rewardContract (Gate 4). */
export class RewardsProductPage {
  constructor(private readonly page: Page) {}

  async goto(contractAddress: string) {
    await this.page.goto(`/earn/rewards/${contractAddress}`);
  }

  async connect(options?: ConnectMockWalletOptions) {
    await connectAndVerify(this.page, { batch: true, ...options });
  }

  async gotoConnected(contractAddress: string, options?: ConnectMockWalletOptions) {
    await this.goto(contractAddress);
    await this.connect(options);
  }

  supplyCard = () => locate(this.page, { testId: 'rewards-supply-card' }, rewardsProductDefaultContract);

  positionCard = () => locate(this.page, { testId: 'rewards-position-card' }, rewardsSupplyFlowContract);

  detailChart = () => locate(this.page, { testId: 'rewards-detail-chart' }, rewardsProductDefaultContract);

  transactions = () => locate(this.page, { testId: 'rewards-transactions' }, rewardsProductDefaultContract);

  supplyCta = () => locate(this.page, { testId: 'rewards-supply-cta' }, rewardsSupplyFlowContract);

  positionSupply = () => locate(this.page, { testId: 'rewards-position-supply' }, rewardsSupplyFlowContract);

  positionWithdraw = () =>
    locate(this.page, { testId: 'rewards-position-withdraw' }, rewardsWithdrawFlowContract);

  amountInput = () => locate(this.page, { testId: 'rewards-modal-amount-input' }, rewardsSupplyFlowContract);

  amountMax = () => locate(this.page, { testId: 'rewards-modal-amount-max' }, rewardsSupplyFlowContract);

  amountError = () => locate(this.page, { testId: 'rewards-modal-amount-error' }, rewardsSupplyFlowContract);

  async expectProductShell() {
    await expect(this.supplyCard().or(this.positionCard())).toBeVisible({ timeout: 15_000 });
  }

  async expectReadOnlyShell() {
    await expect(this.detailChart()).toBeVisible();
    await expect(this.transactions()).toBeVisible();
  }

  async openSupplyModal(displayName = 'SPK Rewards') {
    await this.positionSupply().or(this.supplyCta()).first().click();
    await expect(this.page.getByText(`Supply to ${displayName}`)).toBeVisible();
  }

  async openWithdrawModal(displayName = 'SPK Rewards') {
    await expect(this.positionWithdraw()).toBeVisible({ timeout: 30_000 });
    await this.positionWithdraw().click();
    await expect(this.page.getByText(`Withdraw from ${displayName}`)).toBeVisible();
  }

  async fillAmount(amount: string) {
    await this.amountInput().fill(amount);
  }

  async openSupplyConfirm(amount = '2', displayName = 'SPK Rewards'): Promise<Locator> {
    await this.openSupplyModal(displayName);
    await this.fillAmount(amount);
    await this.page.getByText('Review').first().click();
    const confirm = this.page.getByRole('button', { name: 'Confirm', exact: true });
    await expect(confirm).toBeEnabled({ timeout: 60_000 });
    return confirm;
  }

  async reviewAndConfirm() {
    await this.page.getByText('Review').first().click();
    const confirm = this.page.getByRole('button', { name: 'Confirm', exact: true });
    await expect(confirm).toBeEnabled({ timeout: 60_000 });
    await confirm.click();
    await expectTransactionSuccess(this.page);
  }

  repairContext(
    contractId: 'rewards-product-default' | 'rewards-supply-flow' | 'rewards-withdraw-flow'
  ) {
    const map = {
      'rewards-product-default': rewardsProductDefaultContract,
      'rewards-supply-flow': rewardsSupplyFlowContract,
      'rewards-withdraw-flow': rewardsWithdrawFlowContract
    } as const;
    return formatContractContext(map[contractId]);
  }
}
