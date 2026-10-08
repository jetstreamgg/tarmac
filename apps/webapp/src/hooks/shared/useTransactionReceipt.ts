import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useChainId, useConfig } from 'wagmi';
import { getPublicClient } from '@wagmi/core';
import {
  UserRejectedRequestError,
  WaitForTransactionReceiptTimeoutError,
  type Hash,
  type ReplacementReturnType,
  type TransactionReceipt
} from 'viem';
import { waitForTransactionReceipt } from 'viem/actions';

/** Ceiling on the gap between attempts while the RPC keeps failing. */
const MAX_RETRY_DELAY_MS = 30_000;
/**
 * Longest single attempt. Attempts repeat for as long as the hash is watched;
 * bounding each one is what lets a watch that nobody observes any more end
 * (TanStack stops retrying, but can't stop viem's poller mid-attempt).
 */
const ATTEMPT_TIMEOUT_MS = 60_000;

type ReceiptResult = { receipt: TransactionReceipt; replacement?: ReplacementReturnType };

/**
 * A broadcast transaction the user replaced in their wallet: a cancel, or
 * another transaction at its nonce. A wallet rejection (code 4001) for the modal
 * and Sentry, but it carries a hash, so the analytics classifier recognises it
 * by class rather than by the usual "rejections never have a hash" rule.
 */
export class TransactionReplacedError extends UserRejectedRequestError {
  override name = 'TransactionReplacedError' as const;
}

export type TransactionReceiptState = {
  /** A hash is being watched and has no outcome yet, including while the RPC is failing. */
  isPending: boolean;
  isSuccess: boolean;
  /**
   * The outcome when it isn't a success: a revert, or the transaction replaced
   * in the wallet by something other than a speed-up. A replacement surfaces as
   * a `UserRejectedRequestError`: the user took it back, like declining a prompt.
   */
  failure: Error | null;
  /** The mined receipt once settled; a speed-up's own receipt when it was repriced. */
  receipt?: TransactionReceipt;
};

/**
 * Watches a broadcast transaction until the chain gives a verdict.
 *
 * Unlike wagmi's `useWaitForTransactionReceipt`, an error while watching never
 * becomes the outcome. The transaction is out there whatever the RPC says, so
 * a failed poll means "not known yet": reporting it as a failure put Retry on
 * screen, and Retry signs the same action a second time. The outcome comes from
 * the receipt itself (`status`), not from replaying the call and reading the
 * error text. A speed-up counts as the same transaction; a cancel or any other
 * replacement does not, though its receipt reads `success`.
 *
 * The chain is fixed when a hash first appears: the wallet can switch chains
 * while the transaction is pending, and the hash only exists on the chain it
 * was sent to.
 */
export function useTransactionReceipt({ hash, chainId }: { hash?: Hash; chainId?: number }) {
  const config = useConfig();
  const currentChainId = useChainId();
  const sendChainId = chainId ?? currentChainId;
  const [watched, setWatched] = useState<{ hash?: Hash; chainId: number }>({ chainId: sendChainId });
  if (hash !== watched.hash) setWatched({ hash, chainId: sendChainId });
  const watchChainId = hash === watched.hash ? watched.chainId : sendChainId;

  const { data, isSuccess: settled } = useQuery<ReceiptResult>({
    queryKey: ['transactionReceipt', watchChainId, hash],
    enabled: !!hash,
    queryFn: async () => {
      const client = getPublicClient(config, { chainId: watchChainId });
      if (!client) throw new Error(`No client for chain ${watchChainId}`);
      let replacement: ReplacementReturnType | undefined;
      const receipt = await waitForTransactionReceipt(client, {
        hash: hash!,
        timeout: ATTEMPT_TIMEOUT_MS,
        onReplaced: r => (replacement = r)
      });
      return { receipt, replacement };
    },
    // Unlimited while watched; TanStack stops retrying once nothing observes the query.
    retry: true,
    // An attempt that simply ran out of time continues at once; an RPC failure backs off.
    retryDelay: (attempt, error) =>
      error instanceof WaitForTransactionReceiptTimeoutError
        ? 0
        : Math.min(1000 * 2 ** attempt, MAX_RETRY_DELAY_MS),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  });

  // One error object per outcome: the engines key their settle effects on it.
  const failure = useMemo(() => {
    if (!data) return null;
    if (data.replacement && data.replacement.reason !== 'repriced') {
      return new TransactionReplacedError(new Error(`Transaction ${data.replacement.reason} in the wallet.`));
    }
    return data.receipt.status === 'reverted' ? new Error('Transaction reverted on-chain.') : null;
  }, [data]);

  return {
    isPending: !!hash && !settled,
    isSuccess: settled && !failure,
    failure,
    receipt: data?.receipt
  } satisfies TransactionReceiptState;
}
