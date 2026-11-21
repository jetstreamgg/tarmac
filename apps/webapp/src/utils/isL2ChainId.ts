import { chainId as chainIdMap, realChainId } from './chainId';

// Fork L2s count as the L2 they stand in for.

export const isArbitrumChainId = (chainId: number) => {
  return realChainId(chainId) === chainIdMap.arbitrum;
};

export const isBaseChainId = (chainId: number) => {
  return realChainId(chainId) === chainIdMap.base;
};

export const isUnichainChainId = (chainId: number) => {
  return realChainId(chainId) === chainIdMap.unichain;
};

export const isOptimismChainId = (chainId: number) => {
  return realChainId(chainId) === chainIdMap.optimism;
};

export const isL2ChainId = (chainId: number) => {
  return (
    isArbitrumChainId(chainId) ||
    isBaseChainId(chainId) ||
    isUnichainChainId(chainId) ||
    isOptimismChainId(chainId)
  );
};
