import { useState } from 'react';
import type { Hash } from 'viem';
import { useTransactionOutcome } from './useTransactionOutcome';
import { useWaitForSafeTxHash } from './useWaitForSafeTxHash';

/**
 * The outcome of a write, from the hash the wallet returned for it.
 *
 * For most wallets that hash is the transaction's. A Safe returns a safeTxHash
 * while its owners still have to sign, so the on-chain hash only exists once
 * they execute it, and the write can also end in the Safe's queue without ever
 * reaching the chain.
 */
export function useSentTransactionOutcome({ hash, chainId }: { hash?: Hash; chainId?: number }) {
  const {
    transactionHash: safeExecutedHash,
    failure: safeFailure,
    failureHash: safeFailureHash,
    isSafeWallet: probeSaysSafe,
    chainId: safeChainId
  } = useWaitForSafeTxHash({ chainId, safeTxHash: hash });

  // A late Safe probe must not reopen an outcome already reported on the returned hash.
  const [settledAsPlain, setSettledAsPlain] = useState<Hash>();
  const isSafeWallet = probeSaysSafe && !(hash && settledAsPlain === hash);

  const txHash = isSafeWallet ? safeExecutedHash : hash;
  const {
    isPending: isMining,
    isSuccess,
    failure: txFailure,
    receipt
  } = useTransactionOutcome({
    hash: txHash,
    chainId: isSafeWallet ? safeChainId : chainId
  });
  if (hash && !isSafeWallet && (isSuccess || txFailure) && settledAsPlain !== hash) {
    setSettledAsPlain(hash);
  }

  const failure = (isSafeWallet ? safeFailure : null) ?? txFailure;
  return {
    /** The on-chain hash, once there is one. */
    txHash,
    /**
     * The hash an outcome is reported on: the on-chain one, or for a Safe
     * transaction that ended in the queue, the hash the Safe returned.
     */
    settleHash: isSafeWallet && safeFailure ? (safeFailureHash ?? hash) : txHash,
    isMining,
    /** Sent, with no outcome yet: mining, or waiting on a Safe's co-signers. */
    isAwaitingOutcome: !!hash && !isSuccess && !failure,
    isSuccess: isSuccess && !(isSafeWallet && safeFailure),
    failure,
    receipt
  };
}
