import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useConfig } from 'wagmi';
import { getPublicClient } from '@wagmi/core';
import {
  UserRejectedRequestError,
  type Hash,
  type ReplacementReturnType,
  type TransactionReceipt
} from 'viem';
import { waitForTransactionReceipt } from 'viem/actions';

/** Ceiling on the gap between attempts while the RPC keeps failing. */
const MAX_RETRY_DELAY_MS = 30_000;

type ReceiptResult = { receipt: TransactionReceipt; replacement?: ReplacementReturnType };

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
 */
export function useTransactionReceipt({ hash, chainId }: { hash?: Hash; chainId?: number }) {
  const config = useConfig();
  const { data, isSuccess: settled } = useQuery<ReceiptResult>({
    queryKey: ['transactionReceipt', chainId, hash],
    enabled: !!hash,
    queryFn: async () => {
      const client = getPublicClient(config, { chainId });
      if (!client) throw new Error(`No client for chain ${chainId}`);
      let replacement: ReplacementReturnType | undefined;
      const receipt = await waitForTransactionReceipt(client, {
        hash: hash!,
        timeout: 0,
        onReplaced: r => (replacement = r)
      });
      return { receipt, replacement };
    },
    retry: true,
    retryDelay: attempt => Math.min(1000 * 2 ** attempt, MAX_RETRY_DELAY_MS),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  });

  // One error object per outcome: the engines key their settle effects on it.
  const failure = useMemo(() => {
    if (!data) return null;
    if (data.replacement && data.replacement.reason !== 'repriced') {
      return new UserRejectedRequestError(new Error(`Transaction ${data.replacement.reason} in the wallet.`));
    }
    return data.receipt.status === 'reverted' ? new Error('Transaction reverted on-chain.') : null;
  }, [data]);

  return {
    isPending: !!hash && !settled,
    isSuccess: settled && !failure,
    failure
  } satisfies TransactionReceiptState;
}
