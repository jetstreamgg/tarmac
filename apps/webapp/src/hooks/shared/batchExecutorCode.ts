import type { Hex, PublicClient } from 'viem';
import { BATCH_EXECUTOR_ADDRESS } from './networkFee';

/**
 * Runtime code of the stand-in batch executor (the canonical Multicall3). Both the bundled
 * fee estimate and the pre-send simulation override it in at the user's address, so it
 * only ever runs inside a simulation — nothing about the real send depends on it being
 * deployed on the chain in question. Only the address is pinned in the repo; the bytes
 * come from a deployment.
 *
 * The bytes are the same on every chain (a deterministic CREATE2 deployment), so they are
 * read once per session: from the chain at hand first, so chains stay independent of one
 * another in the normal case, and from the other configured chains only when that one has
 * nothing at the address. Resolves `undefined` when no chain does.
 */
let cached: Promise<Hex> | undefined;

export function getBatchExecutorCode(
  client: PublicClient,
  fallbackClients: readonly PublicClient[] = []
): Promise<Hex | undefined> {
  if (cached) return cached;

  const pending = readFromFirstDeployment([client, ...fallbackClients]);
  cached = pending.then(code => {
    // Only a found deployment is worth keeping. Don't poison the cache with a miss or a
    // transient RPC failure — the next simulation gets to try again.
    if (code === undefined) throw new Error('not found');
    return code;
  });
  cached.catch(() => {
    cached = undefined;
  });
  return pending;
}

async function readFromFirstDeployment(clients: readonly PublicClient[]): Promise<Hex | undefined> {
  let firstFailure: unknown;
  for (const client of clients) {
    try {
      const code = await client.getCode({ address: BATCH_EXECUTOR_ADDRESS });
      if (code && code !== '0x') return code;
    } catch (error) {
      firstFailure ??= error;
    }
  }
  // Nothing deployed anywhere we could reach. If a read failed along the way, that is
  // the more likely explanation than every chain lacking Multicall3.
  if (firstFailure !== undefined) throw firstFailure;
  return undefined;
}

/** Test seam. */
export function resetBatchExecutorCodeCache(): void {
  cached = undefined;
}
