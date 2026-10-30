import {
  TransactionNotFoundError,
  TransactionReceiptNotFoundError,
  isAddressEqual,
  parseEventLogs,
  erc20Abi,
  zeroAddress,
  getAbiItem,
  getAddress,
  type Address,
  type Hex,
  type Log,
  type PublicClient,
  type TransactionReceipt
} from 'viem';
import { math } from '@/utils';
import { canConvert } from '../../model/pendingTransitions';
import type { PendingBridge, PendingBridgeAction } from '../../model/types';
import { L1_SENT_ACTION_DROPPED_MS } from '../sentAction';
import type { ChainReader } from '../types';
import { cctpBurnAmount } from './calls';
import { L1_USDC, L1_USDS, TOKEN_MESSENGER_V2, isCctpL2Network } from './contracts';
import { MINT_AND_WITHDRAW, receivedCopies, sourceBurnMessages } from './message';

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
 * Only to its recipient, for a claim this app recorded or someone else's
 * receive found on Ethereum (`othersClaimTxHash`) that sold nothing, and once;
 * undefined while anything it reads is unknown.
 */
export function cctpConvertOffer({
  bridge,
  account,
  claimSold,
  usdcBalance,
  othersClaimTxHash
}: {
  bridge: PendingBridge;
  account: string | undefined;
  claimSold: boolean | undefined;
  usdcBalance: bigint | undefined;
  othersClaimTxHash?: string;
}): bigint | undefined {
  if (!canConvert(bridge, account) || !(confirmedClaimTxHash(bridge) ?? othersClaimTxHash)) return undefined;
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

/** Ethereum blocks per log query, within the 10k range many RPC providers cap eth_getLogs at. */
export const OTHERS_CLAIM_SCAN_CHUNK_BLOCKS = 10_000n;
/** The most Ethereum blocks scanned for someone else's receive: about 41 days. */
const OTHERS_CLAIM_SCAN_MAX_BLOCKS = 300_000n;
// Slack for clocks between the L2 and Ethereum.
const CLOCK_SLACK_SECONDS = 60n;

/**
 * The receive of a settled CCTP bridge to Ethereum that this app didn't send:
 * a claim fairy, the sender, or the recipient elsewhere. Found by the mint to
 * the recipient, newest first, back to the burn: the first one mined after it
 * whose receipt holds the attested copy of the app's burn. Null when none; a
 * failed read rejects. Two identical burns both in flight can't be told apart.
 */
export async function findOthersClaimReceipt({
  l1,
  l2,
  bridge
}: {
  l1: Pick<ChainReader, 'getBlock' | 'getLogs' | 'getTransactionReceipt'>;
  l2: Pick<ChainReader, 'getBlock' | 'getTransactionReceipt'>;
  bridge: PendingBridge;
}): Promise<TransactionReceipt | null> {
  if (!bridge.txHash || bridge.to !== 'ethereum' || !isCctpL2Network(bridge.from)) return null;
  const burn = await l2.getTransactionReceipt({ hash: bridge.txHash as Hex });
  const sender = getAddress(bridge.account);
  const mintRecipient = getAddress(bridge.recipient ?? sender);
  const sources = sourceBurnMessages(burn.logs, {
    from: bridge.from,
    amount: bridge.amount,
    sender,
    mintRecipient
  });
  if (sources.length !== 1) return null;
  const [{ timestamp: burnedAt }, head] = await Promise.all([
    l2.getBlock({ blockNumber: burn.blockNumber }),
    l1.getBlock()
  ]);
  const lowest = head.number > OTHERS_CLAIM_SCAN_MAX_BLOCKS ? head.number - OTHERS_CLAIM_SCAN_MAX_BLOCKS : 0n;
  for (let toBlock = head.number; toBlock >= lowest; toBlock -= OTHERS_CLAIM_SCAN_CHUNK_BLOCKS) {
    const chunkStart = toBlock - OTHERS_CLAIM_SCAN_CHUNK_BLOCKS + 1n;
    const fromBlock = chunkStart > lowest ? chunkStart : lowest;
    // Back to the burn by block time: a fork mines faster than Ethereum's slots.
    const [mints, { timestamp: chunkStartedAt }] = await Promise.all([
      l1.getLogs({
        address: TOKEN_MESSENGER_V2,
        event: MINT_AND_WITHDRAW,
        args: { mintRecipient },
        fromBlock,
        toBlock
      }),
      l1.getBlock({ blockNumber: fromBlock })
    ]);
    const newestFirst = mints
      .filter(log => log.transactionHash && log.blockNumber !== null)
      .sort((a, b) => (a.blockNumber! > b.blockNumber! ? -1 : a.blockNumber! < b.blockNumber! ? 1 : 0));
    for (const mint of newestFirst) {
      const { timestamp } = await l1.getBlock({ blockNumber: mint.blockNumber! });
      // An identical earlier transfer to the same recipient was received before this burn existed.
      if (timestamp + CLOCK_SLACK_SECONDS < burnedAt) return null;
      const receipt = await l1.getTransactionReceipt({ hash: mint.transactionHash! });
      if (receivedCopies(receipt.logs, sources[0]).length) return receipt;
    }
    if (chunkStartedAt + CLOCK_SLACK_SECONDS < burnedAt) return null;
  }
  return null;
}

const TRANSFER = getAbiItem({ abi: erc20Abi, name: 'Transfer' });

/**
 * Whether `recipient` sold the USDC of someone else's `receive`: the receive
 * minted it USDS, or a later transaction minted it at least the USDC received,
 * as a claim signed step by step sells apart. Scanned newest first back to the
 * receive's block. Past the scan's reach, or after any other mint that large
 * (a DAI upgrade), it reads sold, so nothing is offered. A failed read rejects.
 */
export async function othersClaimSold({
  l1,
  receive,
  recipient
}: {
  l1: Pick<ChainReader, 'getBlockNumber' | 'getLogs'>;
  receive: Pick<TransactionReceipt, 'transactionHash' | 'blockNumber' | 'logs'>;
  recipient: Address;
}): Promise<boolean> {
  if (claimSoldForUsds(receive.logs, recipient)) return true;
  const received = parseEventLogs({ abi: [MINT_AND_WITHDRAW], logs: receive.logs as Log[], strict: true })
    .filter(
      log =>
        isAddressEqual(log.address, TOKEN_MESSENGER_V2) && isAddressEqual(log.args.mintRecipient, recipient)
    )
    .reduce((sum, log) => sum + log.args.amount, 0n);
  const sale = math.convertUSDCtoWad(received);
  const head = await l1.getBlockNumber();
  if (head - receive.blockNumber > OTHERS_CLAIM_SCAN_MAX_BLOCKS) return true;
  for (let toBlock = head; toBlock >= receive.blockNumber; toBlock -= OTHERS_CLAIM_SCAN_CHUNK_BLOCKS) {
    const chunkStart = toBlock - OTHERS_CLAIM_SCAN_CHUNK_BLOCKS + 1n;
    const mints = await l1.getLogs({
      address: L1_USDS,
      event: TRANSFER,
      args: { from: zeroAddress, to: recipient },
      fromBlock: chunkStart > receive.blockNumber ? chunkStart : receive.blockNumber,
      toBlock
    });
    if (
      mints.some(mint => mint.transactionHash !== receive.transactionHash && (mint.args.value ?? 0n) >= sale)
    )
      return true;
  }
  return false;
}
