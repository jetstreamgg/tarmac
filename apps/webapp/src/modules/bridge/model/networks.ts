import { forkL2ChainIds } from '@/data/wagmi/config/forkChains';
import { chainId as chainIdMap, forkChainId, isForkChainId, realChainId } from '@/utils/chainId';

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

/** The bridge network for a wallet chain; a Tenderly fork reads as the network it stands in for. */
export const bridgeNetworkForChainId = (chainId: number | undefined): BridgeNetworkId | undefined =>
  chainId === undefined
    ? undefined
    : BRIDGE_NETWORKS.find(
        network => network.chainId !== undefined && network.chainId === realChainId(chainId)
      )?.id;

/**
 * The chain a bridge transacts on for a network; Ethereum is the family's (mainnet or the Tenderly fork).
 * In the fork family with fork L2s, an L2 is its fork L2, or none when the dev build lacks it (never production).
 */
export const bridgeChainId = (
  network: BridgeNetworkId,
  familyChainId: number,
  forkL2Ids: number[] = forkL2ChainIds
): number | undefined => {
  if (network === 'ethereum') return familyChainId;
  if (familyChainId !== chainIdMap.tenderly || forkL2Ids.length === 0)
    return getBridgeNetwork(network).chainId;
  const forkId: number | undefined = forkChainId[network as keyof typeof forkChainId];
  return forkId !== undefined && forkL2Ids.includes(forkId) ? forkId : undefined;
};

/**
 * The chain the wallet switches to when `network` becomes the bridge source: the family's chain in the
 * Tenderly multichain setup, the production chain otherwise (the mock wallet build has no mainnet, so an
 * Ethereum source stays a local pick until Review).
 */
export const sourceSwitchChainId = (
  network: BridgeNetworkId,
  familyChainId: number,
  forkL2Ids: number[] = forkL2ChainIds
): number | undefined =>
  forkL2Ids.length > 0 ? bridgeChainId(network, familyChainId, forkL2Ids) : getBridgeNetwork(network).chainId;

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
  const forkL2Ids = chainIds.filter(id => id !== chainIdMap.tenderly && isForkChainId(id));
  const target = bridgeChainId(network, familyChainId, forkL2Ids);
  return target !== undefined && chainIds.includes(target) ? target : undefined;
}
