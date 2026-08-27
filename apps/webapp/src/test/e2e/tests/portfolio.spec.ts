import { expect, test } from '../fixtures-parallel';
import { portfolioConnectedContract } from '../contracts/portfolio-connected.contract';
import { portfolioDisconnectedContract } from '../contracts/portfolio-disconnected.contract';
import { PortfolioPage } from '../pages/PortfolioPage';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms';

/**
 * Portfolio destination smoke suite (V2).
 * Contracts: portfolio-disconnected, portfolio-connected, portfolio-network-filter
 */
test.describe('Portfolio — disconnected', () => {
  test('smoke: shell renders connect prompt and statistics', async ({ isolatedPage }) => {
    const portfolio = new PortfolioPage(isolatedPage);
    await portfolio.goto();
    await portfolio.expectDisconnectedShell();
    expect(portfolioDisconnectedContract.id).toBe('portfolio-disconnected');
  });
});

test.describe('Portfolio — connected', () => {
  test.beforeEach(async ({ isolatedPage }) => {
    await isolatedPage.goto('/portfolio');
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
  });

  test('smoke: shell renders earnings card and network filter', async ({ isolatedPage }) => {
    const portfolio = new PortfolioPage(isolatedPage);
    await portfolio.expectConnectedShell();
    expect(portfolioConnectedContract.id).toBe('portfolio-connected');
  });

  test('smoke: Supplied/Idle tab toggle', async ({ isolatedPage }) => {
    const portfolio = new PortfolioPage(isolatedPage);
    await expect(portfolio.earningsCard()).toBeVisible({ timeout: 30_000 });

    await portfolio.switchToIdleTab();
    // Idle tab shows the idle stablecoins table when the wallet has idle balances,
    // or an empty state — either way the positions section reflects the tab.
    await expect(portfolio.tabIdle()).toHaveAttribute('aria-pressed', 'true');

    await portfolio.tabSupplied().click();
    await expect(portfolio.tabSupplied()).toHaveAttribute('aria-pressed', 'true');
  });
});
