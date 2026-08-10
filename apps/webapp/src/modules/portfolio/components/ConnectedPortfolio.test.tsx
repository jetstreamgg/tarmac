import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectedPortfolio } from './ConnectedPortfolio';
import {
  PORTFOLIO_DECISION_TTL_MS,
  readPortfolioDecision,
  writePortfolioDecision
} from '@/lib/portfolioDecisionCache';

const ADDRESS_A = '0x00000000000000000000000000000000000000aa';
const ADDRESS_B = '0x00000000000000000000000000000000000000bb';

// Mutable holders driving every data source; tests flip them and rerender.
// The row carries the full shape buildSuppliedView consumes.
const h = vi.hoisted(() => {
  const supplyRow = (totalUsd: number) => ({
    id: 'savings',
    name: 'Sky Savings Rate',
    tokenSymbol: 'USDS',
    kind: 'savings',
    intent: 'SAVINGS_INTENT',
    address: undefined as string | undefined,
    rate: { value: 0.045 },
    detailPath: '/earn/savings',
    supplyTokens: ['USDS'],
    position: { totalUsd, byChain: { 1: totalUsd } }
  });
  return {
    supplyRow,
    address: '0x00000000000000000000000000000000000000aa' as string,
    marketplace: { rows: [] as ReturnType<typeof supplyRow>[], isLoading: true },
    balances: { balances: [] as { amountUsd: number }[], isLoading: true },
    skyData: { data: undefined as Record<string, string> | undefined, isLoading: true },
    geo: { savingsEnabled: true, isLoading: false }
  };
});

vi.mock('wagmi', () => ({
  useChainId: () => 1,
  useChains: () => [{ id: 1, name: 'Ethereum' }],
  useConnection: () => ({ address: h.address, isConnected: true }),
  useEnsName: () => ({ data: undefined })
}));
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn()
}));
vi.mock('@/hooks', () => ({
  useEarnMarketplace: () => h.marketplace,
  useOverallSkyData: () => ({ data: h.skyData.data, isLoading: h.skyData.isLoading })
}));
vi.mock('../hooks/useStablecoinBalances', () => ({
  useStablecoinBalances: () => h.balances
}));
vi.mock('@/modules/geo-config', () => ({
  useGeoConfig: () => ({
    isModuleEnabled: (module: string) => (module === 'savings' ? h.geo.savingsEnabled : true),
    isLoading: h.geo.isLoading
  })
}));
vi.mock('@/data/wagmi/config/chainFamily', () => ({
  getSupportedChainIds: () => [1]
}));
vi.mock('@/utils', async importOriginal => ({
  ...(await importOriginal<typeof import('@/utils')>()),
  getChainIcon: () => <span data-testid="chain-icon" />
}));
vi.mock('@/components/product/FilterSelect', () => ({
  FilterSelect: () => <div data-testid="filter-select" />
}));
vi.mock('@/modules/ui/components/TokenIconStack', () => ({
  IconStack: () => <span data-testid="icon-stack" />
}));

// The suite exercises which callout/tab the page decides on, so the sections
// reduce to markers (the earnings card keeps its tab prop for assertions).
vi.mock('./SavingsTvlCallout', () => ({
  SavingsTvlCallout: () => <div data-testid="savings-tvl-callout" />
}));
vi.mock('./AllocateStablecoinsBanner', () => ({
  AllocateStablecoinsBanner: () => <div data-testid="allocate-stablecoins-banner" />
}));
vi.mock('./StablecoinEarningsCard', () => ({
  StablecoinEarningsCard: ({ tab }: { tab: string }) => <div data-testid="earnings-card" data-tab={tab} />
}));
vi.mock('./PortfolioPositionsSection', () => ({
  PortfolioPositionsSection: () => <div data-testid="positions-section" />
}));
vi.mock('./PortfolioRewardsSections', () => ({
  PortfolioRewardsSections: () => null
}));
vi.mock('./PortfolioTransactionsSection', () => ({
  PortfolioTransactionsSection: () => null
}));
vi.mock('./PortfolioStatistics', () => ({
  PortfolioStatistics: () => <div data-testid="portfolio-statistics" />
}));
vi.mock('@/modules/pendle/components/PendleReadyToRedeemList', () => ({
  PendleReadyToRedeemList: () => null
}));

i18n.load('en', {});
i18n.activate('en');

const setLoading = () => {
  h.marketplace = { rows: [], isLoading: true };
  h.balances = { balances: [], isLoading: true };
  h.skyData = { data: undefined, isLoading: true };
  h.geo = { savingsEnabled: true, isLoading: false };
};

