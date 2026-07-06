import { useEthereumSavingsHistory } from '../savings/useEthereumSavingsHistory';
import { useUpgradeHistory } from '../upgrade/useUpgradeHistory';
import { useCowswapTradeHistory } from '../trade/useCowswapTradeHistory';
import { useAllRewardsUserHistory } from '../rewards/useAllRewardsUserHistory';
import { useMemo } from 'react';
import { useStakeHistory } from '../stake/useStakeHistory';
import { useStUsdsHistory } from '../stusds/useStUsdsHistory';
import { useMorphoVaultHistory } from '../morpho';
import { useSusdtVaultHistory } from '../vaults';
import { usePendleCombinedHistory } from '../pendle/usePendleCombinedHistory';

export function useEthereumCombinedHistory() {
  const savingsHistory = useEthereumSavingsHistory();
  const upgradeHistory = useUpgradeHistory();
  const tradeHistory = useCowswapTradeHistory({ chainId: 1 });
  const combinedRewardHistory = useAllRewardsUserHistory();
  const stakeHistory = useStakeHistory();
  const stUsdsHistory = useStUsdsHistory();
  const morphoVaultsHistory = useMorphoVaultHistory();
  const susdtVaultHistory = useSusdtVaultHistory();
  const pendleHistory = usePendleCombinedHistory();

  const combinedData = useMemo(() => {
    return [
      ...(savingsHistory.data || []),
      ...(upgradeHistory.data || []),
      ...(tradeHistory.data || []),
      ...(combinedRewardHistory.data || []),
      ...(stakeHistory.data || []),
      ...(stUsdsHistory.data || []),
      ...(morphoVaultsHistory.data || []),
      ...(susdtVaultHistory.data || []),
      ...(pendleHistory.data || [])
    ].sort((a, b) => b.blockTimestamp.getTime() - a.blockTimestamp.getTime());
  }, [
    savingsHistory.data,
    upgradeHistory.data,
    tradeHistory.data,
    combinedRewardHistory.data,
    stakeHistory.data,
    stUsdsHistory.data,
    morphoVaultsHistory.data,
    susdtVaultHistory.data,
    pendleHistory.data
  ]);

  return {
    data: combinedData,
    isLoading:
      savingsHistory.isLoading ||
      tradeHistory.isLoading ||
      upgradeHistory.isLoading ||
      combinedRewardHistory.isLoading ||
      stakeHistory.isLoading ||
      stUsdsHistory.isLoading ||
      morphoVaultsHistory.isLoading ||
      susdtVaultHistory.isLoading ||
      pendleHistory.isLoading,
    error:
      savingsHistory.error ||
      upgradeHistory.error ||
      tradeHistory.error ||
      combinedRewardHistory.error ||
      stakeHistory.error ||
      stUsdsHistory.error ||
      morphoVaultsHistory.error ||
      susdtVaultHistory.error ||
      pendleHistory.error,
    mutate: () => {
      savingsHistory.mutate();
      upgradeHistory.mutate();
      tradeHistory.mutate();
      combinedRewardHistory.mutate();
      stakeHistory.mutate();
      stUsdsHistory.mutate();
      morphoVaultsHistory.mutate();
      susdtVaultHistory.mutate();
      pendleHistory.mutate();
    }
  };
}
