import {
  BaseError,
  ContractFunctionRevertedError,
  TransactionReceiptNotFoundError,
  decodeEventLog,
  getAbiItem,
  isAddressEqual,
  type Hex,
  type Log,
  type TransactionReceipt
} from 'viem';
import type { BridgeProgress } from '../../model/pendingTransitions';
import type { PendingBridge } from '../../model/types';
import { safeExecutionFailed } from '../safe';
import type { AdapterContext, ChainReader } from '../types';
import { ARB_RETRYABLE_TX, arbRetryableTxAbi } from './contracts';
import { arbitrumRetryableTicket } from './arbitrum';

/** About a day and a half of Arbitrum blocks per log query. */
export const TICKET_SCAN_CHUNK_BLOCKS = 500_000n;
/** Scanned past the ticket's timeout, so an expiry never rests on one lifetime read. */
const TICKET_SCAN_MARGIN_S = 86_400n;

const REDEEM_SCHEDULED = getAbiItem({ abi: arbRetryableTxAbi, name: 'RedeemScheduled' });
const LIFETIME_EXTENDED = getAbiItem({ abi: arbRetryableTxAbi, name: 'LifetimeExtended' });

async function receiptOf(l2: ChainReader, hash: string): Promise<TransactionReceipt | undefined> {
  try {
    return await l2.getTransactionReceipt({ hash: hash as Hex });
  } catch (error) {
    if (error instanceof TransactionReceiptNotFoundError) return undefined;
    throw error;
  }
}

/** The retries ArbOS scheduled for the ticket in a receipt; only ArbRetryableTx emits from its address. */
const scheduledRetries = (logs: Log[], ticketId: Hex): Hex[] =>
  logs.flatMap(log => {
    if (!isAddressEqual(log.address, ARB_RETRYABLE_TX)) return [];
    try {
      const event = decodeEventLog({ abi: arbRetryableTxAbi, data: log.data, topics: log.topics });
      return event.eventName === 'RedeemScheduled' && event.args.ticketId.toLowerCase() === ticketId
        ? [event.args.retryTxHash]
        : [];
    } catch {
      return [];
    }
  });

// A retry that executed the ticket's mint; a missing receipt is not one yet.
const anyRetrySucceeded = async (l2: ChainReader, retries: Hex[]) =>
  (await Promise.all(retries.map(hash => receiptOf(l2, hash)))).some(
    receipt => receipt?.status === 'success'
  );

/** The ticket's timeout at `blockNumber`; undefined when ArbOS has no live ticket (redeemed, expired or canceled). */
async function readTimeout(l2: ChainReader, ticketId: Hex, blockNumber: bigint) {
  try {
    return await l2.readContract({
      address: ARB_RETRYABLE_TX,
      abi: arbRetryableTxAbi,
      functionName: 'getTimeout',
      args: [ticketId],
      blockNumber
    });
  } catch (error) {
    const reverted =
      error instanceof BaseError && error.walk(cause => cause instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError && reverted.data?.errorName === 'NoTicketWithID')
      return undefined;
    throw error;
  }
}

/**
 * Whether a retry of the ticket succeeded between its creation and
 * `toBlock`, from ArbRetryableTx's RedeemScheduled logs. The scan stops once
 * it is a day past the ticket's timeout, extended by every keepalive it saw,
 * as nothing can redeem it after that. Throws when any read fails.
 */
