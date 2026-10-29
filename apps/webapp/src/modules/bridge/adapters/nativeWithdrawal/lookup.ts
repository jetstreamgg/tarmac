import { TransactionReceiptNotFoundError, type Hex } from 'viem';
import { createPendingBridge } from '../../model/pendingTransitions';
import { sendsToOther } from '../../model/recipient';
import { nativeWithdrawalRoute } from '../../model/resolveRoute';
import type { PendingBridge } from '../../model/types';
import type { NativeDepositNetwork } from '../nativeDeposit/contracts';
import type { ChainReader } from '../types';
import { nativeWithdrawalMessage } from './message';

export type NativeWithdrawalLookup =
  | { status: 'found'; bridge: PendingBridge }
  | { status: 'refused'; reason: 'not-found' | 'reverted' | 'not-a-bridge' };

/**
 * A native USDS withdrawal to Ethereum that this browser has no record of,
 * read from its L2 receipt, as the pending bridge the tracker proves and
 * finalizes. A third wallet's names its recipient. A receipt with no USDS
 * withdrawal of `from`'s Sky bridge, or more than one, is not a bridge.
 * Network read errors are thrown.
 */
export async function lookupNativeWithdrawal({
  from,
  txHash,
  account,
  client
}: {
  from: NativeDepositNetwork;
  txHash: Hex;
  account: string;
  client: ChainReader;
}): Promise<NativeWithdrawalLookup> {
  const hash = txHash.toLowerCase() as Hex;
  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash });
  } catch (error) {
    if (error instanceof TransactionReceiptNotFoundError) return { status: 'refused', reason: 'not-found' };
    throw error;
  }
  if (receipt.status !== 'success') return { status: 'refused', reason: 'reverted' };
  const message = nativeWithdrawalMessage(receipt.logs, from);
  if (!message) return { status: 'refused', reason: 'not-a-bridge' };
  const caller = account.toLowerCase();
  const thirdWallet = caller !== message.from.toLowerCase() && caller !== message.to.toLowerCase();
  const block = await client.getBlock({ blockNumber: receipt.blockNumber });
  return {
    status: 'found',
    bridge: createPendingBridge({
      account: message.from,
      amount: message.amount,
      from,
      to: 'ethereum',
      recipient: thirdWallet || sendsToOther(message.to, message.from) ? message.to.toLowerCase() : undefined,
      route: nativeWithdrawalRoute(from),
      txHash: hash,
      now: Number(block.timestamp) * 1000
    })
  };
}
