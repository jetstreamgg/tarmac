import type { Hash } from 'viem';
import { useOnChainTransactionOutcome } from './useOnChainTransactionOutcome';
import { useWaitForSafeTxHash } from './useWaitForSafeTxHash';

/**
 * The outcome of a write, from the hash the wallet returned for it.
 *
 * For most wallets that hash is the transaction's. A Safe returns a safeTxHash
 * while its owners still have to sign, so the on-chain hash only exists once
 * they execute it, and the write can also end in the Safe's queue without ever
 * reaching the chain. Only the Safe App's is resolved here; over WalletConnect
 * the returned hash is used as-is.
 */
export function useSentTransactionOutcome({
  sentHash,
  sentAt,
  chainId
}: {
  sentHash?: Hash;
  /** When the write that returned `sentHash` was sent. */
  sentAt?: number;
  chainId?: number;
}) {
  const {
    transactionHash: safeExecutedHash,
    failure: safeFailure,
    failureHash: safeFailureHash,
    isSafeApp
  } = useWaitForSafeTxHash({ chainId, safeTxHash: sentHash, sentAt });

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
