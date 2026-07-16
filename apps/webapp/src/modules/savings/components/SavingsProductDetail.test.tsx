import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

i18n.load('en', {});
i18n.activate('en');

// Mutable savings balance — drives the position-aware branch. isMobile drives
// the M6.3 breakpoint branch (happy-dom's 1024px default always lands desktop).
const h = vi.hoisted(() => ({ savingsBalance: 0n as bigint, isMobile: false }));

vi.mock('@/hooks/ui/useBreakpoint', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks/ui/useBreakpoint')>();
  return {
    ...actual,
    useBreakpointIndex: () => ({ bpi: h.isMobile ? actual.BP.sm : actual.BP.desktop })
  };
});

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return { ...actual, useChains: () => [{ id: 1 }], useChainId: () => 1 };
});

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useSavingsData: () => ({ data: { userSavingsBalance: h.savingsBalance }, error: null, isLoading: false }),
    useOverallSkyData: () => ({ data: undefined }),
    useSkySavingsRateHistoricData: () => ({ data: undefined }),
    productNetworks: () => [1]
  };
});

// TanStack Router <Link> needs a router context — swap AppLink for a plain anchor.
vi.mock('@/lib/navigation', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/navigation')>();
  return { ...actual, AppLink: ({ children }: { children: React.ReactNode }) => <a>{children}</a> };
});

// Leaf slots are stubbed — routing is the unit under test, not their internals.
vi.mock('./SavingsDetailChart', () => ({ SavingsDetailChart: () => <div data-testid="mock-chart" /> }));
vi.mock('./SavingsPositionCard', () => ({ SavingsPositionCard: () => <div data-testid="mock-position" /> }));
vi.mock('./SavingsTransactionsTable', () => ({
  SavingsTransactionsTable: ({ filter }: { filter?: string }) => (
    <div data-testid="mock-tx-table" data-filter={filter ?? 'all'} />
  )
}));
vi.mock('./SavingsTransactionsFilter', () => ({
  SavingsTransactionsFilter: () => <div data-testid="savings-transactions-filter" />
}));
vi.mock('@/modules/ui/components/ChainModal', () => ({
  ChainModal: ({ triggerClassName }: { triggerClassName?: string }) => (
    <div data-testid="mock-chain-modal" data-trigger-class={triggerClassName ?? ''} />
  )
}));
vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

import { SavingsProductDetail } from './SavingsProductDetail';

const renderDetail = () =>
  render(
    <I18nProvider i18n={i18n}>
      <SavingsProductDetail />
    </I18nProvider>
  );

describe('SavingsProductDetail — position-aware transactions filter', () => {
  afterEach(() => {
    cleanup();
    h.savingsBalance = 0n;
    h.isMobile = false;
  });

  it('omits the transactions filter when the user has no position', () => {
    h.savingsBalance = 0n;
    renderDetail();

    expect(screen.queryByTestId('savings-transactions-filter')).toBeNull();
    // No-position list stays unfiltered.
    expect(screen.getByTestId('mock-tx-table').getAttribute('data-filter')).toBe('all');
  });

  it('shows the transactions filter when the user has a position', () => {
    h.savingsBalance = 1n;
    renderDetail();

    expect(screen.getByTestId('savings-transactions-filter')).toBeTruthy();
    // Defaults to the full list until a filter is picked.
    expect(screen.getByTestId('mock-tx-table').getAttribute('data-filter')).toBe('all');
  });

  // M6.3 (486:20732): on mobile the network selector is a single full-width
  // labelled row under the title instead of the right-aligned icon-only pill.
  it('renders one full-width network selector on mobile', () => {
    h.isMobile = true;
    renderDetail();

    const chainModal = screen.getByTestId('mock-chain-modal');
    expect(chainModal.getAttribute('data-trigger-class')).toContain('w-full');
  });

  it('keeps the compact header network pill on desktop', () => {
    h.isMobile = false;
    renderDetail();

    const chainModal = screen.getByTestId('mock-chain-modal');
    expect(chainModal.getAttribute('data-trigger-class') || '').not.toContain('w-full');
  });

  // M6.3: the mobile comp (486:20706) shows the "All transactions" select even
  // on the no-position page; only desktop keeps the has-position gating.
  it('shows the transactions filter on mobile even without a position', () => {
    h.savingsBalance = 0n;
    h.isMobile = true;
    renderDetail();

    expect(screen.getByTestId('savings-transactions-filter')).toBeTruthy();
    expect(screen.getByTestId('mock-tx-table').getAttribute('data-filter')).toBe('all');
  });
});
