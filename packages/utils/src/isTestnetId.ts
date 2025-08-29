import { chainId as chainIdMap } from './chainId';

export const isTestnetId = (chainId: number): boolean => {
  return chainId === chainIdMap.sepolia || chainId === chainIdMap.tenderly;
};
