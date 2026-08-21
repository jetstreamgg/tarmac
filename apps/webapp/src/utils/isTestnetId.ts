import { chainId as chainIdMap } from './chainId';

export const isTestnetId = (chainId: number): boolean => {
  return chainId === chainIdMap.tenderly;
};

/**
 * The chain filling the family's Ethereum role: the Tenderly fork when
 * connected to it, mainnet otherwise. Single-chain products and the
 * mainnet-anchored indexer/history reads all run there.
 */
export const familyMainnetId = (connectedChainId: number) =>
  isTestnetId(connectedChainId) ? chainIdMap.tenderly : chainIdMap.mainnet;
