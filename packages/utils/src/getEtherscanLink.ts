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
      return 'dashboard.tenderly.co/explorer/vnet/b333d3ac-c24f-41fa-ad41-9176fa719ac3';
    case chainId.tenderlyBase:
      return 'dashboard.tenderly.co/explorer/vnet/376e4980-c2de-48b9-bf76-c25bd6d1c324';
    case chainId.tenderlyArbitrum:
      return 'dashboard.tenderly.co/explorer/vnet/f60eedf8-6aa3-45a5-86c3-f001eab2da50';
    default:
      return 'etherscan.io';
  }
}
