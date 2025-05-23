import { chainId as chainIdMap } from './chainId';

export const isArbitrumChainId = (chainId: number) => {
  return chainId === chainIdMap.arbitrum || chainId === chainIdMap.tenderlyArbitrum;
};

export const isBaseChainId = (chainId: number) => {
  return chainId === chainIdMap.base || chainId === chainIdMap.tenderlyBase;
};

export const isUnichainChainId = (chainId: number) => {
  return chainId === chainIdMap.unichain;
};

export const isOptimismChainId = (chainId: number) => {
  return chainId === chainIdMap.optimism;
};

export const isL2ChainId = (chainId: number) => {
  return (
    isArbitrumChainId(chainId) ||
    isBaseChainId(chainId) ||
    isUnichainChainId(chainId) ||
    isOptimismChainId(chainId)
  );
};
