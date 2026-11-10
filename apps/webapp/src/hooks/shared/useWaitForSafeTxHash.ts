import { useMemo, useState } from 'react';
import { useChainId, useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Hash } from 'viem';
import { SAFE_TRANSACTION_SERVICE_URL } from './constants';
import {
  MAX_RETRY_DELAY_MS,
  TransactionReplacedError,
  TransactionRevertedError
} from './useTransactionOutcome';
import { useIsSafeWallet } from '../wallet/useIsSafeWallet';

const FAST_POLL_MS = 2_000;
/** Polls at the fast interval before the back-off starts: 5 minutes' worth. */
const FAST_POLLS = 150;
/** Looks in a row that must miss a once-seen transaction before it counts as deleted. */
const DELETED_AFTER_MISSES = 3;

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
 * One look at where a hash returned by a Safe stands, given the previous look.
 *
 * A Safe returns the on-chain hash when it executed straight away (a 1-of-1
 * over WalletConnect) and the safeTxHash when the transaction was queued for
 * more signatures (always, inside the Safe App). Until the service has shown
 * the hash in a queue, a hash our RPC knows is the on-chain one, and a 404 from
 * the service is "not indexed yet": it covers a freshly queued safeTxHash and an
 * on-chain hash our RPC hasn't seen, and the next look settles either.
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
  isOnChain,
  previous
}: {
  hash: Hash;
  serviceUrl: string | undefined;
  isOnChain: (hash: Hash) => Promise<boolean>;
  previous?: SafeTxResolution;
}): Promise<SafeTxResolution> {
  const queued = previous?.status === 'pending' ? previous.queued : undefined;

  if (!queued) {
    if (await isOnChain(hash)) return { status: 'executed', hash };
    // No service for this chain: the returned hash is all there is to watch.
    if (!serviceUrl) return { status: 'executed', hash };

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
 * Turns the hash a Safe returns into the on-chain transaction hash, for any
 * Safe account: the Safe App iframe or a Safe over WalletConnect. Keeps
 * watching a queued transaction for as long as the owners take, and reports one
 * that was rejected, replaced, deleted, or whose execution failed as `failure`.
 *
 * `isSafeWallet` is returned so a caller selects between the two hashes
 * exactly the way the lookup was gated.
 *
 * The chain, and that the account is a Safe, are fixed when a hash first
 * appears: the wallet can move chains while co-signers take their time, and
 * the transaction only exists in the queue of the chain it was sent on.
 */
export const useWaitForSafeTxHash = ({
  chainId: paramChainId,
  safeTxHash
}: {
  chainId: number | undefined;
  safeTxHash: Hash | undefined;
}) => {
  const liveIsSafeWallet = useIsSafeWallet();
  const config = useConfig();
  const queryClient = useQueryClient();
  const hookChainId = useChainId();
  const liveChainId = paramChainId || hookChainId;

  const [watched, setWatched] = useState<{ hash?: Hash; chainId: number; isSafe: boolean }>({
    chainId: liveChainId,
    isSafe: false
  });
  if (safeTxHash !== watched.hash) {
    setWatched({ hash: safeTxHash, chainId: liveChainId, isSafe: liveIsSafeWallet });
  } else if (safeTxHash && liveIsSafeWallet && !watched.isSafe) {
    // The Safe probe can answer after the hash arrives.
    setWatched({ ...watched, isSafe: true });
  }
  const pinned = !!safeTxHash && safeTxHash === watched.hash;
  const chainId = pinned ? watched.chainId : liveChainId;
  const isSafeWallet = pinned ? watched.isSafe || liveIsSafeWallet : liveIsSafeWallet;
  const serviceUrl = SAFE_TRANSACTION_SERVICE_URL[chainId];

  const queryKey = ['safe-transaction-hash', safeTxHash, chainId];
  const { data } = useQuery({
    enabled: !!safeTxHash && isSafeWallet,
    queryKey,
    queryFn: () =>
      resolveSafeTx({
        hash: safeTxHash!,
        serviceUrl,
        previous: queryClient.getQueryData<SafeTxResolution>(queryKey),
        isOnChain: async hash => {
          const client = getPublicClient(config, { chainId });
          // Not found, or the RPC failing: either way the service is the next place to look.
          return !!(await client?.getTransaction({ hash }).catch(() => null));
        }
      }),
    refetchInterval: query =>
      query.state.data && query.state.data.status !== 'pending'
        ? false
        : safePollDelay(query.state.dataUpdateCount),
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
      return new TransactionReplacedError(
        new Error('Safe transaction rejected or replaced in the Safe queue.')
      );
    }
    return status === 'reverted' ? new TransactionRevertedError() : null;
  }, [status]);

  return {
    transactionHash: data?.status === 'executed' ? data.hash : undefined,
    failure,
    /** The on-chain hash of a failed execution; a rejection has none. */
    failureHash: data?.status === 'reverted' ? data.hash : undefined,
    isSafeWallet,
    /** The chain the transaction was sent on, where its on-chain hash must be watched. */
    chainId
  };
};
