import { expect, type Page } from '@playwright/test';
import { pendleDeepLinkContract } from '../contracts/pendle-deep-link.contract';
import { pendleProductDefaultContract } from '../contracts/pendle-product-default.contract';
import { pendleSupplyFlowContract } from '../contracts/pendle-supply-flow.contract';
import { connectAndVerify } from '../utils/connectAndVerify';
import { type ConnectMockWalletOptions } from '../utils/connectMockWalletAndAcceptTerms';
import { pendleMarketPath } from '../utils/pendleE2e';
import { formatContractContext, locate } from './locate';

/** Semantic page object for /earn/fixed/:slug (Gate 4). */
export class PendleProductPage {
  constructor(private readonly page: Page) {}

  async goto(slug: string) {
    await this.page.goto(pendleMarketPath(slug));
  }

  async connect(options?: ConnectMockWalletOptions) {
    await connectAndVerify(this.page, { batch: true, ...options });
  }

  async gotoConnected(slug: string, options?: ConnectMockWalletOptions) {
    await this.goto(slug);
    await this.connect(options);
  }

  productDetail = () => locate(this.page, { testId: 'product-detail' }, pendleProductDefaultContract);

  supplyCard = () => locate(this.page, { testId: 'pendle-supply-card' }, pendleProductDefaultContract);

  positionCard = () => locate(this.page, { testId: 'pendle-position-card' }, pendleSupplyFlowContract);

  detailChart = () => locate(this.page, { testId: 'pendle-detail-chart' }, pendleProductDefaultContract);

  maturityProgress = () =>
    locate(this.page, { testId: 'pendle-maturity-progress' }, pendleProductDefaultContract);

  transactions = () => locate(this.page, { testId: 'pendle-transactions' }, pendleProductDefaultContract);

  supplyCta = () => locate(this.page, { testId: 'pendle-supply-cta' }, pendleSupplyFlowContract);

  async expectReadOnlyShell() {
    await expect(this.productDetail()).toBeVisible({ timeout: 15_000 });
    await expect(this.detailChart()).toBeVisible({ timeout: 30_000 });
    await expect(this.transactions()).toBeVisible({ timeout: 30_000 });
  }

  async openSupplyModal(modalName: string) {
    await this.supplyCta().click();
    await expect(this.page.getByText(`Supply to ${modalName}`)).toBeVisible();
  }

  repairContext(contractId: 'pendle-product-default' | 'pendle-supply-flow' | 'pendle-deep-link') {
    const map = {
      'pendle-product-default': pendleProductDefaultContract,
      'pendle-supply-flow': pendleSupplyFlowContract,
      'pendle-deep-link': pendleDeepLinkContract
    } as const;
    return formatContractContext(map[contractId]);
  }
}
