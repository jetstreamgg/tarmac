import { useCowswapTradeHistory } from './useCowswapTradeHistory';
import { usePsmTradeHistory } from '../psm/usePsmTradeHistory';
import { useHybridTradeHistory } from './useHybridTradeHistory';
import { isCowSupportedChainId, TRADE_CUTOFF_DATES } from '@jetstreamgg/sky-utils';
import { useChainId } from 'wagmi';

export function useTradeHistory({
  subgraphUrl,
  chainId: providedChainId,
  excludeSUsds = false
}: {
  subgraphUrl?: string;
  chainId?: number;
  excludeSUsds?: boolean;
} = {}) {
  const currentChainId = useChainId();
  const chainId = providedChainId ?? currentChainId;

  //use hybrid trade history if the chain has a cutoff date
  const shouldUseHybrid = !!TRADE_CUTOFF_DATES[chainId];

  const hybridTradeHistory = useHybridTradeHistory({
    chainId,
    excludeSUsds,
    subgraphUrl,
    enabled: shouldUseHybrid
  });

  const cowswapTradeHistory = useCowswapTradeHistory({
    enabled: !shouldUseHybrid && isCowSupportedChainId(chainId),
    chainId
  });

  const psmTradeHistory = usePsmTradeHistory({
    subgraphUrl,
    enabled: !shouldUseHybrid && !isCowSupportedChainId(chainId),
    chainId,
    excludeSUsds
  });

  if (shouldUseHybrid) {
    return hybridTradeHistory;
  }

  if (isCowSupportedChainId(chainId)) {
    return cowswapTradeHistory;
  }

  return psmTradeHistory;
}
