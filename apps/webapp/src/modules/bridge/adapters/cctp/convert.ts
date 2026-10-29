import {
  TransactionNotFoundError,
  TransactionReceiptNotFoundError,
  isAddressEqual,
  parseEventLogs,
  erc20Abi,
  zeroAddress,
  type Address,
  type Hex,
  type Log,
  type PublicClient
} from 'viem';
import { canConvert } from '../../model/pendingTransitions';
import type { PendingBridge, PendingBridgeAction } from '../../model/types';
import { L1_SENT_ACTION_DROPPED_MS } from '../sentAction';
import { cctpBurnAmount } from './calls';
import { L1_USDC, L1_USDS } from './contracts';

/** The claim's transaction mints USDS to the recipient when it sold the received USDC (the wrapper mints it). */
export const claimSoldForUsds = (
  logs: readonly Pick<Log, 'address' | 'topics' | 'data'>[],
  recipient: string
) =>
  parseEventLogs({ abi: erc20Abi, eventName: 'Transfer', logs: logs as Log[], strict: true }).some(
    log =>
      isAddressEqual(log.address, L1_USDS) &&
      isAddressEqual(log.args.from, zeroAddress) &&
      isAddressEqual(log.args.to, recipient as `0x${string}`)
  );

/**
 * Every hash this app's claim confirmed with: a run signed step by step can
 * confirm its receive and its sale apart, and a bundle the wallet ran apart
 * keeps its other transactions on the claim.
 */
export const confirmedClaimTxHashes = (bridge: PendingBridge): string[] =>
  bridge.actions
    .filter(action => action.action === 'claim' && action.status === undefined)
    .flatMap(action => [action.txHash, ...(action.bundleTxHashes ?? [])]);

const claimNextLegs = (bridge: PendingBridge) =>
  bridge.actions.filter(
    (action): action is PendingBridgeAction & { nextLegTxHash: string } =>
      action.action === 'claim' && action.status === undefined && !!action.nextLegTxHash
  );

/** The leg a claim's run sent after the claim mined and hasn't confirmed: its sale, maybe mined after a reload. */
export const claimNextLegTxHashes = (bridge: PendingBridge): string[] =>
  claimNextLegs(bridge).map(action => action.nextLegTxHash);

/** The first hash this app's claim confirmed with; see `confirmedClaimTxHashes` for all of them. */
export const confirmedClaimTxHash = (bridge: PendingBridge): string | undefined =>
  confirmedClaimTxHashes(bridge)[0];

/**
 * The USDC (6 decimals) a settled CCTP claim left unsold that `account` can
 * convert to USDS: what it minted, capped by what the account still holds.
 * Only to its recipient, for a claim this app recorded that sold nothing, and
 * once; undefined while anything it reads is unknown.
 */
export function cctpConvertOffer({
  bridge,
  account,
  claimSold,
  usdcBalance
}: {
  bridge: PendingBridge;
  account: string | undefined;
  claimSold: boolean | undefined;
  usdcBalance: bigint | undefined;
}): bigint | undefined {
  if (!canConvert(bridge, account) || !confirmedClaimTxHash(bridge)) return undefined;
  if (claimSold !== false || usdcBalance === undefined) return undefined;
  const minted = cctpBurnAmount(bridge.amount);
  const amount = usdcBalance < minted ? usdcBalance : minted;
  return amount > 0n ? amount : undefined;
}

/** Without `getTransaction`, a leg not mined never counts as dropped. */
export type ConvertOfferReader = Pick<PublicClient, 'getTransactionReceipt' | 'readContract'> &
  Partial<Pick<PublicClient, 'getTransaction'>>;

// A leg the chain still doesn't know `L1_SENT_ACTION_DROPPED_MS` after it was sent was dropped: it sold nothing.
async function readNextLeg(
  client: ConvertOfferReader,
  leg: PendingBridgeAction & { nextLegTxHash: string },
  now: number
) {
  const hash = leg.nextLegTxHash as Hex;
  try {
    return await client.getTransactionReceipt({ hash });
  } catch (error) {
    if (
      !client.getTransaction ||
      !(error instanceof TransactionReceiptNotFoundError) ||
      now - (leg.nextLegAt ?? leg.at) < L1_SENT_ACTION_DROPPED_MS
    )
      throw error;
    try {
      await client.getTransaction({ hash });
    } catch (lookup) {
      if (lookup instanceof TransactionNotFoundError) return undefined;
      throw lookup;
    }
    throw error;
  }
}

/**
 * Whether this app's claim sold its USDC to `recipient`, from the receipts of
 * every hash it confirmed with. A reverted one can't tell what it left, so it
 * counts as sold. A leg its run sent after the claim (see `claimNextLegTxHashes`)
 * must be mined to tell: a reverted or dropped one sold nothing.
 */
export async function readClaimSold(
  client: ConvertOfferReader,
  bridge: PendingBridge,
  recipient: string,
  now = Date.now()
) {
  const [receipts, nextLegs] = await Promise.all([
    Promise.all(
      confirmedClaimTxHashes(bridge).map(hash => client.getTransactionReceipt({ hash: hash as Hex }))
    ),
    Promise.all(claimNextLegs(bridge).map(leg => readNextLeg(client, leg, now)))
  ]);
  return (
    receipts.some(receipt => receipt.status !== 'success' || claimSoldForUsds(receipt.logs, recipient)) ||
    nextLegs.some(receipt => receipt?.status === 'success' && claimSoldForUsds(receipt.logs, recipient))
  );
}

/** `cctpConvertOffer` read afresh on Ethereum: the claim's receipts and the account's USDC. A failed read rejects. */
export async function readCctpConvertOffer({
  client,
  bridge,
  account,
  now = Date.now()
}: {
  client: ConvertOfferReader;
  bridge: PendingBridge;
  account: string;
  now?: number;
}): Promise<bigint | undefined> {
  if (!canConvert(bridge, account) || !confirmedClaimTxHash(bridge)) return undefined;
  const recipient = bridge.recipient ?? bridge.account;
  const [claimSold, usdcBalance] = await Promise.all([
    readClaimSold(client, bridge, recipient, now),
    client.readContract({
      address: L1_USDC,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [account as Address]
    })
  ]);
  return cctpConvertOffer({ bridge, account, claimSold, usdcBalance });
}
