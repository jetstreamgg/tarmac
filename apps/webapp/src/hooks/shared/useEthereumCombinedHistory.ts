import { useCowswapTradeHistory } from '../trade/useCowswapTradeHistory';
import { useMemo } from 'react';
import { useEthereumIndexerHistory } from './useEthereumIndexerHistory';
import { useMorphoVaultHistory } from '../morpho';
import { usePendleCombinedHistory } from '../pendle/usePendleCombinedHistory';
import { CombinedHistoryItem } from './shared';
import { clampHistoryPage } from './historyQueryHelpers';

/**
 * Mainnet history: one keyset-paginated indexer document (savings, upgrade,
 * stake, rewards, stUSDS, sUSDT, PSM conversions) merged with the REST-backed sources (CoW,
 * Morpho, Pendle). REST items older than the indexer's completeness floor are
 * withheld until `fetchNextPage` advances it, so rows never insert mid-list.
 */
export function useEthereumCombinedHistory() {
  const indexerHistory = useEthereumIndexerHistory();
  const tradeHistory = useCowswapTradeHistory({ chainId: 1 });
  const morphoVaultsHistory = useMorphoVaultHistory();
  const pendleHistory = usePendleCombinedHistory();

  const floor = indexerHistory.nextCursor;

  const combinedData = useMemo(() => {
    const restItems: CombinedHistoryItem[] = [
      ...(tradeHistory.data || []),
      ...(morphoVaultsHistory.data || []),
      ...(pendleHistory.data || [])
    ];
    return [...(indexerHistory.data || []), ...clampHistoryPage(restItems, floor)].sort(
      (a, b) => b.blockTimestamp.getTime() - a.blockTimestamp.getTime()
    );
  }, [indexerHistory.data, tradeHistory.data, morphoVaultsHistory.data, pendleHistory.data, floor]);

  return {
    data: combinedData,
    isLoading:
      indexerHistory.isLoading ||
      tradeHistory.isLoading ||
      morphoVaultsHistory.isLoading ||
      pendleHistory.isLoading,
    error: indexerHistory.error || tradeHistory.error || morphoVaultsHistory.error || pendleHistory.error,
    mutate: () => {
      indexerHistory.mutate();
      tradeHistory.mutate();
      morphoVaultsHistory.mutate();
      pendleHistory.mutate();
    },
    /** Completeness floor (seconds); undefined once indexer history is fully loaded. */
    nextCursor: floor,
    hasNextPage: indexerHistory.hasNextPage,
    fetchNextPage: indexerHistory.fetchNextPage,
    isFetchingNextPage: indexerHistory.isFetchingNextPage
  };
}
