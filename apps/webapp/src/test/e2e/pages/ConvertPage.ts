import { expect, type Page } from '@playwright/test';
import { convertDeepLinkContract } from '../contracts/convert-deep-link.contract';
import { convertPsmDefaultContract } from '../contracts/convert-psm-default.contract';
import { convertPsmFlowContract } from '../contracts/convert-psm-flow.contract';
import { connectAndVerify } from '../utils/connectAndVerify';
import { type ConnectMockWalletOptions } from '../utils/connectMockWalletAndAcceptTerms';
import { switchWalletNetwork, tenderlyChainLabel } from '../utils/switchWalletNetwork';
import { NetworkName } from '../utils/constants';
import { formatContractContext, locate } from './locate';

/** Semantic page object for /convert PSM (Gate 4). */
export class ConvertPage {
  constructor(private readonly page: Page) {}

  async goto(search?: string) {
    await this.page.goto(search ? `/convert?${search}` : '/convert');
  }

  async connect(options?: ConnectMockWalletOptions) {
    await connectAndVerify(this.page, { batch: true, ...options });
  }

  async gotoConnected(networkName: NetworkName = NetworkName.mainnet, options?: ConnectMockWalletOptions) {
    await this.goto();
    await this.connect(options);
    if (networkName !== NetworkName.mainnet) {
      await switchWalletNetwork(this.page, tenderlyChainLabel(networkName), networkName);
    }
    await this.expectShell();
    await this.expectBalancesLoaded();
  }

  root = () => locate(this.page, { testId: 'convert-page' }, convertPsmDefaultContract);

  card = () => locate(this.page, { testId: 'convert-card' }, convertPsmDefaultContract);

  network = () => locate(this.page, { testId: 'convert-network' }, convertPsmDefaultContract);

  fromAmount = () => locate(this.page, { testId: 'convert-from-amount' }, convertPsmFlowContract);

  toAmount = () => locate(this.page, { testId: 'convert-to-amount' }, convertPsmFlowContract);

  fromToken = () => locate(this.page, { testId: 'convert-from-token' }, convertDeepLinkContract);

  toToken = () => locate(this.page, { testId: 'convert-to-token' }, convertDeepLinkContract);

  fromBalance = () => locate(this.page, { testId: 'convert-from-balance' }, convertPsmDefaultContract);

  toBalance = () => locate(this.page, { testId: 'convert-to-balance' }, convertPsmDefaultContract);

  flip = () => locate(this.page, { testId: 'convert-flip' }, convertDeepLinkContract);

  reviewCta = () => locate(this.page, { testId: 'convert-review-cta' }, convertPsmFlowContract);

  error = () => locate(this.page, { testId: 'convert-error' }, convertPsmDefaultContract);

  modalReview = () => locate(this.page, { testId: 'convert-modal-review' }, convertPsmFlowContract);

  percent = (n: 25 | 50 | 100) =>
    locate(this.page, { testId: `convert-from-percent-${n}` }, convertPsmDefaultContract);

  async expectShell() {
    await expect(this.root()).toBeVisible();
  }

  /** Waits for wagmi balance reads — percent chips and Review need a funded balance. */
  async expectBalancesLoaded() {
    await expect
      .poll(
        async () => {
          const text = await this.fromBalance().textContent();
          const match = text?.match(/Balance: ([\d,.]+)/);
          return match ? parseFloat(match[1].replace(/,/g, '')) : 0;
        },
        { timeout: 30_000 }
      )
      .toBeGreaterThan(0);
    await expect(this.toBalance()).toHaveText(/Balance: [\d,.]+/, { timeout: 30_000 });
  }

  async fillFromAmount(amount: string) {
    await this.fromAmount().fill(amount);
  }

  async reviewAndConfirm() {
    await expect(this.reviewCta()).toBeEnabled({ timeout: 30_000 });
    await this.reviewCta().click();
    const confirm = this.page.getByRole('button', { name: 'Confirm', exact: true });
    await expect(confirm).toBeEnabled({ timeout: 60_000 });
    await confirm.click();
  }

  repairContext(contractId: 'convert-psm-default' | 'convert-psm-flow' | 'convert-deep-link') {
    const map = {
      'convert-psm-default': convertPsmDefaultContract,
      'convert-psm-flow': convertPsmFlowContract,
      'convert-deep-link': convertDeepLinkContract
    } as const;
    return formatContractContext(map[contractId]);
  }
}
