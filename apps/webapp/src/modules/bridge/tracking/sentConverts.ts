import { TransactionNotFoundError, TransactionReceiptNotFoundError } from 'viem';
import type { CctpSwapStore, UnfinishedCctpSwap } from '../store/cctpSwapStore';
import type { CctpL2NetworkId } from '../adapters/cctp/contracts';
import { SENT_ACTION_DROPPED_MS } from '../adapters/sentAction';
import { BUNDLE_UNSEEN_MS } from '../model/pendingTransitions';
import { bundleOutcome } from './bundleAction';
import type { CallsStatus } from './recoverDeposits';

const POLL_MS = 30_000;
const SLOW_POLL_MS = 5 * 60_000;
const FAST_POLL_WINDOW_MS = 60 * 60_000;

/**
 * How often the sent converts are checked: every 30 seconds for an hour after
 * the last one was sent, then every 5 minutes, as a wallet or Safe signers that
 * never answer leave it sent. A link stored without its send time is dated by its swap.
 */
export function sentConvertPollMs(swaps: readonly UnfinishedCctpSwap[], now: number): number {
  const recent = swaps.some(swap => swap.convert && now - (swap.convertAt ?? swap.at) <= FAST_POLL_WINDOW_MS);
  return recent ? POLL_MS : SLOW_POLL_MS;
}

/**
 * Settles each convert a stopped CCTP swap sent, so it is resolved after the
 * tab that sent it closed: one sent as a wallet bundle from the wallet's
 * status of it, one sent by hash from its receipt on the swap's L2. A convert
 * that ran drops the swap, one that failed or reverted is unlinked so the swap
 * is offered again, and one the wallet or the chain can't tell about yet (a
 * read that fails) stays sent. So is one that will never mine: sent by hash,
 * once the L2 has neither its receipt nor the transaction 15 minutes after it
 * was sent; sent as a bundle, once the wallet has had nothing to say about it
 * for 30 minutes. A convert linked again meanwhile is left alone.
 */
export async function resolveSentConverts({
  store,
  scope,
  callsStatus,
  receipt,
  transaction,
  now = Date.now
}: {
  store: CctpSwapStore;
  scope: string;
  callsStatus: (callsId: string) => Promise<CallsStatus | undefined>;
  /** No convert sent by hash is read without it. */
  receipt?: (network: CctpL2NetworkId, hash: string) => Promise<{ status: 'success' | 'reverted' }>;
  /** Resolves while the L2 knows the transaction; without it no convert counts as dropped. */
  transaction?: (network: CctpL2NetworkId, hash: string) => Promise<unknown>;
  now?: () => number;
}): Promise<void> {
  const sentFor = (swap: UnfinishedCctpSwap) => now() - (swap.convertAt ?? swap.at);
  // A wallet that reports the bundle pending still knows it.
  const bundleRan = async (swap: UnfinishedCctpSwap) => {
    let reported: CallsStatus | undefined;
    try {
      reported = await callsStatus(swap.convert!);
    } catch {
      reported = undefined;
    }
    const outcome = bundleOutcome(reported);
    if (outcome) return outcome.kind === 'ran';
    return reported?.status === undefined && sentFor(swap) >= BUNDLE_UNSEEN_MS ? false : undefined;
  };
  const hashRan = async (swap: UnfinishedCctpSwap) => {
    if (!receipt) return undefined;
    try {
      return (await receipt(swap.network, swap.convert!)).status === 'success';
    } catch (error) {
      if (!(error instanceof TransactionReceiptNotFoundError)) throw error;
    }
    if (!transaction || sentFor(swap) < SENT_ACTION_DROPPED_MS) return undefined;
    try {
      // Still in the mempool: it may mine.
      await transaction(swap.network, swap.convert!);
      return undefined;
    } catch (error) {
      if (error instanceof TransactionNotFoundError) return false;
      throw error;
    }
  };
  // Whether the convert ran; undefined while it can't be told.
  const ranOf = (swap: UnfinishedCctpSwap) => (swap.convertBundled ? bundleRan(swap) : hashRan(swap));
  const sent = store.getSnapshot(scope).filter(swap => swap.convert);
  await Promise.all(
    sent.map(async swap => {
      let ran: boolean | undefined;
      try {
        ran = await ranOf(swap);
      } catch {
        return;
      }
      const current = store.get(scope, swap.swapTxHash);
      if (ran === undefined || current?.convert !== swap.convert) return;
      if (ran) store.clear(scope, swap.swapTxHash);
      else store.markConvert(scope, swap.swapTxHash, undefined);
    })
  );
}
