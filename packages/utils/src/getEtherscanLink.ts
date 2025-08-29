import { chainId } from './chainId';

export function getEtherscanLink(chainId: number, address: string, type: 'address' | 'tx') {
  const prefix = getEtherscanPrefix(chainId);
  return `https://${prefix}/${type}/${address}`;
}

function getEtherscanPrefix(id: number) {
  switch (id) {
    case chainId.mainnet:
      return 'etherscan.io';
    case chainId.sepolia:
      return 'sepolia.etherscan.io';
    case chainId.base:
      return 'basescan.org';
    case chainId.arbitrum:
      return 'arbiscan.io';
    case chainId.tenderly:
      return 'dashboard.tenderly.co/pullup-labs/endgame-0/testnet/8514b732-76e6-4024-9f3f-37ccd12d5e9a';
    case chainId.optimism:
      return 'optimistic.etherscan.io';
    case chainId.unichain:
      return 'uniscan.xyz';
    default:
      return 'etherscan.io';
  }
}
