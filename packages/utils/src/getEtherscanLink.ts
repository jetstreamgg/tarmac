import { chainId } from './chainId';

export function getEtherscanLink(chainId: number, address: string, type: 'address' | 'tx') {
  const prefix = getEtherscanPrefix(chainId);
  return `https://${prefix}/${type}/${address}`;
}

function getEtherscanPrefix(id: number) {
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
