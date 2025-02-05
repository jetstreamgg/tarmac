import { useL2CombinedHistory } from './useL2CombinedHistory';
import { useEthereumCombinedHistory } from './useEthereumCombinedHistory';
import { useChainId } from 'wagmi';
import { isL2ChainId } from '@jetstreamgg/utils';

export const useCombinedHistory = () => {
  const chainId = useChainId();
  const l2History = useL2CombinedHistory();
  const ethereumHistory = useEthereumCombinedHistory();

  return isL2ChainId(chainId) ? l2History : ethereumHistory;
};
