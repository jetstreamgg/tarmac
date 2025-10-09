import { useMemo } from 'react';
import { useCowswapTradeHistory } from './useCowswapTradeHistory';
import { usePsmTradeHistory } from '../psm/usePsmTradeHistory';
import { TRADE_CUTOFF_DATES } from '@jetstreamgg/sky-utils';
import { ReadHook } from '../hooks';

/**
 * Hook that fetches both PSM and CowSwap trade histories and merges them based on a cutoff date
 * PSM trades before the cutoff date and CowSwap trades after the cutoff date
 */
export function useHybridTradeHistory({
  chainId,
  excludeSUsds = false,
  subgraphUrl,
  enabled = true
}: {
  chainId: number;
  excludeSUsds?: boolean;
  subgraphUrl?: string;
  enabled?: boolean;
}): ReadHook & { data?: any[] } {
  const cutoffDate = TRADE_CUTOFF_DATES[chainId];

  const shouldFetch = enabled && !!cutoffDate;

  const psmHistory = usePsmTradeHistory({
    chainId,
    excludeSUsds,
    subgraphUrl,
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

    // PSM filtering is done on the subgraph side, CowSwap filtering done client-side
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
    dataSources: [...(psmHistory.dataSources || []), ...(cowswapHistory.dataSources || [])]
  };
}
