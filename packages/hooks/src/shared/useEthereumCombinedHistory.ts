import { useEthereumSavingsHistory } from '../savings/useEthereumSavingsHistory';
import { useUpgradeHistory } from '../upgrade/useUpgradeHistory';
import { useEthereumTradeHistory } from '../trade/useEthereumTradeHistory';
import { useAllRewardsUserHistory } from '../rewards/useAllRewardsUserHistory';
import { useMemo } from 'react';
import { useSealHistory } from '../seal/useSealHistory';

export function useEthereumCombinedHistory() {
  const savingsHistory = useEthereumSavingsHistory();
  const upgradeHistory = useUpgradeHistory();
  const tradeHistory = useEthereumTradeHistory({});
  const combinedRewardHistory = useAllRewardsUserHistory();
  const sealHistory = useSealHistory();

  const combinedData = useMemo(() => {
    return [
      ...(savingsHistory.data || []),
      ...(upgradeHistory.data || []),
      ...(tradeHistory.data || []),
      ...(combinedRewardHistory.data || []),
      ...(sealHistory.data || [])
    ].sort((a, b) => b.blockTimestamp.getTime() - a.blockTimestamp.getTime());
  }, [
    savingsHistory.data,
    upgradeHistory.data,
    tradeHistory.data,
    combinedRewardHistory.data,
    sealHistory.data
  ]);

  return {
    data: combinedData,
    isLoading:
      savingsHistory.isLoading ||
      tradeHistory.isLoading ||
      upgradeHistory.isLoading ||
      combinedRewardHistory.isLoading ||
      sealHistory.isLoading,
    error:
      savingsHistory.error ||
      upgradeHistory.error ||
      tradeHistory.error ||
      combinedRewardHistory.error ||
      sealHistory.error,
    mutate: () => {
      savingsHistory.mutate();
      upgradeHistory.mutate();
      tradeHistory.mutate();
      combinedRewardHistory.mutate();
      sealHistory.mutate();
    }
  };
}
