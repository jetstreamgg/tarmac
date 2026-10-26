import { chainId, forkChainId, isForkChainId } from './chainId';

export function getEtherscanLink(chainId: number, address: string, type: 'address' | 'tx') {
  const prefix = getEtherscanPrefix(chainId);
  return `https://${prefix}/${type}/${address}`;
}

/** Like getEtherscanLink, but no link for a fork L2 whose Tenderly explorer isn't set: Etherscan doesn't know its txs. */
export function getExplorerLink(id: number, address: string, type: 'address' | 'tx'): string | undefined {
  if (id !== chainId.tenderly && isForkChainId(id) && !tenderlyExplorer(id)) return undefined;
  return getEtherscanLink(id, address, type);
}

// Dev only: the Tenderly multichain environment's explorer of each fork, from the local .env.
const tenderlyExplorer = (id: number): string | undefined =>
  ({
    [chainId.tenderly]: import.meta.env?.VITE_TENDERLY_EXPLORER_ETHEREUM,
    [forkChainId.base]: import.meta.env?.VITE_TENDERLY_EXPLORER_BASE,
    [forkChainId.arbitrum]: import.meta.env?.VITE_TENDERLY_EXPLORER_ARBITRUM,
    [forkChainId.optimism]: import.meta.env?.VITE_TENDERLY_EXPLORER_OPTIMISM,
    [forkChainId.unichain]: import.meta.env?.VITE_TENDERLY_EXPLORER_UNICHAIN
  })[id];

function getEtherscanPrefix(id: number) {
  const forkExplorer = tenderlyExplorer(id);
  if (forkExplorer) return forkExplorer;
  switch (id) {
    case chainId.mainnet:
      return 'etherscan.io';
    case chainId.base:
      return 'basescan.org';
    case chainId.arbitrum:
      return 'arbiscan.io';
    case chainId.tenderly:
      return 'dashboard.tenderly.co/jetstreamgg/jetstream/testnet/bcd8c01a-253a-4513-ba33-2c1329ff1237';
    case chainId.optimism:
      return 'optimistic.etherscan.io';
    case chainId.unichain:
      return 'uniscan.xyz';
    default:
      return 'etherscan.io';
  }
}
