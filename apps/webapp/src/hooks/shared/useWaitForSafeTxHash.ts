import { useMemo } from 'react';
import { useChainId } from 'wagmi';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Hash } from 'viem';
import { SAFE_TRANSACTION_SERVICE_URL } from './constants';
import {
  MAX_RETRY_DELAY_MS,
  TransactionReplacedError,
  TransactionRevertedError
} from './useOnChainTransactionOutcome';
import { useIsSafeApp } from '../wallet/useIsSafeApp';

const FAST_POLL_MS = 2_000;
/** Polls at the fast interval before the back-off starts: 5 minutes' worth. */
const FAST_POLLS = 150;
/** Looks in a row that must miss a once-seen transaction before it counts as deleted: 30 seconds' worth at the fast interval. */
const DELETED_AFTER_MISSES = 15;

/** A Safe transaction that can never execute: rejected, replaced, or deleted in the Safe queue. */
export class SafeTransactionRejectedError extends TransactionReplacedError {
  constructor() {
    super(new Error('Safe transaction rejected or replaced in the Safe queue.'));
  }
}

type Queued = { safe: string; nonce: string };

export type SafeTxResolution =
  /** `queued` once the service has shown the transaction waiting in the Safe's queue. */
  | { status: 'pending'; queued?: Queued; misses?: number }
  | { status: 'executed'; hash: Hash }
  /** Executed on-chain, but the Safe's inner call failed (`ExecutionFailure`). */
  | { status: 'reverted'; hash: Hash }
  /** Can never execute: rejected, replaced at its nonce, or deleted from the queue. */
  | { status: 'rejected' };

type ServiceTx = {
  safe: string;
  nonce: number | string;
  safeTxHash: string;
  transactionHash: Hash | null;
  isSuccessful: boolean | null;
};

