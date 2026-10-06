import { chainId as chainIdMap } from '@/utils/chainId';

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

/** The bridge network for a wallet chain; the Tenderly fork reads as Ethereum. */
export const bridgeNetworkForChainId = (chainId: number | undefined): BridgeNetworkId | undefined =>
  chainId === chainIdMap.tenderly
    ? 'ethereum'
    : BRIDGE_NETWORKS.find(network => network.chainId !== undefined && network.chainId === chainId)?.id;

/** The chain a bridge transacts on for a network; Ethereum is the family's (mainnet or the Tenderly fork). */
export const bridgeChainId = (network: BridgeNetworkId, familyChainId: number): number | undefined =>
  network === 'ethereum' ? familyChainId : getBridgeNetwork(network).chainId;
