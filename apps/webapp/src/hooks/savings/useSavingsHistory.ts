import { useEthereumSavingsHistory } from './useEthereumSavingsHistory';
import { useL2SavingsHistory } from '../psm/useL2SavingsHistory';
import { isL2ChainId } from '@/utils';
import { useChainId } from 'wagmi';

export function useSavingsHistory(indexerUrl?: string) {
  const chainId = useChainId();
  const l2SavingsHistory = useL2SavingsHistory({ indexerUrl, enabled: isL2ChainId(chainId) });
  const ethereumSavingsHistory = useEthereumSavingsHistory({ indexerUrl, enabled: !isL2ChainId(chainId) });

  if (isL2ChainId(chainId)) {
    return l2SavingsHistory;
  }
  return ethereumSavingsHistory;
}
