import { useL2SavingsHistory } from '../psm/useL2SavingsHistory';
import { useTradeHistory } from '../trade/useTradeHistory';
import { useMemo } from 'react';

export function useL2CombinedHistory(chainId?: number) {
  const savingsHistory = useL2SavingsHistory({ chainId });
  const tradeHistory = useTradeHistory({
    chainId,
    excludeSUsds: true
  });

  const combinedData = useMemo(() => {
    return [...(savingsHistory.data || []), ...(tradeHistory.data || [])].sort(
      (a, b) => b.blockTimestamp.getTime() - a.blockTimestamp.getTime()
    );
  }, [savingsHistory.data, tradeHistory.data]);

  return {
    data: combinedData,
    isLoading: savingsHistory.isLoading || tradeHistory.isLoading,
    error: savingsHistory.error || tradeHistory.error,
    mutate: () => {
      savingsHistory.mutate();
      tradeHistory.mutate();
    },
    // Single-chain L2 history is bounded per entity and not paginated; inert
    // pagination fields keep the shape interchangeable with the mainnet side.
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: () => {}
  };
}
