import { chainId as chainIdMap, l2TestnetChainId } from '@/utils/chainId';
import { canonicalChainId } from '@/utils/isTestnetId';

export type BridgeNetworkId =
  'ethereum' | 'base' | 'arbitrum' | 'optimism' | 'unichain' | 'avalanche' | 'solana';

export type BridgeNetwork = {
  id: BridgeNetworkId;
  name: string;
  /** EVM chain id; undefined for Solana. */
  chainId?: number;
  family: 'evm' | 'solana';
  /** Whether the rest of the app runs on this network (wallet switches on select). */
  appSupported: boolean;
};

export const AVALANCHE_CHAIN_ID = 43114;

// Dropdown order follows the Figma network menu (3574:64008), with the
// LayerZero-only networks appended.
export const BRIDGE_NETWORKS: BridgeNetwork[] = [
  { id: 'ethereum', name: 'Ethereum', chainId: chainIdMap.mainnet, family: 'evm', appSupported: true },
  { id: 'base', name: 'Base', chainId: chainIdMap.base, family: 'evm', appSupported: true },
  { id: 'arbitrum', name: 'Arbitrum One', chainId: chainIdMap.arbitrum, family: 'evm', appSupported: true },
  { id: 'optimism', name: 'OP Mainnet', chainId: chainIdMap.optimism, family: 'evm', appSupported: true },
  { id: 'unichain', name: 'Unichain', chainId: chainIdMap.unichain, family: 'evm', appSupported: true },
  { id: 'avalanche', name: 'Avalanche', chainId: AVALANCHE_CHAIN_ID, family: 'evm', appSupported: false },
  { id: 'solana', name: 'Solana', family: 'solana', appSupported: false }
];

export const getBridgeNetwork = (id: BridgeNetworkId): BridgeNetwork =>
  BRIDGE_NETWORKS.find(network => network.id === id) as BridgeNetwork;

/** The bridge network for a wallet chain; the Tenderly fork reads as Ethereum and its L2 testnets as their L2. */
export const bridgeNetworkForChainId = (chainId: number | undefined): BridgeNetworkId | undefined => {
  if (chainId === chainIdMap.tenderly) return 'ethereum';
  const canonical = chainId === undefined ? undefined : canonicalChainId(chainId);
  return BRIDGE_NETWORKS.find(network => network.chainId !== undefined && network.chainId === canonical)?.id;
};

/**
 * Whether the family's L2s are the Tenderly testnets: with the Tenderly fork,
 * outside the mock wallet build, whose L2 forks keep their real ids.
 */
export const usesL2Testnets = (familyChainId: number): boolean =>
  familyChainId === chainIdMap.tenderly && import.meta.env.VITE_USE_MOCK_WALLET !== 'true';

/**
 * The chain a bridge transacts on for a network. Ethereum is the family's
 * (mainnet or the Tenderly fork); with the Tenderly fork, an L2 is its testnet.
 */
export const bridgeChainId = (network: BridgeNetworkId, familyChainId: number): number | undefined => {
  if (network === 'ethereum') return familyChainId;
  const chainId = getBridgeNetwork(network).chainId;
  return chainId !== undefined && usesL2Testnets(familyChainId)
    ? (l2TestnetChainId[chainId] ?? chainId)
    : chainId;
};

/** The chain a flow on `network` is pinned to; undefined when the app can't switch to it, so nothing runs elsewhere. */
export function guardChainId({
  network,
  familyChainId,
  chainIds
}: {
  network: BridgeNetworkId;
  familyChainId: number;
  chainIds: number[];
}): number | undefined {
  const target = bridgeChainId(network, familyChainId);
  return target !== undefined && chainIds.includes(target) ? target : undefined;
}
