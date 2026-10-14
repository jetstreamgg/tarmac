import { TransactionNotFoundError, TransactionReceiptNotFoundError, type Hex } from 'viem';
import type { BridgeProgress } from '../model/pendingTransitions';
import type { PendingBridgeAction } from '../model/types';
import type { ChainReader } from './types';

/** An L2 sequencer includes or rejects a transaction in seconds; one still unknown after this was dropped or replaced. */
export const SENT_ACTION_DROPPED_MS = 15 * 60_000;

/**
 * Settles an action sent from this browser by its receipt on `l2`; a
 * transaction the chain still doesn't know `SENT_ACTION_DROPPED_MS` after it
 * was sent is dropped, so the action can be sent again. Undefined while it
 * may still mine.
 */
export async function settleSentAction(
  l2: ChainReader,
  sent: PendingBridgeAction,
  now: number
): Promise<BridgeProgress | undefined> {
  const hash = sent.txHash as Hex;
  try {
    const receipt = await l2.getTransactionReceipt({ hash });
    return receipt.status === 'success'
      ? { kind: 'action-confirmed', action: sent.action, txHash: sent.txHash }
      : { kind: 'action-dropped', txHash: sent.txHash };
  } catch (error) {
    if (!(error instanceof TransactionReceiptNotFoundError)) throw error;
  }
  if (now - sent.at < SENT_ACTION_DROPPED_MS) return undefined;
  try {
    // Still pending: it may mine.
    await l2.getTransaction({ hash });
    return undefined;
  } catch (error) {
    if (error instanceof TransactionNotFoundError) return { kind: 'action-dropped', txHash: sent.txHash };
    throw error;
  }
}
