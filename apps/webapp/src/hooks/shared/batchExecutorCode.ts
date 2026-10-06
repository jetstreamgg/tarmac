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
 * nothing at the address (not when its read fails). Resolves `undefined` when no chain does.
 */
let cached: Promise<Hex | undefined> | undefined;

export function getBatchExecutorCode(
  client: PublicClient,
  fallbackClients: readonly PublicClient[] = []
): Promise<Hex | undefined> {
  if (cached) return cached;

  // Callers that arrive while the read is in flight (the fee estimate and the simulation
  // both start on modal open) share it, so they all see the same answer: the code, a
  // miss (`undefined`) or the read's failure.
  const pending = readFromFirstDeployment([client, ...fallbackClients]);
  cached = pending;
  // Only a found deployment is worth keeping. Don't poison the cache with a miss or a
  // transient RPC failure — the next simulation gets to try again.
  const forget = () => {
    if (cached === pending) cached = undefined;
  };
  pending.then(code => {
    if (code === undefined) forget();
  }, forget);
  return pending;
}

async function readFromFirstDeployment(clients: readonly PublicClient[]): Promise<Hex | undefined> {
  let firstFailure: unknown;
  for (const [index, client] of clients.entries()) {
    try {
      const code = await client.getCode({ address: BATCH_EXECUTOR_ADDRESS });
      if (code && code !== '0x') return code;
    } catch (error) {
      // The chain at hand is the one the simulation runs on: if its RPC can't answer
      // this, it can't answer the simulation either. Fail now and let the retry ask
      // again, rather than walk every other chain on each attempt of an outage.
      if (index === 0) throw error;
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
