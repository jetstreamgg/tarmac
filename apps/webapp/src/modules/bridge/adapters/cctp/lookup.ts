import { psm3L2Abi } from '@/hooks/generated';
import {
  TransactionReceiptNotFoundError,
  getAbiItem,
  isAddressEqual,
  parseEventLogs,
  type Hex,
  type Log
} from 'viem';
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

/** The blocks up to a burn's its sender's swap is looked for in: one log read within the 10k range RPC providers cap it at, hours on Base or OP, about 40 minutes on Arbitrum. */
export const SWAP_LOOKBACK_BLOCKS = 10_000n;

/** A PSM3 swap of USDS to `sender` covering the whole burn, as the app sends before it. */
const swapsFor = (logs: readonly Log[], { from, amount, sender }: CctpBurnExpectation) => {
  const { psm3, usds, usdc } = cctpL2Contracts(from);
  return parseEventLogs({ abi: psm3L2Abi, eventName: 'Swap', logs: logs as Log[], strict: true }).filter(
    ({ address, args }) =>
      isAddressEqual(address, psm3) &&
      isAddressEqual(args.assetIn, usds) &&
      isAddressEqual(args.assetOut, usdc) &&
      isAddressEqual(args.receiver, sender) &&
      args.amountOut >= cctpBurnAmount(amount)
  );
};

/**
 * The burn was swapped from USDS on PSM3: in its own transaction, as a bundle
 * does, or in an earlier one its sender sent, as a bridge sent one leg at a
 * time (or a bundle the wallet runs as separate transactions) does.
 */
async function swappedFromUsds(
  client: ChainReader,
  receipt: { logs: readonly Log[]; blockNumber: bigint; transactionIndex: number },
  burn: CctpBurnExpectation
) {
  if (swapsFor(receipt.logs, burn).length > 0) return true;
  const { psm3, usds, usdc } = cctpL2Contracts(burn.from);
  const earlier = await client.getLogs({
    address: psm3,
    event: getAbiItem({ abi: psm3L2Abi, name: 'Swap' }),
    args: { assetIn: usds, assetOut: usdc, receiver: burn.sender },
    fromBlock:
      receipt.blockNumber >= SWAP_LOOKBACK_BLOCKS ? receipt.blockNumber - SWAP_LOOKBACK_BLOCKS + 1n : 0n,
    toBlock: receipt.blockNumber
  });
  return swapsFor(earlier, burn).some(
    ({ blockNumber, transactionIndex, args }) =>
      isAddressEqual(args.sender, burn.sender) &&
      (blockNumber < receipt.blockNumber ||
        (blockNumber === receipt.blockNumber && transactionIndex < receipt.transactionIndex))
  );
}

/**
 * A CCTP burn to Ethereum that this browser has no record of, read from its
 * source receipt, as the pending bridge the tracker claims from. A third
 * wallet's names its recipient, the only wallet that can claim it. A burn
 * its sender didn't swap from USDS, in its transaction or in one shortly
 * before, is claim-only: its USDC stays USDC, and a convert is offered after.
 * Network read errors are thrown.
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
  const claimOnly = !(await swappedFromUsds(client, receipt, burns[0]));
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
