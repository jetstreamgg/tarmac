import { useMemo } from 'react';
import { useChainId } from 'wagmi';
import { isBaseChainId, isArbitrumChainId, isUnichainChainId, isOptimismChainId } from '@/utils/isL2ChainId';
import { isMainnetId } from '@/utils/isMainnetId';

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

    // All chains use .svg format; an unconfigured chain gets no badge rather
    // than a guaranteed 404 at /networks/undefined.svg.
    return chainName ? `/networks/${chainName}.svg` : undefined;
  }, [chainIdToUse]);
};
