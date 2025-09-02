import { useL2CombinedHistory } from './useL2CombinedHistory';
import { useEthereumCombinedHistory } from './useEthereumCombinedHistory';
import { CombinedHistoryItem } from './shared';
import { useMemo } from 'react';
import { useChainId } from 'wagmi';
import { isTestnetId, chainId as chainIdMap } from '@jetstreamgg/sky-utils';

export function useAllNetworksCombinedHistory() {
  const chainId = useChainId();
  const baseHistory = useL2CombinedHistory(isTestnetId(chainId) ? chainIdMap.tenderlyBase : chainIdMap.base);
  const ethereumHistory = useEthereumCombinedHistory();
  const arbitrumHistory = useL2CombinedHistory(chainIdMap.arbitrum);
  const optimismHistory = useL2CombinedHistory(chainIdMap.optimism);
  const unichainHistory = useL2CombinedHistory(chainIdMap.unichain);

  const combinedData = useMemo(() => {
    return [
      ...(baseHistory.data || []),
      ...(ethereumHistory.data || []),
      ...(arbitrumHistory.data || []),
      ...(optimismHistory.data || []),
      ...(unichainHistory.data || [])
    ].sort((a: CombinedHistoryItem, b: CombinedHistoryItem) => b.blockTimestamp - a.blockTimestamp);
  }, [
    baseHistory.data,
    ethereumHistory.data,
    arbitrumHistory.data,
    optimismHistory.data,
    unichainHistory.data
  ]);

  return {
    data: combinedData,
    isLoading:
      baseHistory.isLoading ||
      ethereumHistory.isLoading ||
      arbitrumHistory.isLoading ||
      optimismHistory.isLoading ||
      unichainHistory.isLoading,
    error:
      baseHistory.error ||
      ethereumHistory.error ||
      arbitrumHistory.error ||
      optimismHistory.error ||
      unichainHistory.error,
    mutate: () => {
      baseHistory.mutate();
      ethereumHistory.mutate();
      arbitrumHistory.mutate();
      optimismHistory.mutate();
      unichainHistory.mutate();
    }
  };
}
