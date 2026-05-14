/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { PENDLE_MARKETS, PendleHistoryAction } from './constants';
import type { PendlePnlTransactionRaw, PendleTransactionRaw } from './pendle';

vi.mock('wagmi', () => ({
  useConnection: vi.fn()
}));

vi.mock('./pendleApiClient', () => ({
  fetchPendleMarketTransactions: vi.fn(),
  fetchPendlePnlTransactions: vi.fn()
}));

import { useConnection } from 'wagmi';
import { fetchPendleMarketTransactions, fetchPendlePnlTransactions } from './pendleApiClient';
import { useAllPendleMarketsHistory } from './useAllPendleMarketsHistory';

const USER = '0x1111111111111111111111111111111111111111' as const;

// Hash builders that vary by market and kind so dedupe behaves naturally.
const hashFor = (i: number, kind: string) =>
  `0xaaaa${i.toString(16).padStart(4, '0')}${kind.padEnd(56, '0')}` as `0x${string}`;

function makeTrade(
  marketAddress: `0x${string}`,
  action: PendleHistoryAction.BUY_PT | PendleHistoryAction.SELL_PT,
  txHash: `0x${string}`,
  timestamp: string,
  pt: number,
  value: number,
  id: string
): PendleTransactionRaw {
  return {
    id,
    market: marketAddress,
    timestamp,
    chainId: 1,
    txHash,
    value,
    type: 'TRADES',
    action,
    txOrigin: USER,
    impliedApy: 0,
    notional: { pt }
  };
}

function makeRedeem(
  marketAddress: `0x${string}`,
  txHash: `0x${string}`,
  timestamp: string,
  ptUnit: number
): PendlePnlTransactionRaw {
  return {
    timestamp,
    action: 'redeemPy',
    market: `1-${marketAddress}`,
    txHash,
    ptData: { unit: ptUnit }
  };
}

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('useAllPendleMarketsHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useConnection).mockReturnValue({ address: USER } as unknown as ReturnType<
      typeof useConnection
    >);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('merges rows across every market and tags each with its source market', async () => {
    // The mocks use mockImplementation so the per-market fan-out (one call per
    // market) gets a distinct response. Reading from a Map by marketAddress
    // makes the test agnostic to call order.
    const tradesByMarket = new Map<string, PendleTransactionRaw[]>();
    const redeemsByMarket = new Map<string, PendlePnlTransactionRaw[]>();
    PENDLE_MARKETS.forEach((market, i) => {
      tradesByMarket.set(market.marketAddress.toLowerCase(), [
        makeTrade(
          market.marketAddress,
          PendleHistoryAction.BUY_PT,
          hashFor(i, 'buy'),
          `2026-0${i + 1}-15T00:00:00Z`,
          100 * (i + 1),
          100 * (i + 1),
          `${market.name}-buy`
        )
      ]);
      redeemsByMarket.set(market.marketAddress.toLowerCase(), [
        makeRedeem(market.marketAddress, hashFor(i, 'red'), `2026-0${i + 1}-20T00:00:00Z`, 50 * (i + 1))
      ]);
    });

    vi.mocked(fetchPendleMarketTransactions).mockImplementation(async (_chain, addr) => {
      return tradesByMarket.get(addr.toLowerCase()) ?? [];
    });
    vi.mocked(fetchPendlePnlTransactions).mockImplementation(async (_chain, addr) => {
      return redeemsByMarket.get(addr.toLowerCase()) ?? [];
    });

    const { result } = renderHook(() => useAllPendleMarketsHistory(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.data).toBeDefined());

    // 1 buy + 1 redeem per market.
    expect(result.current.data).toHaveLength(PENDLE_MARKETS.length * 2);
    // Each row is tagged with the market it came from.
    for (const row of result.current.data ?? []) {
      const inMarket = PENDLE_MARKETS.find(m => m.marketAddress === row.market.marketAddress);
      expect(inMarket).toBeDefined();
    }
    // Sorted desc — first row should be the latest timestamp across all markets.
    const timestamps = result.current.data!.map(r => new Date(r.timestamp).valueOf());
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i - 1]).toBeGreaterThanOrEqual(timestamps[i]);
    }
  });

  it('keeps surviving markets when one market 5xxs (does not poison the rest)', async () => {
    const surviving = PENDLE_MARKETS[0];
    const failing = PENDLE_MARKETS[1];

    vi.mocked(fetchPendleMarketTransactions).mockImplementation(async (_chain, addr) => {
      if (addr.toLowerCase() === failing.marketAddress.toLowerCase()) {
        throw new Error('500');
      }
      return [
        makeTrade(addr, PendleHistoryAction.BUY_PT, hashFor(0, 'buy'), '2026-03-01T00:00:00Z', 100, 100, 'ok')
      ];
    });
    vi.mocked(fetchPendlePnlTransactions).mockResolvedValue([]);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() => useAllPendleMarketsHistory(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.data).toBeDefined());

    // The surviving market(s) yield rows; the failing one drops silently.
    expect(result.current.data!.length).toBeGreaterThan(0);
    expect(result.current.data!.every(r => r.market.marketAddress !== failing.marketAddress)).toBe(true);
    expect(result.current.data!.some(r => r.market.marketAddress === surviving.marketAddress)).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('throws when every market fails (real outage; show the error)', async () => {
    vi.mocked(fetchPendleMarketTransactions).mockRejectedValue(new Error('500'));
    vi.mocked(fetchPendlePnlTransactions).mockResolvedValue([]);
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() => useAllPendleMarketsHistory(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.data).toBeUndefined();
  });

  it('is disabled (no fetch) when no wallet is connected', async () => {
    vi.mocked(useConnection).mockReturnValue({ address: undefined } as unknown as ReturnType<
      typeof useConnection
    >);

    renderHook(() => useAllPendleMarketsHistory(), { wrapper: makeWrapper() });

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(fetchPendleMarketTransactions).not.toHaveBeenCalled();
    expect(fetchPendlePnlTransactions).not.toHaveBeenCalled();
  });
});
