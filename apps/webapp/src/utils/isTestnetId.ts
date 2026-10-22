import { chainId as chainIdMap, l2TestnetChainId } from './chainId';

export const isTestnetId = (chainId: number): boolean => {
  return chainId === chainIdMap.tenderly;
};

const L2_TESTNET_IDS = Object.values(l2TestnetChainId);

/** One of the bridge's Tenderly testnets of an L2. Only the Bridge tab runs on them. */
export const isL2TestnetId = (chainId: number): boolean => L2_TESTNET_IDS.includes(chainId);

/** The real chain a bridge L2 testnet forks, for address and token lookups; any other id maps to itself. */
export const canonicalChainId = (chainId: number): number =>
  Number(Object.entries(l2TestnetChainId).find(([, testnetId]) => testnetId === chainId)?.[0] ?? chainId);

/**
 * The chain filling the family's Ethereum role: the Tenderly fork when
 * connected to it or to one of its L2 testnets, mainnet otherwise. Single-chain products and the
 * mainnet-anchored indexer/history reads all run there. The mock wallet
 * build configures only the Tenderly forks, its L2s under their real ids.
 */
export const familyMainnetId = (connectedChainId: number) =>
  isTestnetId(connectedChainId) ||
  isL2TestnetId(connectedChainId) ||
  import.meta.env.VITE_USE_MOCK_WALLET === 'true'
    ? chainIdMap.tenderly
    : chainIdMap.mainnet;
