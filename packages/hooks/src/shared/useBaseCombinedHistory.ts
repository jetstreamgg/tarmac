import { useBaseSavingsHistory } from '../psm/useBaseSavingsHistory';
import { useBaseTradeHistory } from '../psm/useBaseTradeHistory';
import { useMemo } from 'react';

export function useBaseCombinedHistory() {
  const savingsHistory = useBaseSavingsHistory();
  const tradeHistory = useBaseTradeHistory();

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
    }
  };
}
