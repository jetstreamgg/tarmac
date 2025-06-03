import { chainId } from './chainId';

export function getSafeTransactionLink(chainId: number, safeAddress: string, safeTxHash: string) {
  const prefix = getSafePrefix(chainId);
  return `https://app.safe.global/transactions/tx?safe=${prefix}:${safeAddress}&id=${safeTxHash}`;
}

function getSafePrefix(id: number) {
  switch (id) {
    case chainId.sepolia:
      return 'sep';
    case chainId.base:
    case chainId.tenderlyBase:
      return 'base';
    case chainId.arbitrum:
    case chainId.tenderlyArbitrum:
      return 'arb1';
    case chainId.optimism:
      return 'oeth';
    case chainId.unichain:
      return 'unichain';
    case chainId.mainnet:
    case chainId.tenderly:
    default:
      return 'eth';
  }
}
