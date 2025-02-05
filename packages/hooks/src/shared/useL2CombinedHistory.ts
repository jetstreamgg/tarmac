import { useL2SavingsHistory } from '../psm/useL2SavingsHistory';
import { useL2TradeHistory } from '../psm/useL2TradeHistory';
import { CombinedHistoryItem } from './shared';
import { useMemo } from 'react';

export function useL2CombinedHistory() {
  const savingsHistory = useL2SavingsHistory();
  const tradeHistory = useL2TradeHistory();

  const combinedData = useMemo(() => {
    return [...(savingsHistory.data || []), ...(tradeHistory.data || [])].sort(
      (a: CombinedHistoryItem, b: CombinedHistoryItem) => b.blockTimestamp - a.blockTimestamp
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