/** `null` when the service has no record (404); throws on any other failure so the query retries. */
const fetchFromService = async <T>(url: string): Promise<T | null> => {
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Safe transaction service responded ${res.status}`);
  return (await res.json()) as T;
};

const settled = (tx: ServiceTx & { transactionHash: Hash }): SafeTxResolution =>
  tx.isSuccessful === false
    ? { status: 'reverted', hash: tx.transactionHash }
    : { status: 'executed', hash: tx.transactionHash };

const isExecuted = (tx: ServiceTx | undefined): tx is ServiceTx & { transactionHash: Hash } =>
  !!tx?.transactionHash;

/**
 * One look at where a safeTxHash stands, given the previous look.
 *
 * Until the service has shown the hash in a queue, a 404 is "not indexed yet":
 * the transaction was only just proposed, and the next look settles it.
 *
 * Once queued, each look reads every transaction at its nonce in one call. Ours
 * executed settles it. It is dead only on positive evidence: another
 * transaction executed at that nonce (an on-chain rejection or a replacement),
 * or ours gone from the service several looks running (deleted from the queue).
 * The Safe's nonce alone is not evidence: it moves before the service marks our
 * own execution.
 */
export async function resolveSafeTx({
  hash,
  serviceUrl,
  previous
}: {
  hash: Hash;
  serviceUrl: string;
  previous?: SafeTxResolution;
}): Promise<SafeTxResolution> {
  const queued = previous?.status === 'pending' ? previous.queued : undefined;

  if (!queued) {
    const tx = await fetchFromService<ServiceTx>(`${serviceUrl}/api/v1/multisig-transactions/${hash}/`);
    if (!tx) return { status: 'pending' };
    if (isExecuted(tx)) return settled(tx);
    return { status: 'pending', queued: { safe: tx.safe, nonce: String(tx.nonce) } };
  }

  const atNonce = await fetchFromService<{ results: ServiceTx[] }>(
    `${serviceUrl}/api/v1/safes/${queued.safe}/multisig-transactions/?nonce=${queued.nonce}`
  );
  const txs = atNonce?.results ?? [];
  const ours = txs.find(tx => tx.safeTxHash.toLowerCase() === hash.toLowerCase());
  if (isExecuted(ours)) return settled(ours);
  if (txs.some(tx => tx !== ours && isExecuted(tx))) return { status: 'rejected' };
  if (!ours) {
    // The nonce listing can leave out a transaction the service still has; only
    // a 404 on the transaction itself counts as gone.
    const own = await fetchFromService<ServiceTx>(`${serviceUrl}/api/v1/multisig-transactions/${hash}/`);
    if (own) return isExecuted(own) ? settled(own) : { status: 'pending', queued };
    const misses = (previous?.status === 'pending' ? (previous.misses ?? 0) : 0) + 1;
    return misses >= DELETED_AFTER_MISSES ? { status: 'rejected' } : { status: 'pending', queued, misses };
  }
  return { status: 'pending', queued };
}

/** Every 2s for the first 5 minutes, then backing off to the receipt watcher's ceiling. */
export const safePollDelay = (polls: number) =>
  polls < FAST_POLLS
    ? FAST_POLL_MS
    : Math.min(FAST_POLL_MS * 1.5 ** (polls - FAST_POLLS + 1), MAX_RETRY_DELAY_MS);

/**
 * Inside the Safe App iframe a write returns the safeTxHash, not an on-chain
 * hash; this turns it into the on-chain transaction hash. Keeps watching a
 * queued transaction for as long as the owners take, and reports one that was
 * rejected, replaced, deleted, or whose execution failed as `failure`.
 *
 * `isSafeApp` is returned so a caller selects between the two hashes exactly
 * the way the lookup was gated. Over WalletConnect the returned hash is used
 * as-is.
 */
export const useWaitForSafeTxHash = ({
  chainId: paramChainId,
  safeTxHash,
  sentAt
}: {
  chainId: number | undefined;
  safeTxHash: Hash | undefined;
  /** When the write that returned `safeTxHash` was sent. */
  sentAt: number | undefined;
}) => {
  const isSafeApp = useIsSafeApp();
  const queryClient = useQueryClient();
  const hookChainId = useChainId();
  const chainId = paramChainId || hookChainId;
  const serviceUrl: string | undefined = SAFE_TRANSACTION_SERVICE_URL[chainId];

  // A retry after a deletion from the queue returns the same safeTxHash, so
  // the hash alone would hand it the deleted transaction's outcome.
  const queryKey = ['safe-transaction-hash', safeTxHash, chainId, sentAt];
  const { data } = useQuery({
    enabled: !!safeTxHash && !!serviceUrl && isSafeApp,
    queryKey,
    queryFn: () =>
      resolveSafeTx({
        hash: safeTxHash!,
        serviceUrl: serviceUrl!,
        previous: queryClient.getQueryData<SafeTxResolution>(queryKey)
      }),
    refetchInterval: ({ state: { data, dataUpdateCount } }) => {
      if (data && data.status !== 'pending') return false;
      // Missing from the service: confirm the deletion at the fast interval, not the backed-off one.
      return data?.misses ? FAST_POLL_MS : safePollDelay(dataUpdateCount);
    },
    refetchIntervalInBackground: true,
    // Only the interval asks again: an outcome, once reported, must not change under the engines.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: true,
    retryDelay: attempt => Math.min(1000 * 2 ** attempt, MAX_RETRY_DELAY_MS)
  });

  const status = data?.status;
  // One error object per outcome: the engines key their settle effects on it.
  const failure = useMemo(() => {
    if (status === 'rejected') {
      return new SafeTransactionRejectedError();
    }
    return status === 'reverted' ? new TransactionRevertedError() : null;
  }, [status]);

  return {
    transactionHash: data?.status === 'executed' ? data.hash : undefined,
    failure,
    /** The on-chain hash of a failed execution; a rejection has none. */
    failureHash: data?.status === 'reverted' ? data.hash : undefined,
    isSafeApp
  };
};
