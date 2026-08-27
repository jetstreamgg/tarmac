import { expect, type Page } from '@playwright/test';
import { earnMarketplaceDefaultContract } from '../contracts/earn-marketplace-default.contract';
import { earnMarketplaceDrilldownContract } from '../contracts/earn-marketplace-drilldown.contract';
import { earnMarketplaceFilterContract } from '../contracts/earn-marketplace-filter.contract';
import { formatContractContext, locate } from './locate';

/** Semantic page object for /earn marketplace (Gate 4). */
export class EarnMarketplacePage {
  constructor(private readonly page: Page) {}

  async goto(search = '') {
    await this.page.goto(`/earn${search ? `?${search}` : ''}`);
  }

  opportunities = () =>
    locate(this.page, { testId: 'earn-opportunities' }, earnMarketplaceDefaultContract);

  featuredCards = () =>
    locate(this.page, { testId: 'earn-featured-cards' }, earnMarketplaceDefaultContract);

  opportunitiesTable = () =>
    locate(this.page, { testId: 'earn-opportunities-table' }, earnMarketplaceDefaultContract);

  clearFilters = () =>
    locate(this.page, { testId: 'earn-clear-filters' }, earnMarketplaceFilterContract);

  row = (id: string) =>
    locate(this.page, { testId: `earn-row-${id}` }, earnMarketplaceDrilldownContract);

  async expectDefaultShell() {
    await expect(this.opportunities()).toBeVisible({ timeout: 30_000 });
    await expect(this.featuredCards()).toBeVisible();
    await expect(this.opportunitiesTable()).toBeVisible();
  }

  async expectTokenFilterActive() {
    await expect(this.opportunities()).toBeVisible({ timeout: 30_000 });
    await expect(this.clearFilters()).toBeVisible();
    await expect(this.clearFilters()).toContainText(/\(\d+\)/);
  }

  repairContext(
    contractId: 'earn-marketplace-default' | 'earn-marketplace-filter' | 'earn-marketplace-drilldown'
  ) {
    const map = {
      'earn-marketplace-default': earnMarketplaceDefaultContract,
      'earn-marketplace-filter': earnMarketplaceFilterContract,
      'earn-marketplace-drilldown': earnMarketplaceDrilldownContract
    } as const;
    return formatContractContext(map[contractId]);
  }
}
