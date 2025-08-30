import { useMemo } from 'react';
import { useChainId } from 'wagmi';
import {
  isBaseChainId,
  isMainnetId,
  isArbitrumChainId,
  isUnichainChainId,
  isOptimismChainId
} from '@jetstreamgg/sky-utils';

export const useChainImage = (chainId?: number) => {
  const connectedChainId = useChainId();
  const chainIdToUse = chainId || connectedChainId;

  return useMemo(() => {
    const chainName = isBaseChainId(chainIdToUse)
      ? 'base'
      : isMainnetId(chainIdToUse)
        ? 'ethereum'
        : isArbitrumChainId(chainIdToUse)
          ? 'arbitrumone'
          : isUnichainChainId(chainIdToUse)
            ? 'unichain'
            : isOptimismChainId(chainIdToUse)
              ? 'optimism'
              : undefined;

    // All chains use .svg format
    return `/networks/${chainName}.svg`;
  }, [chainIdToUse]);
};
