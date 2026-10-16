import { expect, type Page } from '@playwright/test';
import { bridgeNativeBlocksContract } from '../contracts/bridge-native-blocks.contract';
import { bridgeNativeFlowContract } from '../contracts/bridge-native-flow.contract';
import { connectAndVerify } from '../utils/connectAndVerify';
import { locate } from './locate';

/** Semantic page object for the /convert Bridge tab. */
export class BridgePage {
  constructor(private readonly page: Page) {}

  async gotoConnected({ batch = true }: { batch?: boolean } = {}) {
    await this.page.goto('/convert?tab=bridge');
    await connectAndVerify(this.page, { batch });
    await expect(this.panel()).toBeVisible();
    await this.expectBalanceLoaded();
  }

  panel = () => locate(this.page, { testId: 'bridge-panel' }, bridgeNativeFlowContract);

  toNetwork = () => locate(this.page, { testId: 'bridge-to-network' }, bridgeNativeFlowContract);

  fromAmount = () => locate(this.page, { testId: 'bridge-from-amount' }, bridgeNativeFlowContract);

  fromBalance = () => locate(this.page, { testId: 'bridge-from-balance' }, bridgeNativeFlowContract);

  reviewCta = () => locate(this.page, { testId: 'bridge-review-cta' }, bridgeNativeFlowContract);

  modalReview = () => locate(this.page, { testId: 'bridge-modal-review' }, bridgeNativeFlowContract);

  modalRow = (label: string) =>
    locate(this.page, { testId: `bridge-modal-row-${label}` }, bridgeNativeFlowContract);

  blocked = () => locate(this.page, { testId: 'bridge-blocked' }, bridgeNativeBlocksContract);

  recipientButton = () =>
    locate(this.page, { testId: 'bridge-recipient-button' }, bridgeNativeBlocksContract);

  recipientInput = () => locate(this.page, { testId: 'bridge-recipient-input' }, bridgeNativeBlocksContract);

  recipientSave = () => locate(this.page, { testId: 'bridge-recipient-save' }, bridgeNativeBlocksContract);

  recipientError = () => locate(this.page, { testId: 'bridge-recipient-error' }, bridgeNativeBlocksContract);

  recipientBlocked = () =>
    locate(this.page, { testId: 'bridge-recipient-blocked' }, bridgeNativeBlocksContract);

  cards = () => locate(this.page, { testId: 'pending-bridge-card' }, bridgeNativeFlowContract);

  /** The newest card to `network`; the list is newest first. */
  card = (network: string) => this.cards().filter({ hasText: network }).first();

  async expectBalanceLoaded() {
    await expect(this.fromBalance()).toHaveText(/Balance: [\d,.]*[1-9]/, { timeout: 30_000 });
  }

  async selectDestination(network: 'base' | 'optimism' | 'unichain' | 'arbitrum') {
    await this.toNetwork().click();
    await this.page.getByTestId(`bridge-to-network-${network}`).click();
    await expect(this.toNetwork()).toHaveAttribute('data-state', 'closed');
  }

  async setRecipient(address: string) {
    await this.recipientButton().click();
    await this.recipientInput().fill(address);
  }

  async openReview(amount: string) {
    await this.fromAmount().fill(amount);
    await expect(this.reviewCta()).toBeEnabled({ timeout: 30_000 });
    await this.reviewCta().click();
    await expect(this.modalReview()).toBeVisible();
  }

  confirmButton = () => this.page.getByRole('button', { name: 'Confirm', exact: true });
}
