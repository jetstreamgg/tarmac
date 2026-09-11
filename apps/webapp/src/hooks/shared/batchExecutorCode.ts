import type { Hex, PublicClient } from 'viem';
import { BATCH_EXECUTOR_ADDRESS } from './networkFee';

/**
 * Runtime code of the stand-in batch executor (the canonical Multicall3), read from the
 * chain once per chain and kept for the session — it is immutable, and both the bundled
 * fee estimate and the pre-send simulation override it in at the user's address. Only
 * the address is pinned in the repo; the bytes come from the deployment itself.
 *
 * Resolves `undefined` on a chain where nothing is deployed at the canonical address.
 */
const cache = new Map<number, Promise<Hex | undefined>>();

export function getBatchExecutorCode(client: PublicClient, chainId: number): Promise<Hex | undefined> {
  const cached = cache.get(chainId);
  if (cached) return cached;

  const pending = client.getCode({ address: BATCH_EXECUTOR_ADDRESS }).catch((error: unknown) => {
    // Don't poison the cache — a transient RPC failure shouldn't disable bundling for
    // the rest of the session.
    cache.delete(chainId);
    throw error;
  });
  cache.set(chainId, pending);
  return pending;
}

/** Test seam. */
export function resetBatchExecutorCodeCache(): void {
  cache.clear();
}
