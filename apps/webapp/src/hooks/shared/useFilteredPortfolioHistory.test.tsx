/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { ModuleEnum } from '../constants';
import { chainId as chainIdMap, TRADE_CUTOFF_DATES } from '@/utils';
import type { CombinedHistoryItem } from './shared';

vi.mock('wagmi', () => ({ useChainId: vi.fn() }));
vi.mock('./useAllNetworksCombinedHistory', () => ({ useAllNetworksCombinedHistory: vi.fn() }));
vi.mock('./useEthereumCombinedHistory', () => ({ useEthereumCombinedHistory: vi.fn() }));
vi.mock('./useL2CombinedHistory', () => ({ useL2CombinedHistory: vi.fn() }));
vi.mock('./useHistoryFamilyQuery', () => ({ useHistoryFamilyQuery: vi.fn() }));
vi.mock('../trade/useCowswapTradeHistory', () => ({ useCowswapTradeHistory: vi.fn() }));
vi.mock('../morpho', () => ({ useMorphoVaultHistory: vi.fn() }));
vi.mock('../pendle/usePendleCombinedHistory', () => ({ usePendleCombinedHistory: vi.fn() }));

import { useChainId } from 'wagmi';
import { useAllNetworksCombinedHistory } from './useAllNetworksCombinedHistory';
import { useEthereumCombinedHistory } from './useEthereumCombinedHistory';
import { useL2CombinedHistory } from './useL2CombinedHistory';
import { useHistoryFamilyQuery } from './useHistoryFamilyQuery';
import { useCowswapTradeHistory } from '../trade/useCowswapTradeHistory';
import { useMorphoVaultHistory } from '../morpho';
import { usePendleCombinedHistory } from '../pendle/usePendleCombinedHistory';
import { useFilteredPortfolioHistory } from './useFilteredPortfolioHistory';

const item = (timestampSeconds: number, transactionHash: string) =>
  ({ blockTimestamp: new Date(timestampSeconds * 1000), transactionHash }) as CombinedHistoryItem;

const source = (overrides: Record<string, unknown> = {}) => ({
  data: [] as CombinedHistoryItem[],
  isLoading: false,
  error: null,
  mutate: vi.fn(),
  nextCursor: undefined as number | undefined,
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: vi.fn(),
  ...overrides
});

