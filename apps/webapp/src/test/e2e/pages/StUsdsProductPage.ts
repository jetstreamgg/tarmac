import { expect, type Page } from '@playwright/test';
import { stusdsProductDefaultContract } from '../contracts/stusds-product-default.contract';
import { stusdsSupplyFlowContract } from '../contracts/stusds-supply-flow.contract';
import { connectAndVerify } from '../utils/connectAndVerify';
import { type ConnectMockWalletOptions } from '../utils/connectMockWalletAndAcceptTerms';
import { formatContractContext, locate } from './locate';

/** Semantic page object for /earn/stusds (Gate 4). */
export class StUsdsProductPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/earn/stusds');
  }

  async connect(options?: ConnectMockWalletOptions) {
    await connectAndVerify(this.page, { batch: true, ...options });
  }

  async gotoConnected(options?: ConnectMockWalletOptions) {
    await this.goto();
    await this.connect(options);
  }

  productDetail = () => locate(this.page, { testId: 'product-detail' }, stusdsProductDefaultContract);

  supplyCard = () => locate(this.page, { testId: 'stusds-supply-card' }, stusdsProductDefaultContract);

  positionCard = () => locate(this.page, { testId: 'stusds-position-card' }, stusdsSupplyFlowContract);

  detailChart = () => locate(this.page, { testId: 'stusds-detail-chart' }, stusdsProductDefaultContract);

  transactions = () => locate(this.page, { testId: 'stusds-transactions' }, stusdsProductDefaultContract);

  supplyCta = () => locate(this.page, { testId: 'stusds-supply-cta' }, stusdsSupplyFlowContract);

  amountInput = () => locate(this.page, { testId: 'stusds-modal-amount-input' }, stusdsSupplyFlowContract);

  amountError = () => locate(this.page, { testId: 'stusds-modal-amount-error' }, stusdsSupplyFlowContract);

  providerNotice = () => locate(this.page, { testId: 'stusds-provider-notice' }, stusdsSupplyFlowContract);

  async expectReadOnlyShell() {
    await expect(this.productDetail()).toBeVisible({ timeout: 15_000 });
    await expect(this.detailChart()).toBeVisible({ timeout: 30_000 });
    await expect(this.transactions()).toBeVisible({ timeout: 30_000 });
  }

  async openSupplyModal() {
    await this.supplyCta().click();
    await expect(this.page.getByText('Supply to stUSDS')).toBeVisible();
  }

  async fillAmount(amount: string) {
    await this.amountInput().fill(amount);
  }

  repairContext(contractId: 'stusds-product-default' | 'stusds-supply-flow') {
    const map = {
      'stusds-product-default': stusdsProductDefaultContract,
      'stusds-supply-flow': stusdsSupplyFlowContract
    } as const;
    return formatContractContext(map[contractId]);
  }
}
