import { expect, type Locator, type Page } from '@playwright/test';
import { vaultProductDefaultContract } from '../contracts/vault-product-default.contract';
import { vaultSupplyFlowContract } from '../contracts/vault-supply-flow.contract';
import { vaultWithdrawFlowContract } from '../contracts/vault-withdraw-flow.contract';
import { connectAndVerify } from '../utils/connectAndVerify';
import { type ConnectMockWalletOptions } from '../utils/connectMockWalletAndAcceptTerms';
import { expectTransactionSuccess } from '../utils/expectTransactionSuccess';
import { morphoVaultPath } from '../utils/vaultsE2e';
import { formatContractContext, locate } from './locate';

/** Semantic page object for /earn/vaults/morpho/:address (Gate 4). */
export class VaultProductPage {
  constructor(private readonly page: Page) {}

  async goto(vaultAddress: string) {
    await this.page.goto(morphoVaultPath(vaultAddress));
  }

  async connect(options?: ConnectMockWalletOptions) {
    await connectAndVerify(this.page, { batch: true, ...options });
  }

  async gotoConnected(vaultAddress: string, options?: ConnectMockWalletOptions) {
    await this.goto(vaultAddress);
    await this.connect(options);
  }

  supplyCard = () => locate(this.page, { testId: 'vault-supply-card' }, vaultProductDefaultContract);

  positionCard = () => locate(this.page, { testId: 'vault-position-card' }, vaultSupplyFlowContract);

  detailChart = () => locate(this.page, { testId: 'vault-detail-chart' }, vaultProductDefaultContract);

  strategy = () => locate(this.page, { testId: 'vault-strategy' }, vaultProductDefaultContract);

  transactions = () => locate(this.page, { testId: 'vault-transactions' }, vaultProductDefaultContract);

  supplyCta = () => locate(this.page, { testId: 'vault-supply-cta' }, vaultSupplyFlowContract);

  positionSupply = () => locate(this.page, { testId: 'vault-position-supply' }, vaultSupplyFlowContract);

  positionWithdraw = () => locate(this.page, { testId: 'vault-position-withdraw' }, vaultWithdrawFlowContract);

  amountInput = () => locate(this.page, { testId: 'vault-modal-amount-input' }, vaultSupplyFlowContract);

  amountMax = () => locate(this.page, { testId: 'vault-modal-amount-max' }, vaultSupplyFlowContract);

  amountError = () => locate(this.page, { testId: 'vault-modal-amount-error' }, vaultSupplyFlowContract);

  async expectProductShell() {
    await expect(this.supplyCard().or(this.positionCard())).toBeVisible({ timeout: 15_000 });
  }

  async expectReadOnlyShell() {
    await expect(this.detailChart()).toBeVisible({ timeout: 30_000 });
    await expect(this.strategy()).toBeVisible();
    await expect(this.transactions()).toBeVisible({ timeout: 30_000 });
  }

  async openSupplyModal(vaultName: string) {
    await this.positionSupply().or(this.supplyCta()).first().click();
    await expect(this.page.getByText(`Supply to ${vaultName}`)).toBeVisible();
  }

  async openWithdrawModal(vaultName: string) {
    await expect(this.positionWithdraw()).toBeVisible({ timeout: 30_000 });
    await this.positionWithdraw().click();
    await expect(this.page.getByText(`Withdraw from ${vaultName}`)).toBeVisible();
  }

  async fillAmount(amount: string) {
    await this.amountInput().fill(amount);
  }

  async openSupplyConfirm(vaultName: string, amount = '2'): Promise<Locator> {
    await this.openSupplyModal(vaultName);
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

  repairContext(contractId: 'vault-product-default' | 'vault-supply-flow' | 'vault-withdraw-flow') {
    const map = {
      'vault-product-default': vaultProductDefaultContract,
      'vault-supply-flow': vaultSupplyFlowContract,
      'vault-withdraw-flow': vaultWithdrawFlowContract
    } as const;
    return formatContractContext(map[contractId]);
  }
}
