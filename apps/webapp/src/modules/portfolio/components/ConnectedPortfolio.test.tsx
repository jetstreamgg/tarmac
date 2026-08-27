import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
    marketplace: { rows: [] as ReturnType<typeof supplyRow>[], isLoading: true, isPositionsError: false },
    balances: {
      balances: [] as { symbol: string; chainId: number; amount: number; amountUsd: number }[],
      isLoading: true,
      isError: false
    },
    skyData: { data: undefined as Record<string, string> | undefined, isLoading: true },
    geo: { savingsEnabled: true, isLoading: false },
    matured: undefined as
      | { maturedPositions: { market: { marketAddress: string }; ptBalance: bigint }[]; isLoading: boolean }
      | undefined
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
  useNetworkFilter: () => ({ chainId: null, setChainId: vi.fn(), supportedChainIds: [1, 8453] }),
  useEarnMarketplace: () => h.marketplace,
  useOverallSkyData: () => ({ data: h.skyData.data, isLoading: h.skyData.isLoading }),
  isPendleChain: (id: number) => id === 1
}));
vi.mock('@/modules/pendle/hooks/usePendleMaturedPositions', () => ({
  usePendleMaturedPositions: () => h.matured ?? { maturedPositions: [], isLoading: false }
}));
vi.mock('../hooks/useStablecoinBalances', () => ({
  useStablecoinBalances: () => h.balances
}));
// APP-450: the earnings aggregator fires real queries (needs a QueryClient);
// this suite only exercises the decision plumbing, so stub it inert.
vi.mock('../hooks/useWalletEarnings', () => ({
  useWalletEarnings: () => ({
    protocols: [],
    combined: { totalEarnedUsd: 0, earnedThisMonthUsd: 0, missingFromTotal: [], missingFromMonth: [] },
    isLoading: true,
    window: { startSec: 0, endSec: 0 }
  })
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
// reduce to markers (the earnings card keeps its tab wiring and the banner its
// idleUsd prop, for assertions on the decision plumbing).
vi.mock('./SavingsTvlCallout', () => ({
  SavingsTvlCallout: () => <div data-testid="savings-tvl-callout" />
}));
vi.mock('./AllocateStablecoinsBanner', () => ({
  AllocateStablecoinsBanner: ({ idleUsd }: { idleUsd: number | undefined }) => (
    <div
      data-testid="allocate-stablecoins-banner"
      data-idle-usd={idleUsd === undefined ? 'loading' : String(idleUsd)}
    />
  )
}));
vi.mock('./StablecoinEarningsCard', () => ({
  StablecoinEarningsCard: ({ tab, onTabChange }: { tab: string; onTabChange: (tab: string) => void }) => (
    <div data-testid="earnings-card" data-tab={tab}>
      <button data-testid="pick-supplied-tab" onClick={() => onTabChange('supplied')} />
    </div>
  )
}));
vi.mock('./PortfolioPositionsSection', () => ({
  PortfolioPositionsSection: ({ tab }: { tab: string }) => (
    <div data-testid="positions-section" data-tab={tab} />
  )
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

i18n.load('en', {});
i18n.activate('en');

const setLoading = () => {
  h.marketplace = { rows: [], isLoading: true, isPositionsError: false };
  h.balances = { balances: [], isLoading: true, isError: false };
  h.skyData = { data: undefined, isLoading: true };
  h.geo = { savingsEnabled: true, isLoading: false };
};

const setSettled = ({ depositedUsd, idleUsd }: { depositedUsd: number; idleUsd: number }) => {
  h.marketplace = {
    rows: depositedUsd > 0 ? [h.supplyRow(depositedUsd)] : [],
    isLoading: false,
    isPositionsError: false
  };
  h.balances = {
    balances: idleUsd > 0 ? [{ symbol: 'USDS', chainId: 1, amount: idleUsd, amountUsd: idleUsd }] : [],
    isLoading: false,
    isError: false
  };
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
  h.matured = undefined;
  setLoading();
});

afterEach(() => {
  cleanup();
});

describe('ConnectedPortfolio matured-position tab default', () => {
  it('defaults to Supplied when the only holding is matured PT (zero deposited USD)', () => {
    // Matured markets are filtered out of the marketplace rows, so this wallet
    // computes depositedUsd = 0 — but its Claim card renders only on Supplied.
    setSettled({ depositedUsd: 0, idleUsd: 0 });
    h.matured = {
      maturedPositions: [{ market: { marketAddress: '0x9c56' }, ptBalance: 1n }],
      isLoading: false
    };
    renderPage();
    expect(screen.getByTestId('positions-section').getAttribute('data-tab')).toBe('supplied');
    expect(readPortfolioDecision(ADDRESS_A)).toMatchObject({ tab: 'supplied' });
  });

  it('matured PT overrides a cached idle decision from before maturity', () => {
    writePortfolioDecision(ADDRESS_A, { outcome: 'none', tab: 'idle' });
    h.matured = {
      maturedPositions: [{ market: { marketAddress: '0x9c56' }, ptBalance: 1n }],
      isLoading: false
    };
    renderPage();
    expect(screen.getByTestId('positions-section').getAttribute('data-tab')).toBe('supplied');
  });
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

  it('never persists a decision computed from a failed source', () => {
    // Errors settle as empty data — indistinguishable from an empty wallet,
    // so writing it would freeze a wrong outcome for the whole TTL.
    setSettled({ depositedUsd: 0, idleUsd: 0 });
    h.marketplace = { rows: [], isLoading: false, isPositionsError: true };
    renderPage();
    expect(readPortfolioDecision(ADDRESS_A)).toBeNull();
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

  it('a cached allocate waits for the module config before painting the banner', () => {
    // The cached fast-path must not ride the optimistic default: a user
    // without the savings module would see the promo flash until the config
    // lands and pulls it.
    writePortfolioDecision(ADDRESS_A, { outcome: 'allocate', tab: 'idle' });
    h.geo = { savingsEnabled: true, isLoading: true };
    renderPage();
    expect(screen.queryByTestId('allocate-stablecoins-banner')).toBeNull();
  });

  it('a cached allocate never paints the banner when savings is unavailable', () => {
    writePortfolioDecision(ADDRESS_A, { outcome: 'allocate', tab: 'idle' });
    h.geo = { savingsEnabled: false, isLoading: false };
    renderPage();
    expect(screen.queryByTestId('allocate-stablecoins-banner')).toBeNull();
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
    const rewritten = readPortfolioDecision(ADDRESS_A);
    expect(rewritten).toMatchObject({ outcome: 'none', tab: 'supplied' });
    // The rewrite restarts the TTL clock too.
    expect(rewritten!.updatedAt).toBeGreaterThanOrEqual(Date.now() - 5000);
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

  it('renders a cached `none` instantly: no callouts, no statistics', () => {
    writePortfolioDecision(ADDRESS_A, { outcome: 'none', tab: 'supplied' });
    renderPage();
    expect(screen.queryByTestId('savings-tvl-callout')).toBeNull();
    expect(screen.queryByTestId('allocate-stablecoins-banner')).toBeNull();
    expect(screen.queryByTestId('portfolio-statistics')).toBeNull();
    expect(screen.getByTestId('earnings-card').getAttribute('data-tab')).toBe('supplied');
  });

  it('settling on idle stablecoins writes `allocate` and shows the banner', () => {
    setSettled({ depositedUsd: 0, idleUsd: 5000 });
    renderPage();
    expect(screen.getByTestId('allocate-stablecoins-banner')).toBeTruthy();
    expect(screen.queryByTestId('savings-tvl-callout')).toBeNull();
    expect(screen.getByTestId('portfolio-statistics')).toBeTruthy();
    expect(readPortfolioDecision(ADDRESS_A)).toMatchObject({ outcome: 'allocate', tab: 'idle' });
  });

  it('settling on an empty wallet writes `simulate` and keeps the callout', () => {
    setSettled({ depositedUsd: 0, idleUsd: 0 });
    renderPage();
    expect(screen.getByTestId('savings-tvl-callout')).toBeTruthy();
    expect(screen.getByTestId('portfolio-statistics')).toBeTruthy();
    expect(readPortfolioDecision(ADDRESS_A)).toMatchObject({ outcome: 'simulate', tab: 'idle' });
  });

  it('does not write the cache until every source has settled', () => {
    setSettled({ depositedUsd: 5000, idleUsd: 0 });
    h.balances = { balances: [], isLoading: true, isError: false };
    renderPage();
    expect(readPortfolioDecision(ADDRESS_A)).toBeNull();
  });

  it('a manual tab pick beats the cached default', () => {
    writePortfolioDecision(ADDRESS_A, { outcome: 'allocate', tab: 'idle' });
    renderPage();
    expect(screen.getByTestId('earnings-card').getAttribute('data-tab')).toBe('idle');
    fireEvent.click(screen.getByTestId('pick-supplied-tab'));
    expect(screen.getByTestId('earnings-card').getAttribute('data-tab')).toBe('supplied');
  });

  it('holds a cached callout until the module config settles', () => {
    // Formerly the cached callout painted through the config load on the
    // optimistic default; that flashed the promo for users without the
    // savings module, so cached promos now wait for the settled config.
    writePortfolioDecision(ADDRESS_A, { outcome: 'simulate', tab: 'idle' });
    h.geo = { savingsEnabled: true, isLoading: true };
    renderPage();
    expect(screen.queryByTestId('savings-tvl-callout')).toBeNull();
  });

  it('chips the cached allocate banner while figures load, then fills it in', () => {
    writePortfolioDecision(ADDRESS_A, { outcome: 'allocate', tab: 'idle' });
    const { rerender } = renderPage();
    expect(screen.getByTestId('allocate-stablecoins-banner').getAttribute('data-idle-usd')).toBe('loading');

    setSettled({ depositedUsd: 0, idleUsd: 5000 });
    rerender(
      <I18nProvider i18n={i18n}>
        <ConnectedPortfolio key={h.address} />
      </I18nProvider>
    );
    // Figures may land mid-view — only the outcome is frozen.
    expect(screen.getByTestId('allocate-stablecoins-banner').getAttribute('data-idle-usd')).toBe('5000');
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
