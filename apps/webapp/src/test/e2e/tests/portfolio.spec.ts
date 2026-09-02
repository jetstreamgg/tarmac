import { expect, test } from '../fixtures-parallel';
import { portfolioConnectedContract } from '../contracts/portfolio-connected.contract';
import { portfolioDisconnectedContract } from '../contracts/portfolio-disconnected.contract';
import { portfolioPendleMaturedContract } from '../contracts/portfolio-pendle-matured.contract';
import { PortfolioPage } from '../pages/PortfolioPage';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms';
import { stageMaturedPtSusdsPosition } from '../utils/pendleOnChain';

/**
 * Portfolio destination smoke suite (V2).
 * Contracts: portfolio-disconnected, portfolio-connected, portfolio-network-filter,
 * portfolio-pendle-matured
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

test.describe('Portfolio — matured Pendle', () => {
  test('matured PT-sUSDS renders in Supplied carousel with Claim CTA', async ({
    isolatedPage,
    testAccount
  }) => {
    await stageMaturedPtSusdsPosition(isolatedPage, testAccount);

    const portfolio = new PortfolioPage(isolatedPage);
    await portfolio.goto();
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
    await portfolio.expectConnectedShell();

    await expect(portfolio.maturedPendleCard()).toBeVisible({ timeout: 30_000 });
    await expect(portfolio.maturedPendleBadge()).toContainText('Matured');
    await expect(portfolio.maturedPendleRedeemButton()).toBeVisible();
    // Claim stays disabled until the Pendle convert quote API resolves (same vnet
    // limit as the buy fixme) — this spec covers the matured card read surface.
    expect(portfolioPendleMaturedContract.id).toBe('portfolio-pendle-matured');
  });
});
