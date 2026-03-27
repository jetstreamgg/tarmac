import { useEthereumSavingsHistory } from '../savings/useEthereumSavingsHistory';
import { useUpgradeHistory } from '../upgrade/useUpgradeHistory';
import { useCowswapTradeHistory } from '../trade/useCowswapTradeHistory';
import { useAllRewardsUserHistory } from '../rewards/useAllRewardsUserHistory';
import { useMemo } from 'react';
import { useSealHistory } from '../seal/useSealHistory';
import { useStakeHistory } from '../stake/useStakeHistory';
import { useStUsdsHistory } from '../stusds/useStUsdsHistory';
import { useMorphoVaultHistory } from '../morpho';

export function useEthereumCombinedHistory() {
  const savingsHistory = useEthereumSavingsHistory();
  const upgradeHistory = useUpgradeHistory();
  const tradeHistory = useCowswapTradeHistory({ chainId: 1 });
  const combinedRewardHistory = useAllRewardsUserHistory();
  const sealHistory = useSealHistory();
  const stakeHistory = useStakeHistory();
  const stUsdsHistory = useStUsdsHistory();
  const morphoVaultsHistory = useMorphoVaultHistory();

  const combinedData = useMemo(() => {
    return [
      ...(savingsHistory.data || []),
      ...(upgradeHistory.data || []),
      ...(tradeHistory.data || []),
      ...(combinedRewardHistory.data || []),
      ...(sealHistory.data || []),
      ...(stakeHistory.data || []),
      ...(stUsdsHistory.data || []),
      ...(morphoVaultsHistory.data || [])
    ].sort((a, b) => b.blockTimestamp.getTime() - a.blockTimestamp.getTime());
  }, [
    savingsHistory.data,
    upgradeHistory.data,
    tradeHistory.data,
    combinedRewardHistory.data,
    sealHistory.data,
    stakeHistory.data,
    stUsdsHistory.data,
    morphoVaultsHistory.data
  ]);

  return {
    data: combinedData,
    isLoading:
      savingsHistory.isLoading ||
      tradeHistory.isLoading ||
      upgradeHistory.isLoading ||
      combinedRewardHistory.isLoading ||
      sealHistory.isLoading ||
      stakeHistory.isLoading ||
      stUsdsHistory.isLoading ||
      morphoVaultsHistory.isLoading,
    error:
      savingsHistory.error ||
      upgradeHistory.error ||
      tradeHistory.error ||
      combinedRewardHistory.error ||
      sealHistory.error ||
      stakeHistory.error ||
      stUsdsHistory.error ||
      morphoVaultsHistory.error,
    mutate: () => {
      savingsHistory.mutate();
      upgradeHistory.mutate();
      tradeHistory.mutate();
      combinedRewardHistory.mutate();
      sealHistory.mutate();
      stakeHistory.mutate();
      stUsdsHistory.mutate();
      morphoVaultsHistory.mutate();
    }
  };
}
