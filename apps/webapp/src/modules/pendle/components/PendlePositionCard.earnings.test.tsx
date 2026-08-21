import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

i18n.load('en', {});
i18n.activate('en');

// Mutable PT balance drives which card renders; the earnings holder hands the
// card a literal APP-450 slice (the aggregator has its own suite).
const h = vi.hoisted(() => ({ ptBalance: 0n as bigint }));
const earningsHolder = vi.hoisted(() => ({ value: undefined as unknown }));

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChainId: () => 1,
    useConnection: () => ({ address: '0x1', isConnected: true, isConnecting: false })
  };
});

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    usePendleUserPtBalances: () => ({
      data: Object.fromEntries(actual.PENDLE_MARKETS.map(m => [m.marketAddress, h.ptBalance])),
      mutate: vi.fn()
    }),
    usePendleMarketsApiData: () => ({ data: undefined }),
    useTokenBalance: () => ({ data: { value: 0n }, refetch: vi.fn() })
  };
});

vi.mock('../hooks/usePendleModal', () => ({
  usePendleModal: () => ({ openSupply: vi.fn(), openWithdraw: vi.fn() })
}));
vi.mock('@/modules/ui/context/ConnectThenActContext', () => ({
  useConnectThenAct: (fn: () => void) => fn
}));
vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));
vi.mock('@/widgets', () => ({ Pendle: () => null }));
vi.mock('@/modules/portfolio/hooks/useWalletEarnings', () => ({
  useWalletEarnings: () => earningsHolder.value
}));

import { PENDLE_MARKETS } from '@/hooks';
import { combineWalletEarnings } from '@/modules/portfolio/earnings/combineWalletEarnings';
import {
  notAvailable,
  ok,
  type ProtocolEarnings,
  type WalletEarnings
} from '@/modules/portfolio/earnings/types';
import { PendlePositionCard } from './PendlePositionCard';

const MARKET = PENDLE_MARKETS[0];

const pendleEarnings = (
  totalEarned: ProtocolEarnings['totalEarned'],
  pendleSplit?: ProtocolEarnings['pendleSplit']
): WalletEarnings => {
  const protocols: ProtocolEarnings[] = [
    {
      id: 'pendle',
      rowIds: [`fixed-${MARKET.marketAddress.toLowerCase()}`],
      totalEarned,
      earnedThisMonth: totalEarned,
      ...(pendleSplit ? { pendleSplit } : {}),
      isLoading: false,
      error: null
    }
  ];
  return {
    protocols,
    combined: combineWalletEarnings(protocols),
    isLoading: false,
    window: { startSec: 0, endSec: 0 }
  };
};

const renderCard = () =>
  render(
    <I18nProvider i18n={i18n}>
      <PendlePositionCard market={MARKET} />
    </I18nProvider>
  );

describe('PendlePositionCard — accrued to date (APP-450)', () => {
  beforeEach(() => {
    h.ptBalance = 100n * 10n ** 18n;
    earningsHolder.value = pendleEarnings(ok({ usd: 916.82 }), {
      realizedUsd: 895.05,
      markToMarketUsd: 21.77
    });
  });
  afterEach(() => cleanup());

  it('renders the accrued-to-date figure with the realized/mark-to-market split', () => {
    renderCard();

    const stat = screen.getByTestId('pendle-accrued-to-date');
    expect(stat.textContent).toContain('$916.82');
    expect(screen.getByTestId('earnings-pendle-split')).toBeTruthy();
  });

  it('renders a self-explaining dash when the Pendle figure is unavailable', () => {
    earningsHolder.value = pendleEarnings(notAvailable('source-error'));
    renderCard();

    expect(screen.getByTestId('pendle-accrued-to-date').textContent).toBe('—');
  });
});
