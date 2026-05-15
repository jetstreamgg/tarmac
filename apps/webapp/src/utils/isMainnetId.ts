import { chainId as chainIdMap } from './chainId';

export const isMainnetId = (chainId: number) => {
  return chainId === chainIdMap.mainnet || chainId === chainIdMap.tenderly;
};
