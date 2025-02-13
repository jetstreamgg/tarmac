import { useEthereumSavingsHistory } from './useEthereumSavingsHistory';
import { useL2SavingsHistory } from '../psm/useL2SavingsHistory';
import { isL2ChainId } from '@jetstreamgg/utils';
import { useChainId } from 'wagmi';

export function useSavingsHistory(subgraphUrl?: string) {
  const chainId = useChainId();
  const l2SavingsHistory = useL2SavingsHistory({ subgraphUrl, enabled: isL2ChainId(chainId) });
  const ethereumSavingsHistory = useEthereumSavingsHistory({ subgraphUrl, enabled: !isL2ChainId(chainId) });

  if (isL2ChainId(chainId)) {
    return l2SavingsHistory;
  }
  return ethereumSavingsHistory;
}
