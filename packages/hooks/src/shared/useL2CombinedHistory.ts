import { useL2SavingsHistory } from '../psm/useL2SavingsHistory';
import { useL2TradeHistory } from '../psm/useL2TradeHistory';
import { useMemo } from 'react';

export function useL2CombinedHistory(chainId?: number) {
  const savingsHistory = useL2SavingsHistory({ chainId });
  const tradeHistory = useL2TradeHistory({ chainId });

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
