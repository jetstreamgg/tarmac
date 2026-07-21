import { useL2SavingsHistory } from '../psm/useL2SavingsHistory';
import { useTradeHistory } from '../trade/useTradeHistory';
import { useMemo } from 'react';
import { clampHistoryPage } from './historyQueryHelpers';

export function useL2CombinedHistory(chainId?: number, { enabled = true }: { enabled?: boolean } = {}) {
  const savingsHistory = useL2SavingsHistory({ chainId, enabled });
  const tradeHistory = useTradeHistory({
    chainId,
    excludeSUsds: true,
    enabled
  });

  // Both sides are keyset-paginated; clamp the merge at the newest completeness
  // floor so pagination never inserts rows mid-list (see historyQueryHelpers).
  const savingsFloor = savingsHistory.nextCursor;
  const tradeFloor = tradeHistory.nextCursor;
  const globalFloor =
    savingsFloor !== undefined && tradeFloor !== undefined
      ? Math.max(savingsFloor, tradeFloor)
      : (savingsFloor ?? tradeFloor);

  const combinedData = useMemo(() => {
    return clampHistoryPage([...(savingsHistory.data || []), ...(tradeHistory.data || [])], globalFloor).sort(
      (a, b) => b.blockTimestamp.getTime() - a.blockTimestamp.getTime()
    );
  }, [savingsHistory.data, tradeHistory.data, globalFloor]);

  return {
    data: combinedData,
    isLoading: savingsHistory.isLoading || tradeHistory.isLoading,
    error: savingsHistory.error || tradeHistory.error,
    mutate: () => {
      savingsHistory.mutate();
      tradeHistory.mutate();
    },
    nextCursor: globalFloor,
    hasNextPage: Boolean(savingsHistory.hasNextPage || tradeHistory.hasNextPage),
    isFetchingNextPage: savingsHistory.isFetchingNextPage || tradeHistory.isFetchingNextPage,
    fetchNextPage: () => {
      // Advance the side(s) sitting at the global floor; the other side's
      // already-fetched items surface as the floor descends.
      if (savingsHistory.hasNextPage && (tradeFloor === undefined || (savingsFloor ?? 0) >= tradeFloor)) {
        savingsHistory.fetchNextPage();
      }
      if (tradeHistory.hasNextPage && (savingsFloor === undefined || (tradeFloor ?? 0) >= savingsFloor)) {
        tradeHistory.fetchNextPage();
      }
    }
  };
}
