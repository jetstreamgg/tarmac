import { useBaseCombinedHistory } from './useBaseCombinedHistory';
import { useEthereumCombinedHistory } from './useEthereumCombinedHistory';
import { useChainId } from 'wagmi';
import { isBaseChainId } from '@jetstreamgg/utils';
import { CombinedHistoryItem } from './shared';

export const useCombinedHistory = (): {
  data: CombinedHistoryItem[];
  isLoading: boolean;
  error: Error | null;
  mutate: () => void;
} => {
  const chainId = useChainId();
  const baseHistory = useBaseCombinedHistory();
  const ethereumHistory = useEthereumCombinedHistory();

  return isBaseChainId(chainId) ? baseHistory : ethereumHistory;
};
