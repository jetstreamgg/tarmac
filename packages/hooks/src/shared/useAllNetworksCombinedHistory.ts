import { useL2CombinedHistory } from './useL2CombinedHistory';
import { useEthereumCombinedHistory } from './useEthereumCombinedHistory';
import { CombinedHistoryItem } from './shared';
import { useMemo } from 'react';
import { useChainId } from 'wagmi';
import { isTestnetId, chainId as chainIdMap } from '@jetstreamgg/utils';

export function useAllNetworksCombinedHistory() {
  const chainId = useChainId();
  const baseHistory = useL2CombinedHistory(isTestnetId(chainId) ? chainIdMap.tenderlyBase : chainIdMap.base);
  const ethereumHistory = useEthereumCombinedHistory();
  const arbitrumHistory = useL2CombinedHistory(
    isTestnetId(chainId) ? chainIdMap.tenderlyArbitrum : chainIdMap.arbitrum
  );
  const combinedData = useMemo(() => {
    return [
      ...(baseHistory.data || []),
      ...(ethereumHistory.data || []),
      ...(arbitrumHistory.data || [])
    ].sort((a: CombinedHistoryItem, b: CombinedHistoryItem) => b.blockTimestamp - a.blockTimestamp);
  }, [baseHistory.data, ethereumHistory.data, arbitrumHistory.data]);

  return {
    data: combinedData,
    isLoading: baseHistory.isLoading || ethereumHistory.isLoading || arbitrumHistory.isLoading,
    error: baseHistory.error || ethereumHistory.error || arbitrumHistory.error,
    mutate: () => {
      baseHistory.mutate();
      ethereumHistory.mutate();
      arbitrumHistory.mutate();
    }
  };
}
