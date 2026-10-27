import type { Hash, PublicClient } from 'viem';
import { decodeRevert, type DecodedRevert } from '@/lib/revertMessages/decodeRevert';

/** How long the replay may hold up the failure screen before it gives up. */
const REPLAY_TIMEOUT_MS = 8_000;

/**
 * Why a mined transaction reverted. The receipt only says that it did, so the
 * transaction is replayed as an `eth_call` on the state just before its block
 * and the revert that call raises is decoded.
 *
 * Best effort, and never the outcome itself (the receipt's `status` is). The
 * replay can't see state set earlier in the same block: then it may go through
 * (giving `undefined`) or fail for a different reason — callers that know an
 * earlier transaction of theirs shares the block skip it. A wallet whose
 * bundle goes through a relayer or an EntryPoint replays as the relayer's call,
 * and an RPC without the parent block's state can't run it; those, or a slow
 * answer, give `undefined`, and the caller shows its generic failure copy.
 */
export async function replayRevertedTransaction(
  client: PublicClient,
  { transactionHash, blockNumber }: { transactionHash: Hash; blockNumber: bigint }
): Promise<DecodedRevert | undefined> {
  const replay = async () => {
    const tx = await client.getTransaction({ hash: transactionHash });
    if (!tx.to) return undefined;
    try {
      await client.call({
        account: tx.from,
        to: tx.to,
        data: tx.input,
        value: tx.value,
        gas: tx.gas,
        blockNumber: blockNumber - 1n
      });
      // It went through this time: the revert depended on something the replay can't see.
      return undefined;
    } catch (error) {
      return decodeRevert(error);
    }
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<undefined>(resolve => {
    timer = setTimeout(() => resolve(undefined), REPLAY_TIMEOUT_MS);
  });
  try {
    return await Promise.race([replay(), timeout]);
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}
