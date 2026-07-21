import { useCowswapTradeHistory } from './useCowswapTradeHistory';
import { usePsmTradeHistory } from '../psm/usePsmTradeHistory';
import { useHybridTradeHistory } from './useHybridTradeHistory';
import { isCowSupportedChainId, TRADE_CUTOFF_DATES } from '@/utils';
import { useChainId } from 'wagmi';

export function useTradeHistory({
  indexerUrl,
  chainId: providedChainId,
  excludeSUsds = false,
  enabled = true
}: {
  indexerUrl?: string;
  chainId?: number;
  excludeSUsds?: boolean;
  enabled?: boolean;
} = {}) {
  const currentChainId = useChainId();
  const chainId = providedChainId ?? currentChainId;

  //use hybrid trade history if the chain has a cutoff date
  const shouldUseHybrid = !!TRADE_CUTOFF_DATES[chainId];

  const hybridTradeHistory = useHybridTradeHistory({
    chainId,
    excludeSUsds,
    indexerUrl,
    enabled: enabled && shouldUseHybrid
  });

  const cowswapTradeHistory = useCowswapTradeHistory({
    enabled: enabled && !shouldUseHybrid && isCowSupportedChainId(chainId),
    chainId
  });

  const psmTradeHistory = usePsmTradeHistory({
    indexerUrl,
    enabled: enabled && !shouldUseHybrid && !isCowSupportedChainId(chainId),
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
