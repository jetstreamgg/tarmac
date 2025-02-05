import { useEthereumTradeHistory } from './useEthereumTradeHistory';
import { useL2TradeHistory } from '../psm/useL2TradeHistory';
import { isL2ChainId } from '@jetstreamgg/utils';
import { useChainId } from 'wagmi';

export function useTradeHistory(subgraphUrl?: string) {
  const chainId = useChainId();
  const l2TradeHistory = useL2TradeHistory({ subgraphUrl, enabled: isL2ChainId(chainId) });
  const ethereumTradeHistory = useEthereumTradeHistory({ enabled: !isL2ChainId(chainId) });

  if (isL2ChainId(chainId)) {
    return l2TradeHistory;
  }
  return ethereumTradeHistory;
}
