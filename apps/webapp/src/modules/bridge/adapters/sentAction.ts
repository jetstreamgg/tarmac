import { TransactionNotFoundError, TransactionReceiptNotFoundError, type Hex } from 'viem';
import type { BridgeNetworkId } from '../model/networks';
import type { BridgeProgress } from '../model/pendingTransitions';
import type { PendingBridge, PendingBridgeAction } from '../model/types';
import type { AdapterContext, ChainReader } from './types';

/** An L2 sequencer includes or rejects a transaction in seconds; one still unknown after this was dropped or replaced. */
export const SENT_ACTION_DROPPED_MS = 15 * 60_000;
/** Ethereum nodes keep an underpriced transaction in their mempool for hours (geth: 3 h). */
export const L1_SENT_ACTION_DROPPED_MS = 3 * 60 * 60_000;

/**
 * Settles an action sent from this browser by its receipt on `l2`; a
 * transaction the chain still doesn't know `droppedMs` after it was sent is
 * dropped, so the action can be sent again. Undefined while it may still mine.
 */
export async function settleSentAction(
  l2: ChainReader,
  sent: PendingBridgeAction,
  now: number,
  droppedMs = SENT_ACTION_DROPPED_MS
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
  if (now - sent.at < droppedMs) return undefined;
  // Still pending: it may mine.
  return (await isTransactionKnown(l2, hash)) ? undefined : { kind: 'action-dropped', txHash: sent.txHash };
}

/** Whether `chain` has `hash`, mined or in its mempool; throws when it can't tell. */
export async function isTransactionKnown(chain: Pick<ChainReader, 'getTransaction'>, hash: Hex) {
  try {
    await chain.getTransaction({ hash });
    return true;
  } catch (error) {
    if (error instanceof TransactionNotFoundError) return false;
    throw error;
  }
}

/** How long a source transaction on `from` may be unknown to its chain before it counts as dropped or replaced. */
export const sourceDroppedMs = (from: BridgeNetworkId) =>
  from === 'ethereum' ? L1_SENT_ACTION_DROPPED_MS : SENT_ACTION_DROPPED_MS;

/**
 * Asks the source chain about a send no tracker has read mined, once it is
 * overdue: `source-not-found` only when the chain answers it has neither a
 * receipt nor the transaction, `source-found` when it has either. Null before
 * that, and whenever a read fails: a failed read is no evidence.
 */
export async function probeSource(
  bridge: PendingBridge,
  now: number,
  context: AdapterContext
): Promise<BridgeProgress | null> {
  if (bridge.status !== 'pending' || !bridge.txHash || bridge.sourceMinedAt !== undefined) return null;
  if (now - bridge.startedAt < sourceDroppedMs(bridge.from)) return null;
  const source = context.getClient(bridge.from);
  if (!source) return null;
  const hash = bridge.txHash as Hex;
  const found: BridgeProgress | null = bridge.sourceUnseenAt === undefined ? null : { kind: 'source-found' };
  try {
    await source.getTransactionReceipt({ hash });
    return found;
  } catch (error) {
    if (!(error instanceof TransactionReceiptNotFoundError)) return null;
  }
  try {
    return (await isTransactionKnown(source, hash)) ? found : { kind: 'source-not-found' };
  } catch {
    return null;
  }
}
