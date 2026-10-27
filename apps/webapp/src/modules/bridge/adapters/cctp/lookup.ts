import { psm3L2Abi } from '@/hooks/generated';
import { TransactionReceiptNotFoundError, isAddressEqual, parseEventLogs, type Hex, type Log } from 'viem';
import { createPendingBridge } from '../../model/pendingTransitions';
import { sendsToOther } from '../../model/recipient';
import { cctpWithdrawalRoute } from '../../model/resolveRoute';
import type { PendingBridge } from '../../model/types';
import { math } from '@/utils';
import type { ChainReader } from '../types';
import { CCTP_CLAIM_ONLY, cctpBurnAmount } from './calls';
import { cctpL2Contracts, type CctpL2NetworkId } from './contracts';
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
      amount: math.convertUSDCtoWad(body.amount),
      sender: body.messageSender,
      mintRecipient: body.mintRecipient
    };
    return isExpectedBurn(decoded, burn) ? [burn] : [];
  });
}

/** The burn's transaction swapped its whole USDC from USDS on PSM3 to its sender, as the app's bundle does. */
const swappedFromUsds = (logs: readonly Log[], { from, amount, sender }: CctpBurnExpectation) => {
  const { psm3, usds, usdc } = cctpL2Contracts(from);
  return parseEventLogs({ abi: psm3L2Abi, eventName: 'Swap', logs: logs as Log[], strict: true }).some(
    ({ address, args }) =>
      isAddressEqual(address, psm3) &&
      isAddressEqual(args.assetIn, usds) &&
      isAddressEqual(args.assetOut, usdc) &&
      isAddressEqual(args.receiver, sender) &&
      args.amountOut >= cctpBurnAmount(amount)
  );
};

/**
 * A CCTP burn to Ethereum that this browser has no record of, read from its
 * source receipt, as the pending bridge the tracker claims from. A third
 * wallet's names its recipient, the only wallet that can claim it. A burn
 * whose transaction didn't swap it from USDS is claim-only: its USDC stays
 * USDC, and a convert is offered after. Network read errors are thrown.
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
  const claimOnly = !swappedFromUsds(receipt.logs, burns[0]);
  const caller = account.toLowerCase();
  const thirdWallet = caller !== sender.toLowerCase() && caller !== mintRecipient.toLowerCase();
  const block = await client.getBlock({ blockNumber: receipt.blockNumber });
  const startedAt = Number(block.timestamp) * 1000;
  const bridge = createPendingBridge({
    account: sender,
    amount,
    from,
    to: 'ethereum',
    recipient: thirdWallet || sendsToOther(mintRecipient, sender) ? mintRecipient.toLowerCase() : undefined,
    route: cctpWithdrawalRoute(from),
    txHash: hash,
    now: startedAt
  });
  return { status: 'found', bridge: claimOnly ? { ...bridge, routeData: { ...CCTP_CLAIM_ONLY } } : bridge };
}
