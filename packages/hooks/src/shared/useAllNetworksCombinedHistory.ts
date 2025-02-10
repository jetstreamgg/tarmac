import { useBaseCombinedHistory } from './useBaseCombinedHistory';
import { useEthereumCombinedHistory } from './useEthereumCombinedHistory';
import { CombinedHistoryItem } from './shared';
import { useMemo } from 'react';

export function useAllNetworksCombinedHistory() {
  const baseHistory = useBaseCombinedHistory();
  const ethereumHistory = useEthereumCombinedHistory();
  //TODO: add arbitrum history
  console.log('baseHistory', baseHistory);
  const combinedData = useMemo(() => {
    return [...(baseHistory.data || []), ...(ethereumHistory.data || [])].sort(
      (a: CombinedHistoryItem, b: CombinedHistoryItem) => b.blockTimestamp - a.blockTimestamp
    );
  }, [baseHistory.data, ethereumHistory.data]);

  return {
    data: combinedData,
    isLoading: baseHistory.isLoading || ethereumHistory.isLoading,
    error: baseHistory.error || ethereumHistory.error,
    mutate: () => {
      baseHistory.mutate();
      ethereumHistory.mutate();
    }
  };
}
