import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PendleMarketConfig } from '@/hooks/pendle/pendle';

i18n.load('en', {});
i18n.activate('en');

const MARKET: PendleMarketConfig = {
  name: 'PT-USDG',
  slug: 'pt-usdg',
  marketAddress: '0xc5b32dba5f29f8395fb9591e1a15f23a75214f33',
  ptToken: '0x9db38D74a0D29380899aD354121DfB521aDb0548',
  ytToken: '0x4a1294749A70bc32A998B49dd11Bf26E9379e3C1',
  syToken: '0xc1799CaB1F201946f7CFaFBaF1BCC089b2F08927',
  underlyingToken: '0xe343167631d89B6Ffc58B88d6b7fB0228795491D',
  underlyingSymbol: 'USDG',
  underlyingDecimals: 6,
  expiry: 1795651200 // 26 Nov 2026
};

// Mutable API stats — tests drive loading/loaded branches.
const h = vi.hoisted(() => ({
  stats: undefined as
    | Record<
        string,
        { impliedApy: number; underlyingApy?: number; tvl?: number; liquidity?: number; expirySec?: number }
      >
    | undefined
}));

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return { ...actual, useChains: () => [{ id: 1 }], useChainId: () => 1 };
});

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    usePendleMarketsApiData: () => ({
      data: h.stats,
      isLoading: false,
      error: undefined,
      mutate: () => undefined,
      dataSources: []
    }),
    productNetworks: () => [1]
  };
});

// TanStack Router <Link> needs a router context — swap AppLink for a plain anchor.
vi.mock('@/lib/navigation', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/navigation')>();
  return { ...actual, AppLink: ({ children }: { children: React.ReactNode }) => <a>{children}</a> };
});

// Leaf slots are stubbed — slot wiring is the unit under test, not their internals.
vi.mock('../PendleDetailChart', () => ({
  PendleDetailChart: () => <div data-testid="mock-chart" />
}));
vi.mock('../PendlePositionCard', () => ({
  PendlePositionCard: ({ market }: { market: { slug: string } }) => (
    <div data-testid="mock-position" data-market-slug={market.slug} />
  )
}));
vi.mock('../PendleTransactionsTable', () => ({
  PendleTransactionsTable: () => <div data-testid="mock-tx-table" />
}));
vi.mock('@/modules/ui/components/ChainModal', () => ({ ChainModal: () => <div /> }));
vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

import { PendleProductDetail } from '../PendleProductDetail';

const renderDetail = () =>
  render(
    <I18nProvider i18n={i18n}>
      <PendleProductDetail market={MARKET} />
    </I18nProvider>
  );

describe('PendleProductDetail', () => {
  afterEach(() => {
    cleanup();
    h.stats = undefined;
  });

  it('renders the market name as the page title with its maturity date', () => {
    renderDetail();

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).toContain('PT-USDG');
    // Maturity subtitle in the header (26 Nov 2026).
    expect(heading.textContent).toMatch(/2026/);
  });

  it('surfaces the market stats in the Details grid', () => {
    h.stats = {
      [MARKET.marketAddress]: {
        impliedApy: 0.0486,
        underlyingApy: 0.0365,
        tvl: 1_650_000_000,
        liquidity: 1_947_757
      }
    };
    renderDetail();

    const details = screen.getByTestId('product-detail-details');
    expect(details.textContent).toContain('4.86%'); // Fixed APY
    expect(details.textContent).toContain('3.65%'); // Underlying APY
    expect(details.textContent).toContain('$1,650,000,000'); // TVL, full figure like the vault detail
    expect(details.textContent).toContain('$1,947,757'); // Liquidity
    expect(details.textContent).toMatch(/2026/); // Maturity date
    expect(screen.getByRole('img', { name: 'moderate' })).toBeTruthy(); // Risk meter
  });

  it('renders placeholders when the markets API has not loaded', () => {
    renderDetail();

    const details = screen.getByTestId('product-detail-details');
    expect(details.textContent).toContain('–');
  });

  it('renders the maturity progress section', () => {
    renderDetail();

    const section = screen.getByTestId('product-detail-after-details');
    expect(section.querySelector('[role="progressbar"]')).not.toBeNull();
    expect(section.textContent).toMatch(/2026/); // maturity date label
  });

  it('renders the About intro with a worked example from the live rate', () => {
    h.stats = { [MARKET.marketAddress]: { impliedApy: 0.0486 } };
    renderDetail();

    const about = screen.getByTestId('product-detail-about');
    expect(about.textContent).toContain('Lock in a fixed yield on your USDG');
    // Worked example: 100 USDG compounded at 4.86% over the remaining term.
    expect(about.textContent).toMatch(/e\.g\. supply 100 USDG and withdraw [\d.]+ USDG in \d+ days \(4\.86%/);
    expect(screen.getByRole('link', { name: 'Pendle site' }).getAttribute('href')).toBe(
      'https://pendle.finance/'
    );
    expect(
      screen.getByRole('link', { name: 'Learn more in the User Risk Documentation.' }).getAttribute('href')
    ).toBe('https://docs.sky.money/user-risks');
  });

  it('says "one day" rather than "1 days" on the last full day', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    h.stats = { [MARKET.marketAddress]: { impliedApy: 0.0486, expirySec: nowSec + 1.5 * 86_400 } };
    renderDetail();

    const about = screen.getByTestId('product-detail-about');
    expect(about.textContent).toMatch(/e\.g\. supply 100 USDG and withdraw [\d.]+ USDG in one day \(4\.86%/);
    expect(about.textContent).not.toContain('1 days');
  });

  it('drops the worked example inside the last day, where it would claim no yield', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    h.stats = { [MARKET.marketAddress]: { impliedApy: 0.0486, expirySec: nowSec + 0.5 * 86_400 } };
    renderDetail();

    const about = screen.getByTestId('product-detail-about');
    expect(about.textContent).toContain('Lock in a fixed yield on your USDG');
    expect(about.textContent).not.toContain('e.g. supply 100 USDG');
    expect(about.textContent).not.toContain('0 days');
  });

  it('omits the worked example until the markets API loads', () => {
    renderDetail();

    const about = screen.getByTestId('product-detail-about');
    expect(about.textContent).toContain('Lock in a fixed yield on your USDG');
    expect(about.textContent).not.toContain('Supply 100');
  });

  it('renders the three About accordion rows with their copy collapsed', () => {
    renderDetail();

    const faq = screen.getByTestId('pendle-detail-faq');
    expect(faq.textContent).toContain('Fixed vs. variable');
    expect(faq.textContent).toContain('Withdrawing');
    expect(faq.textContent).toContain('APY');
    // Bodies are collapsed by default.
    expect(faq.textContent).not.toContain('variable yield that moves with the market');
  });

  it('mounts the chart, position and transactions slots', () => {
    renderDetail();

    expect(screen.getByTestId('mock-chart')).toBeTruthy();
    expect(screen.getByTestId('mock-position').getAttribute('data-market-slug')).toBe('pt-usdg');
    expect(screen.getByTestId('mock-tx-table')).toBeTruthy();
  });
});
