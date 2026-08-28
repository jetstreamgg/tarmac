import { expect, type Locator, type Page } from '@playwright/test';
import { savingsL2OriginContract } from '../contracts/savings-l2-origin.contract';
import { savingsProductDefaultContract } from '../contracts/savings-product-default.contract';
import { savingsSupplyFlowContract } from '../contracts/savings-supply-flow.contract';
import { savingsWithdrawFlowContract } from '../contracts/savings-withdraw-flow.contract';
import { connectAndVerify } from '../utils/connectAndVerify';
import { type ConnectMockWalletOptions } from '../utils/connectMockWalletAndAcceptTerms';
import { expectTransactionSuccess } from '../utils/expectTransactionSuccess';
import { switchWalletNetwork, tenderlyChainLabel } from '../utils/switchWalletNetwork';
import { NetworkName } from '../utils/constants';
import { formatContractContext, locate } from './locate';

export type SavingsOrigin = 'USDS' | 'USDC' | 'DAI';

/** Semantic page object for /earn/savings (Gate 4). */
export class SavingsProductPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/earn/savings');
  }

  /** Connect after navigation — full goto resets the mock connector. */
  async connect(options?: ConnectMockWalletOptions) {
    await connectAndVerify(this.page, { batch: true, ...options });
  }

  async gotoConnected(options?: ConnectMockWalletOptions) {
    await this.goto();
    await this.connect(options);
  }

  async gotoConnectedOnL2(networkName: NetworkName, options?: ConnectMockWalletOptions) {
    await this.gotoConnected(options);
    await switchWalletNetwork(this.page, tenderlyChainLabel(networkName), networkName);
    await this.expectProductShell();
  }

  supplyCard = () => locate(this.page, { testId: 'savings-supply-card' }, savingsProductDefaultContract);

  positionCard = () => locate(this.page, { testId: 'savings-position-card' }, savingsSupplyFlowContract);

  detailChart = () => locate(this.page, { testId: 'savings-detail-chart' }, savingsProductDefaultContract);

  transactions = () => locate(this.page, { testId: 'savings-transactions' }, savingsProductDefaultContract);

  supplyCta = () => locate(this.page, { testId: 'savings-supply-cta' }, savingsSupplyFlowContract);

  positionSupply = () => locate(this.page, { testId: 'savings-position-supply' }, savingsSupplyFlowContract);

  positionWithdraw = () => locate(this.page, { testId: 'savings-position-withdraw' }, savingsWithdrawFlowContract);

  amountInput = () => locate(this.page, { testId: 'savings-modal-amount-input' }, savingsSupplyFlowContract);

  amountMax = () => locate(this.page, { testId: 'savings-modal-amount-max' }, savingsSupplyFlowContract);

  amountError = () => locate(this.page, { testId: 'savings-modal-amount-error' }, savingsSupplyFlowContract);

  originSelect = () => locate(this.page, { testId: 'savings-origin-select' }, savingsL2OriginContract);

  async expectProductShell() {
    await expect(this.supplyCard().or(this.positionCard())).toBeVisible({ timeout: 15_000 });
  }

  async expectReadOnlyShell() {
    await expect(this.detailChart()).toBeVisible();
    await expect(this.transactions()).toBeVisible();
  }

  async openSupplyModal() {
    await this.positionSupply().or(this.supplyCta()).first().click();
    await expect(this.page.getByText('Supply to Sky Savings')).toBeVisible();
  }

  async openWithdrawModal() {
    await expect(this.positionWithdraw()).toBeVisible({ timeout: 30_000 });
    await this.positionWithdraw().click();
    await expect(this.page.getByText('Withdraw from Sky Savings')).toBeVisible();
  }

  async selectOrigin(symbol: SavingsOrigin) {
    await this.originSelect().click();
    await this.page.getByTestId(`savings-origin-${symbol.toLowerCase()}`).click();
  }

  async fillAmount(amount: string) {
    await this.amountInput().fill(amount);
  }

  /** Returns the enabled Confirm button (unclicked) after Review. */
  async openSupplyConfirm(amount = '2'): Promise<Locator> {
    await this.openSupplyModal();
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
    contractId:
      | 'savings-product-default'
      | 'savings-supply-flow'
      | 'savings-withdraw-flow'
      | 'savings-l2-origin'
  ) {
    const map = {
      'savings-product-default': savingsProductDefaultContract,
      'savings-supply-flow': savingsSupplyFlowContract,
      'savings-withdraw-flow': savingsWithdrawFlowContract,
      'savings-l2-origin': savingsL2OriginContract
    } as const;
    return formatContractContext(map[contractId]);
  }
}
