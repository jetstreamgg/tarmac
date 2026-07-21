import { useMemo } from 'react';
import { useEthereumCombinedHistory } from './useEthereumCombinedHistory';
import { useL2sIndexerHistory } from './useL2sIndexerHistory';
import { useCowswapTradeHistory } from '../trade/useCowswapTradeHistory';
import { CombinedHistoryItem } from './shared';
import { clampHistoryPage } from './historyQueryHelpers';
import { chainId as chainIdMap, TRADE_CUTOFF_DATES } from '@/utils';

/**
 * History across every network: the mainnet aggregate (one indexer document +
 * CoW/Morpho/Pendle), the all-L2s indexer document, and the L2 CowSwap feeds —
 * 2 indexer requests total instead of the historical per-chain-per-family
 * fan-out. Both indexer sides are keyset-paginated; the merged list is clamped
 * to the newest completeness floor so pagination never inserts rows mid-list,
 * and `fetchNextPage` advances whichever side is holding that floor.
 */
export function useAllNetworksCombinedHistory() {
  const ethereumHistory = useEthereumCombinedHistory();
  const l2History = useL2sIndexerHistory();
  // CowSwap trades exist only on the hybrid chains, and only after each
  // chain's cutoff — before it, L2 trades were PSM swaps (already in the L2
  // indexer document).
  const baseCowHistory = useCowswapTradeHistory({ chainId: chainIdMap.base });
  const arbitrumCowHistory = useCowswapTradeHistory({ chainId: chainIdMap.arbitrum });

  const ethereumFloor = ethereumHistory.nextCursor;
  const l2Floor = l2History.nextCursor;
  const globalFloor =
    ethereumFloor !== undefined && l2Floor !== undefined
      ? Math.max(ethereumFloor, l2Floor)
      : (ethereumFloor ?? l2Floor);

  const combinedData = useMemo(() => {
    const cowItems: CombinedHistoryItem[] = [
      ...(baseCowHistory.data || []).filter(
        trade => trade.blockTimestamp >= TRADE_CUTOFF_DATES[chainIdMap.base]
      ),
      ...(arbitrumCowHistory.data || []).filter(
        trade => trade.blockTimestamp >= TRADE_CUTOFF_DATES[chainIdMap.arbitrum]
      )
    ];
    return clampHistoryPage(
      [...(ethereumHistory.data || []), ...(l2History.data || []), ...cowItems],
      globalFloor
    ).sort((a, b) => b.blockTimestamp.getTime() - a.blockTimestamp.getTime());
  }, [ethereumHistory.data, l2History.data, baseCowHistory.data, arbitrumCowHistory.data, globalFloor]);

  return {
    data: combinedData,
    isLoading:
      ethereumHistory.isLoading ||
      l2History.isLoading ||
      baseCowHistory.isLoading ||
      arbitrumCowHistory.isLoading,
    error: ethereumHistory.error || l2History.error || baseCowHistory.error || arbitrumCowHistory.error,
    mutate: () => {
      ethereumHistory.mutate();
      l2History.mutate();
      baseCowHistory.mutate();
      arbitrumCowHistory.mutate();
    },
    hasNextPage: Boolean(ethereumHistory.hasNextPage || l2History.hasNextPage),
    isFetchingNextPage: ethereumHistory.isFetchingNextPage || l2History.isFetchingNextPage,
    fetchNextPage: () => {
      // Advance the side(s) sitting at the global floor; the other side's
      // already-fetched items surface as the floor descends.
      if (ethereumHistory.hasNextPage && (l2Floor === undefined || (ethereumFloor ?? 0) >= l2Floor)) {
        ethereumHistory.fetchNextPage();
      }
      if (l2History.hasNextPage && (ethereumFloor === undefined || (l2Floor ?? 0) >= ethereumFloor)) {
        l2History.fetchNextPage();
      }
    }
  };
}