const setSettled = ({ depositedUsd, idleUsd }: { depositedUsd: number; idleUsd: number }) => {
  h.marketplace = { rows: depositedUsd > 0 ? [h.supplyRow(depositedUsd)] : [], isLoading: false };
  h.balances = { balances: [{ amountUsd: idleUsd }], isLoading: false };
  h.skyData = { data: { skySavingsRatecRate: '0.045', skySavingsRateTvl: '2500000000' }, isLoading: false };
  h.geo = { savingsEnabled: true, isLoading: false };
};

const renderPage = () =>
  render(
    <I18nProvider i18n={i18n}>
      <ConnectedPortfolio key={h.address} />
    </I18nProvider>
  );

beforeEach(() => {
  localStorage.clear();
  h.address = ADDRESS_A;
  setLoading();
});

afterEach(() => {
  cleanup();
});

describe('ConnectedPortfolio decision cache', () => {
  it('first visit: optimistically shows the simulate callout while loading', () => {
    renderPage();
    expect(screen.getByTestId('savings-tvl-callout')).toBeTruthy();
    expect(screen.queryByTestId('allocate-stablecoins-banner')).toBeNull();
  });

  it('writes the settled decision to the cache', () => {
    setSettled({ depositedUsd: 5000, idleUsd: 0 });
    renderPage();
    expect(screen.queryByTestId('savings-tvl-callout')).toBeNull();
    expect(screen.queryByTestId('portfolio-statistics')).toBeNull();
    expect(readPortfolioDecision(ADDRESS_A)).toMatchObject({ outcome: 'none', tab: 'supplied' });
  });

  it('renders a cached decision instantly, before anything loads', () => {
    writePortfolioDecision(ADDRESS_A, { outcome: 'allocate', tab: 'idle' });
    renderPage();
    expect(screen.getByTestId('allocate-stablecoins-banner')).toBeTruthy();
    expect(screen.queryByTestId('savings-tvl-callout')).toBeNull();
    expect(screen.getByTestId('earnings-card').getAttribute('data-tab')).toBe('idle');
    // Statistics follow the frozen outcome too.
    expect(screen.getByTestId('portfolio-statistics')).toBeTruthy();
  });

  it('never swaps the view mid-visit: settling data only rewrites the cache', () => {
    writePortfolioDecision(ADDRESS_A, { outcome: 'simulate', tab: 'idle' });
    const { rerender } = renderPage();
    expect(screen.getByTestId('savings-tvl-callout')).toBeTruthy();

    // Queries settle on a portfolio that contradicts the hint ($5k supplied).
    setSettled({ depositedUsd: 5000, idleUsd: 0 });
    rerender(
      <I18nProvider i18n={i18n}>
        <ConnectedPortfolio key={h.address} />
      </I18nProvider>
    );

    expect(screen.getByTestId('savings-tvl-callout')).toBeTruthy();
    expect(screen.getByTestId('earnings-card').getAttribute('data-tab')).toBe('idle');
    expect(readPortfolioDecision(ADDRESS_A)).toMatchObject({ outcome: 'none', tab: 'supplied' });
  });

  it('treats an expired cache entry as a first visit', () => {
    localStorage.setItem(
      `portfolioDecision:v1:${ADDRESS_A}`,
      JSON.stringify({
        outcome: 'allocate',
        tab: 'idle',
        updatedAt: Date.now() - PORTFOLIO_DECISION_TTL_MS - 1000
      })
    );
    renderPage();
    expect(screen.queryByTestId('allocate-stablecoins-banner')).toBeNull();
    expect(screen.getByTestId('savings-tvl-callout')).toBeTruthy();
  });

  it('geo restriction beats the cached outcome', () => {
    writePortfolioDecision(ADDRESS_A, { outcome: 'simulate', tab: 'idle' });
    h.geo = { savingsEnabled: false, isLoading: false };
    renderPage();
    expect(screen.queryByTestId('savings-tvl-callout')).toBeNull();
    expect(screen.queryByTestId('allocate-stablecoins-banner')).toBeNull();
  });

  it('an address switch remounts onto the next address cache', () => {
    writePortfolioDecision(ADDRESS_A, { outcome: 'allocate', tab: 'idle' });
    const { rerender } = renderPage();
    expect(screen.getByTestId('allocate-stablecoins-banner')).toBeTruthy();

    // PortfolioPage keys ConnectedPortfolio by address — simulate the switch.
    h.address = ADDRESS_B;
    setSettled({ depositedUsd: 5000, idleUsd: 0 });
    rerender(
      <I18nProvider i18n={i18n}>
        <ConnectedPortfolio key={h.address} />
      </I18nProvider>
    );

    expect(screen.queryByTestId('allocate-stablecoins-banner')).toBeNull();
    expect(screen.queryByTestId('savings-tvl-callout')).toBeNull();
    expect(readPortfolioDecision(ADDRESS_B)).toMatchObject({ outcome: 'none', tab: 'supplied' });
  });
});
