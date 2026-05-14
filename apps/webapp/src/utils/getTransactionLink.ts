import { getEtherscanLink } from './getEtherscanLink';
import { getSafeTransactionLink } from './getSafeTransactionLink';

export function getTransactionLink(
  chainId: number,
  connectedAddress: string | undefined,
  txHash: string,
  isSafeWallet: boolean
) {
  return isSafeWallet && connectedAddress
    ? getSafeTransactionLink(chainId, connectedAddress, txHash)
    : getEtherscanLink(chainId, txHash, 'tx');
}
