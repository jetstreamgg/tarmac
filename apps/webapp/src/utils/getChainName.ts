import { chainId as chainIdMap } from './chainId';

/**
 * Human-readable chain name for the network badge, mirroring `getChainIcon`'s
 * per-chain switch. These are protocol proper nouns (data, not UI copy), so
 * they are intentionally not Lingui-wrapped — same convention as the icon map.
 */
export const getChainName = (id: number): string =>
  id === chainIdMap.base
    ? 'Base'
    : id === chainIdMap.arbitrum
      ? 'Arbitrum'
      : id === chainIdMap.optimism
        ? 'Optimism'
        : id === chainIdMap.unichain
          ? 'Unichain'
          : 'Ethereum';
