import { expect, type Page } from '@playwright/test';
import { portfolioConnectedContract } from '../contracts/portfolio-connected.contract';
import { portfolioDisconnectedContract } from '../contracts/portfolio-disconnected.contract';
import { portfolioPendleMaturedContract } from '../contracts/portfolio-pendle-matured.contract';
import { formatContractContext, locate } from './locate';

/** Semantic page object for /portfolio (Gate 4). */
export class PortfolioPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/portfolio');
  }

  root = () => locate(this.page, { testId: 'portfolio-page' }, portfolioDisconnectedContract);

  connectButton = () =>
    locate(this.page, { testId: 'portfolio-connect-card-button' }, portfolioDisconnectedContract);

  statistics = () => locate(this.page, { testId: 'portfolio-statistics' }, portfolioDisconnectedContract);

  earningsCard = () => locate(this.page, { testId: 'stablecoin-earnings-card' }, portfolioConnectedContract);

  /** Tabs render in multiple synced sections — target the first chip group. */
  tabSupplied = () =>
    locate(this.page, { testId: 'portfolio-tab-supplied' }, portfolioConnectedContract).first();

  tabIdle = () => locate(this.page, { testId: 'portfolio-tab-idle' }, portfolioConnectedContract).first();

  positionsSection = () => locate(this.page, { testId: 'portfolio-positions' }, portfolioConnectedContract);

  idleTable = () => locate(this.page, { testId: 'idle-stablecoins-table' }, portfolioConnectedContract);

  maturedPendleCard = () =>
    locate(this.page, { testId: 'pendle-matured-position-card' }, portfolioPendleMaturedContract);

  maturedPendleBadge = () =>
    locate(this.page, { testId: 'pendle-matured-badge' }, portfolioPendleMaturedContract);

  maturedPendleRedeemButton = () =>
    locate(this.page, { testId: 'pendle-matured-redeem-button' }, portfolioPendleMaturedContract);

  async expectDisconnectedShell() {
    await expect(this.root()).toBeVisible({ timeout: 15_000 });
    await expect(this.connectButton()).toBeVisible();
    await expect(this.statistics()).toBeVisible();
  }

  async expectConnectedShell() {
    await expect(this.root()).toBeVisible({ timeout: 15_000 });
    await expect(this.earningsCard()).toBeVisible({ timeout: 30_000 });
  }

  async switchToIdleTab() {
    await this.tabIdle().click();
    await expect(this.tabIdle()).toHaveAttribute('aria-pressed', 'true');
  }

  repairContext(contractId: 'portfolio-disconnected' | 'portfolio-connected') {
    const map = {
      'portfolio-disconnected': portfolioDisconnectedContract,
      'portfolio-connected': portfolioConnectedContract
    } as const;
    return formatContractContext(map[contractId]);
  }
}
