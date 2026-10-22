import { TransactionReceiptNotFoundError, type Hex, type Log } from 'viem';
import { createPendingBridge } from '../../model/pendingTransitions';
import { sendsToOther } from '../../model/recipient';
import { cctpWithdrawalRoute } from '../../model/resolveRoute';
import type { PendingBridge } from '../../model/types';
import type { ChainReader } from '../types';
import { USDS_PER_USDC_UNIT, type CctpL2NetworkId } from './contracts';
import { isExpectedBurn, sentMessages, type CctpBurnExpectation } from './message';

export type CctpBurnLookup =
  | { status: 'found'; bridge: PendingBridge }
  | { status: 'refused'; reason: 'not-found' | 'reverted' | 'not-a-bridge' | 'several-burns' };

/** The standard, fee-free, no-hook burns to Ethereum in a source receipt, in the terms the app launches them with. */
export function standardBurns(logs: readonly Log[], from: CctpL2NetworkId): CctpBurnExpectation[] {
  return sentMessages(logs).flatMap(({ decoded }) => {
    const { body } = decoded;
    const burn = {
      from,
      amount: body.amount * USDS_PER_USDC_UNIT,
      sender: body.messageSender,
      mintRecipient: body.mintRecipient
    };
    return isExpectedBurn(decoded, burn) ? [burn] : [];
  });
}

/**
 * A CCTP burn to Ethereum that this browser has no record of, read from its
 * source receipt, as the pending bridge the tracker claims from. A third
 * wallet's names its recipient, the only wallet that can claim it; network
 * read errors are thrown.
 */
export async function lookupCctpBurn({
  from,
  txHash,
  account,
  client
}: {
  from: CctpL2NetworkId;
  txHash: Hex;
  account: string;
  client: ChainReader;
}): Promise<CctpBurnLookup> {
  const hash = txHash.toLowerCase() as Hex;
  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash });
  } catch (error) {
    if (error instanceof TransactionReceiptNotFoundError) return { status: 'refused', reason: 'not-found' };
    throw error;
  }
  if (receipt.status !== 'success') return { status: 'refused', reason: 'reverted' };
  const burns = standardBurns(receipt.logs, from);
  if (burns.length === 0) return { status: 'refused', reason: 'not-a-bridge' };
  if (burns.length > 1) return { status: 'refused', reason: 'several-burns' };
  const [{ amount, sender, mintRecipient }] = burns;
  const caller = account.toLowerCase();
  const thirdWallet = caller !== sender.toLowerCase() && caller !== mintRecipient.toLowerCase();
  const block = await client.getBlock({ blockNumber: receipt.blockNumber });
  const startedAt = Number(block.timestamp) * 1000;
  return {
    status: 'found',
    bridge: createPendingBridge({
      account: sender,
      amount,
      from,
      to: 'ethereum',
      recipient: thirdWallet || sendsToOther(mintRecipient, sender) ? mintRecipient.toLowerCase() : undefined,
      route: cctpWithdrawalRoute(from),
      txHash: hash,
      now: startedAt
    })
  };
}
