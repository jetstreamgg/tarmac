import { expect, type Page } from '@playwright/test';
import { stakeDeepLinkContract } from '../contracts/stake-deep-link.contract';
import { stakeManageFlowContract } from '../contracts/stake-manage-flow.contract';
import { stakeOpenFlowContract } from '../contracts/stake-open-flow.contract';
import { stakeProductDefaultContract } from '../contracts/stake-product-default.contract';
import { expectTransactionSuccess } from '../utils/expectTransactionSuccess';
import { formatContractContext, locate } from './locate';

/** Collateral for borrow-involving specs — see stakeV2.ts comment block. */
export const BORROW_SPEC_SKY = '25000000';

/**
 * Semantic page object for /stake (Gate 4).
 *
 * Navigation caveat: mock-wallet connection does not survive full page load;
 * deep links use history.pushState + popstate (no reload).
 */
export class StakePage {
  constructor(private readonly page: Page) {}

  productPage = () => locate(this.page, { testId: 'stake-product-page' }, stakeProductDefaultContract);

  tabs = () => locate(this.page, { testId: 'stake-tabs' }, stakeProductDefaultContract);

  tabPositions = () => locate(this.page, { testId: 'stake-tab-positions' }, stakeProductDefaultContract);

  engineCard = () => locate(this.page, { testId: 'stake-engine-card' }, stakeProductDefaultContract);

  positionsEmpty = () => locate(this.page, { testId: 'stake-positions-empty' }, stakeProductDefaultContract);

  openPositionCta = () =>
    locate(this.page, { testId: 'stake-open-position-cta' }, stakeProductDefaultContract);

  takeover = () => locate(this.page, { testId: 'stake-takeover' }, stakeOpenFlowContract);

  takeoverStakeAmount = () =>
    locate(this.page, { testId: 'stake-takeover-stake-amount' }, stakeOpenFlowContract);

  takeoverBorrowToggle = () =>
    locate(this.page, { testId: 'stake-takeover-borrow-card-toggle' }, stakeOpenFlowContract);

  takeoverBorrowAmount = () =>
    locate(this.page, { testId: 'stake-takeover-borrow-amount' }, stakeOpenFlowContract);

  takeoverDelegateToggle = () =>
    locate(this.page, { testId: 'stake-takeover-delegate-card-toggle' }, stakeOpenFlowContract);

  takeoverDelegateList = () =>
    locate(this.page, { testId: 'stake-takeover-delegate-list' }, stakeOpenFlowContract);

  takeoverConfirm = () => locate(this.page, { testId: 'stake-takeover-confirm' }, stakeOpenFlowContract);

  takeoverBorrowSlider = () =>
    locate(this.page, { testId: 'stake-takeover-borrow-slider' }, stakeOpenFlowContract);

  takeoverRiskPill = () => locate(this.page, { testId: 'stake-takeover-risk-pill' }, stakeOpenFlowContract);

  positionDetails = () => locate(this.page, { testId: 'stake-position-details' }, stakeManageFlowContract);

  manageTakeover = () => locate(this.page, { testId: 'stake-manage-takeover' }, stakeManageFlowContract);

  manageMenuBorrow = () => locate(this.page, { testId: 'stake-manage-menu-borrow' }, stakeManageFlowContract);

  manageBorrowAmount = () =>
    locate(this.page, { testId: 'stake-manage-borrow-amount' }, stakeManageFlowContract);

  manageConfirm = () => locate(this.page, { testId: 'stake-manage-confirm' }, stakeManageFlowContract);

  manageStakeWithdrawMode = () =>
    locate(this.page, { testId: 'stake-manage-stake-card-mode-withdraw' }, stakeDeepLinkContract);

  manageBorrowRepayMode = () =>
    locate(this.page, { testId: 'stake-manage-borrow-card-mode-repay' }, stakeDeepLinkContract);

  /** In-app navigation to /stake with optional search params (no reload). */
  async deepLink(search = '') {
    await this.page.evaluate(qs => {
      const params = new URLSearchParams(window.location.search);
      const network = params.get('network');
      const target = new URLSearchParams(qs);
      if (network && !target.has('network')) target.set('network', network);
      history.pushState({}, '', `/stake${target.size ? `?${target.toString()}` : ''}`);
      window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
    }, search);
    await expect(this.productPage()).toBeVisible({ timeout: 15_000 });
  }

  async confirmTransactionModal() {
    const confirm = this.page.getByRole('button', { name: 'Confirm', exact: true });
    await expect(confirm).toBeEnabled({ timeout: 60_000 });
    await confirm.click();
    await expectTransactionSuccess(this.page);
  }

  async openPosition({ sky, usds, delegate = false }: { sky: string; usds?: string; delegate?: boolean }) {
    await this.deepLink('flow=open');
    await expect(this.takeover()).toBeVisible({ timeout: 15_000 });

    await this.takeoverStakeAmount().fill(sky);

    if (usds) {
      await this.takeoverBorrowToggle().click();
      // Borrow input stays disabled until the debounced stake simulation clears
      // the min-collateral gate — the stake card's min-stake stat is the same
      // readiness signal the mobile comp specs already wait on.
      await expect(this.page.getByTestId('stake-takeover-min-stake')).toBeVisible({ timeout: 60_000 });
      const borrowAmount = this.takeoverBorrowAmount();
      await expect(borrowAmount).toBeEnabled({ timeout: 60_000 });
      await borrowAmount.fill(usds);
    }

    if (delegate) {
      await this.takeoverDelegateToggle().click();
      await expect(this.takeoverDelegateList()).toBeVisible({ timeout: 15_000 });
      await this.takeoverDelegateList()
        .locator('[data-testid^="stake-takeover-delegate-0x"]')
        .first()
        .click();
    }

    const confirm = this.takeoverConfirm();
    await expect(confirm).toBeEnabled({ timeout: 60_000 });
    await confirm.click();
    await this.confirmTransactionModal();
  }

  async gotoManage(urnIndex = 0) {
    await this.deepLink(`flow=manage&urn_index=${urnIndex}`);
    await expect(this.positionDetails()).toBeVisible({ timeout: 30_000 });
  }

  repairContext(
    contractId: 'stake-product-default' | 'stake-open-flow' | 'stake-manage-flow' | 'stake-deep-link'
  ) {
    const map = {
      'stake-product-default': stakeProductDefaultContract,
      'stake-open-flow': stakeOpenFlowContract,
      'stake-manage-flow': stakeManageFlowContract,
      'stake-deep-link': stakeDeepLinkContract
    } as const;
    return formatContractContext(map[contractId]);
  }
}
