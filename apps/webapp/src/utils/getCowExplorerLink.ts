import { chainId } from './chainId';

export function getCowExplorerLink(chainId: number, orderId: string) {
  const prefix = getCowPrefix(chainId);
  return `https://${prefix}/orders/${orderId}`;
}

function getCowPrefix(id: number) {
  switch (id) {
    case chainId.base:
      return 'explorer.cow.fi/base';
    case chainId.arbitrum:
      return 'explorer.cow.fi/arb1';
    case chainId.mainnet:
    default:
      return 'explorer.cow.fi';
  }
}