describe('useFilteredPortfolioHistory — source selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useChainId).mockReturnValue(1);
    vi.mocked(useAllNetworksCombinedHistory).mockReturnValue(
      source({ data: [item(1, '0xaggregate')] }) as any
    );
    vi.mocked(useEthereumCombinedHistory).mockReturnValue(source({ data: [item(1, '0xeth')] }) as any);
    vi.mocked(useL2CombinedHistory).mockReturnValue(source({ data: [item(1, '0xl2')] }) as any);
    vi.mocked(useHistoryFamilyQuery).mockReturnValue(source({ data: [item(1, '0xfamily')] }) as any);
    vi.mocked(useCowswapTradeHistory).mockReturnValue(source() as any);
    vi.mocked(useMorphoVaultHistory).mockReturnValue(source({ data: [item(1, '0xmorpho')] }) as any);
    vi.mocked(usePendleCombinedHistory).mockReturnValue(source({ data: [item(1, '0xpendle')] }) as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('serves the aggregate when no filter is active, without enabling scoped queries', () => {
    const { result } = renderHook(() => useFilteredPortfolioHistory({}));

    expect(result.current.data[0].transactionHash).toBe('0xaggregate');
    expect(vi.mocked(useHistoryFamilyQuery).mock.calls[0][0].enabled).toBe(false);
    expect(vi.mocked(useL2CombinedHistory).mock.calls[0][1]?.enabled).toBe(false);
    for (const call of vi.mocked(useCowswapTradeHistory).mock.calls) {
      expect(call[0]?.enabled).toBe(false);
    }
  });

  it('serves the mainnet aggregate for a network-only mainnet filter', () => {
    const { result } = renderHook(() => useFilteredPortfolioHistory({ network: chainIdMap.mainnet }));
    expect(result.current.data[0].transactionHash).toBe('0xeth');
  });

  it('serves the single-chain L2 aggregate for a network-only L2 filter', () => {
    const { result } = renderHook(() => useFilteredPortfolioHistory({ network: chainIdMap.base }));

    expect(result.current.data[0].transactionHash).toBe('0xl2');
    expect(result.current.hasNextPage).toBe(false);
    expect(vi.mocked(useL2CombinedHistory).mock.calls[0][0]).toBe(chainIdMap.base);
    expect(vi.mocked(useL2CombinedHistory).mock.calls[0][1]?.enabled).toBe(true);
  });

  it('serves the family document for an Envio-backed product filter', () => {
    const { result } = renderHook(() =>
      useFilteredPortfolioHistory({ product: ModuleEnum.STAKE, network: chainIdMap.mainnet })
    );

    expect(result.current.data[0].transactionHash).toBe('0xfamily');
    const args = vi.mocked(useHistoryFamilyQuery).mock.calls[0][0];
    expect(args).toMatchObject({ family: 'stake', chainId: chainIdMap.mainnet, enabled: true });
  });

  it('serves the REST hooks for Morpho and Pendle products', () => {
    const morpho = renderHook(() => useFilteredPortfolioHistory({ product: ModuleEnum.MORPHO }));
    expect(morpho.result.current.data[0].transactionHash).toBe('0xmorpho');
    expect(morpho.result.current.hasNextPage).toBe(false);

    const pendle = renderHook(() => useFilteredPortfolioHistory({ product: ModuleEnum.PENDLE }));
    expect(pendle.result.current.data[0].transactionHash).toBe('0xpendle');
  });

  it('merges PSM and CoW trades under the PSM floor with per-chain cutoffs', () => {
    const cutoff = TRADE_CUTOFF_DATES[chainIdMap.base];
    const afterCutoff = Math.floor(cutoff.getTime() / 1000) + 100;
    const beforeCutoff = Math.floor(cutoff.getTime() / 1000) - 100;

    vi.mocked(useHistoryFamilyQuery).mockReturnValue(
      source({
        data: [item(afterCutoff + 500, '0xpsm')],
        nextCursor: afterCutoff - 50,
        hasNextPage: true
      }) as any
    );
    vi.mocked(useCowswapTradeHistory).mockImplementation((({ chainId }: { chainId: number }) =>
      chainId === chainIdMap.base
        ? source({
            data: [
              item(afterCutoff, '0xcow-after'),
              item(beforeCutoff, '0xcow-before-cutoff'),
              item(afterCutoff - 80, '0xcow-below-floor')
            ]
          })
        : source()) as any);

    const { result } = renderHook(() => useFilteredPortfolioHistory({ product: ModuleEnum.TRADE }));

    // Pre-cutoff CoW trades are PSM swaps (already in the family doc), and
    // post-cutoff ones older than the PSM floor wait for the next page.
    expect(result.current.data.map(i => i.transactionHash)).toEqual(['0xpsm', '0xcow-after']);
    expect(result.current.hasNextPage).toBe(true);

    const args = vi.mocked(useHistoryFamilyQuery).mock.calls[0][0];
    expect(args).toMatchObject({ family: 'psmTrades', enabled: true });
    // All three CoW feeds are on when no network narrows the trade filter.
    for (const call of vi.mocked(useCowswapTradeHistory).mock.calls) {
      expect(call[0]?.enabled).toBe(true);
    }
  });

  it('narrows the CoW feeds when the trade filter is network-scoped', () => {
    renderHook(() =>
      useFilteredPortfolioHistory({ product: ModuleEnum.TRADE, network: chainIdMap.arbitrum })
    );

    const enabledByChain = Object.fromEntries(
      vi.mocked(useCowswapTradeHistory).mock.calls.map(call => [call[0]?.chainId, call[0]?.enabled])
    );
    expect(enabledByChain[chainIdMap.arbitrum]).toBe(true);
    expect(enabledByChain[1]).toBe(false);
    expect(enabledByChain[chainIdMap.base]).toBe(false);
  });
});
