import type { Hash } from 'viem';
import { useOnChainTransactionOutcome } from './useOnChainTransactionOutcome';
import { useWaitForSafeTxHash } from './useWaitForSafeTxHash';

/**
 * The outcome of a write, from the hash the wallet returned for it.
 *
 * For most wallets that hash is the transaction's. A Safe returns a safeTxHash
 * while its owners still have to sign, and the on-chain hash only exists once
 * they execute it. Only the Safe App's is resolved here; over WalletConnect the
 * returned hash is used as-is.
 */
export function useSentTransactionOutcome({ sentHash, chainId }: { sentHash?: Hash; chainId?: number }) {
  const { transactionHash: safeExecutedHash, isSafeApp } = useWaitForSafeTxHash({
    chainId,
    safeTxHash: sentHash
  });

  const txHash = isSafeApp ? safeExecutedHash : sentHash;
  const {
    isPending: isMining,
    isSuccess,
    failure,
    receipt
  } = useOnChainTransactionOutcome({ txHash, chainId });

  return {
    /** The on-chain hash, once there is one. */
    txHash,
    isMining,
    /** Sent, with no outcome yet: mining, or waiting on the Safe to execute. */
    isAwaitingOutcome: !!sentHash && !isSuccess && !failure,
    isSuccess,
    failure,
    receipt
  };
}
