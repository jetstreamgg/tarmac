import type { Hash } from 'viem';
import { useOnChainTransactionOutcome } from './useOnChainTransactionOutcome';
import { useWaitForSafeTxHash } from './useWaitForSafeTxHash';

/**
 * The outcome of a write, from the hash the wallet returned for it.
 *
 * For most wallets that hash is the transaction's. Inside the Safe App it is a
 * safeTxHash, so the on-chain hash only exists once the owners execute it, and
 * the write can also end in the Safe's queue without ever reaching the chain.
 */
export function useSentTransactionOutcome({ sentHash, chainId }: { sentHash?: Hash; chainId?: number }) {
  const {
    transactionHash: safeExecutedHash,
    failure: safeFailure,
    failureHash: safeFailureHash,
    isSafeApp
  } = useWaitForSafeTxHash({ chainId, safeTxHash: sentHash });

  const txHash = isSafeApp ? safeExecutedHash : sentHash;
  const {
    isPending: isMining,
    isSuccess,
    failure: txFailure,
    receipt
  } = useOnChainTransactionOutcome({ txHash, chainId });

  const failure = (isSafeApp ? safeFailure : null) ?? txFailure;
  return {
    /** The on-chain hash, once there is one. */
    txHash,
    /**
     * The hash an outcome is reported on: the on-chain one, or for a Safe
     * transaction that ended in the queue, the hash the Safe returned.
     */
    settleHash: isSafeApp && safeFailure ? (safeFailureHash ?? sentHash) : txHash,
    isMining,
    /** Sent, with no outcome yet: mining, or waiting on a Safe's co-signers. */
    isAwaitingOutcome: !!sentHash && !isSuccess && !failure,
    isSuccess: isSuccess && !(isSafeApp && safeFailure),
    failure,
    receipt
  };
}