async function scanForRedeem(l2: ChainReader, ticketId: Hex, fromBlock: bigint, toBlock: bigint) {
  const [created, lifetime] = await Promise.all([
    l2.getBlock({ blockNumber: fromBlock }),
    l2.readContract({
      address: ARB_RETRYABLE_TX,
      abi: arbRetryableTxAbi,
      functionName: 'getLifetime',
      blockNumber: toBlock
    })
  ]);
  let timeout = created.timestamp + lifetime;
  for (let start = fromBlock; start <= toBlock; start += TICKET_SCAN_CHUNK_BLOCKS) {
    const end =
      start + TICKET_SCAN_CHUNK_BLOCKS - 1n < toBlock ? start + TICKET_SCAN_CHUNK_BLOCKS - 1n : toBlock;
    const range = {
      address: ARB_RETRYABLE_TX,
      args: { ticketId },
      fromBlock: start,
      toBlock: end,
      strict: true
    } as const;
    const [scheduled, extended] = await Promise.all([
      l2.getLogs({ ...range, event: REDEEM_SCHEDULED }),
      l2.getLogs({ ...range, event: LIFETIME_EXTENDED })
    ]);
    if (
      await anyRetrySucceeded(
        l2,
        scheduled.map(log => log.args.retryTxHash)
      )
    )
      return true;
    for (const log of extended) if (log.args.newTimeout > timeout) timeout = log.args.newTimeout;
    if (end === toBlock) return false;
    const block = await l2.getBlock({ blockNumber: end });
    if (block.timestamp > timeout + TICKET_SCAN_MARGIN_S) return false;
  }
  return false;
}

/**
 * Where an Ethereum to Arbitrum deposit stands, from the retryable ticket its
 * Ethereum receipt created. Arrived only once a retry of the ticket succeeded
 * on Arbitrum; a live ticket is offered as a redeem; expired only when ArbOS
 * has no ticket and a complete scan found no successful retry. A receipt
 * with no Sky ticket fails only when the sender's Safe reported its execution
 * failed. Any failed read is null: nothing changes.
 */
export async function arbitrumDepositProgress(
  bridge: PendingBridge,
  context: AdapterContext
): Promise<BridgeProgress | null> {
  const l1 = context.getClient('ethereum');
  const l2 = context.getClient('arbitrum');
  if (!l1 || !l2 || !bridge.txHash) return null;
  try {
    // A Safe's sent redeem or keepalive is settled by the tracker.
    const sent = bridge.actions.find(
      action =>
        action.status === 'sent' &&
        !action.safe &&
        (action.action === 'redeem' || action.action === 'keepalive')
    );
    const sentReceipt = sent && (await receiptOf(l2, sent.txHash));
    if (sent && sentReceipt)
      return sentReceipt.status === 'success'
        ? { kind: 'action-confirmed', action: sent.action, txHash: sent.txHash }
        : { kind: 'action-dropped', txHash: sent.txHash };

    const receipt = await l1.getTransactionReceipt({ hash: bridge.txHash as Hex });
    if (receipt.status === 'reverted') return { kind: 'failed', reason: 'source-tx-reverted' };
    const ticket = arbitrumRetryableTicket(receipt.logs);
    if (!ticket)
      return safeExecutionFailed(receipt.logs, bridge.account)
        ? { kind: 'failed', reason: 'safe-tx-reverted' }
        : null;
    const { ticketId } = ticket;
    // ArbOS creates the ticket once it reads the deposit from Ethereum, minutes later.
    const creation = await receiptOf(l2, ticketId);
    if (!creation) return { kind: 'waiting' };
    // The Inbox rejects an underpaid ticket on Ethereum, so a failed creation is unexpected: never terminal.
    if (creation.status !== 'success') return null;

    // The auto-redeem's retry, and those of the redeems this bridge confirmed.
    const redeems = await Promise.all(
      bridge.actions
        .filter(action => action.action === 'redeem' && action.status === undefined)
        .map(action => receiptOf(l2, action.txHash))
    );
    const retries = [creation, ...redeems].flatMap(entry =>
      entry ? scheduledRetries(entry.logs, ticketId) : []
    );
    if (await anyRetrySucceeded(l2, retries)) return { kind: 'arrived' };

    // The ticket read and the scan share one block, so a redeem can't fall between them.
    const blockNumber = await l2.getBlockNumber();
    const timeout = await readTimeout(l2, ticketId, blockNumber);
    if (timeout !== undefined)
      return { kind: 'ready', nextAction: 'redeem', routeData: { ticketId, timeout: timeout.toString() } };
    return (await scanForRedeem(l2, ticketId, creation.blockNumber, blockNumber))
      ? { kind: 'arrived' }
      : { kind: 'expired' };
  } catch {
    return null;
  }
}
