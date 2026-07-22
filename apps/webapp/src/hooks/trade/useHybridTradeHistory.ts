import { useMemo } from 'react';
import { useCowswapTradeHistory } from './useCowswapTradeHistory';
import { usePsmTradeHistory } from '../psm/usePsmTradeHistory';
import { TRADE_CUTOFF_DATES } from '@/utils';
import { ReadHook } from '../hooks';
import { PaginatedHistory } from '../shared/useHistoryPagination';

/**
 * Hook that fetches both PSM and CowSwap trade histories and merges them based on a cutoff date
 * PSM trades before the cutoff date and CowSwap trades after the cutoff date.
 * Every CoW trade is newer than every PSM trade, so the PSM side's keyset
 * pagination carries over unchanged: pages only ever append below the CoW rows.
 */
export function useHybridTradeHistory({
  chainId,
  excludeSUsds = false,
  indexerUrl,
  enabled = true
}: {
  chainId: number;
  excludeSUsds?: boolean;
  indexerUrl?: string;
  enabled?: boolean;
}): ReadHook & PaginatedHistory & { data?: any[] } {
  const cutoffDate = TRADE_CUTOFF_DATES[chainId];

  const shouldFetch = enabled && !!cutoffDate;

  const psmHistory = usePsmTradeHistory({
    chainId,
    excludeSUsds,
    indexerUrl,
    enabled: shouldFetch,
    maxBlockTimestamp: cutoffDate ? Math.floor(cutoffDate.getTime() / 1000) : undefined
  });

  const cowswapHistory = useCowswapTradeHistory({
    chainId,
    enabled: shouldFetch
  });

  const mergedData = useMemo(() => {
    if (!shouldFetch) {
      return [];
    }

    const psmData = psmHistory.data || [];
    const cowswapData = cowswapHistory.data || [];

    // PSM filtering is done on the indexer side, CowSwap filtering done client-side
    const filteredCowswapData = cowswapData.filter(trade => trade.blockTimestamp >= cutoffDate);

    return [...psmData, ...filteredCowswapData].sort(
      (a, b) => b.blockTimestamp.getTime() - a.blockTimestamp.getTime()
    );
  }, [psmHistory.data, cowswapHistory.data, cutoffDate, shouldFetch]);

  return {
    data: mergedData,
    isLoading: psmHistory.isLoading || cowswapHistory.isLoading,
    error: psmHistory.error || cowswapHistory.error,
    mutate: () => {
      psmHistory.mutate();
      cowswapHistory.mutate();
    },
    nextCursor: psmHistory.nextCursor,
    hasNextPage: psmHistory.hasNextPage,
    fetchNextPage: psmHistory.fetchNextPage,
    isFetchingNextPage: psmHistory.isFetchingNextPage,
    dataSources: [...(psmHistory.dataSources || []), ...(cowswapHistory.dataSources || [])]
  };
}
