import {
  createPublicClient,
  custom,
  erc20Abi,
  isAddressEqual,
  type Address,
  type EIP1193RequestFn,
  type Hex,
  type PublicClient
} from 'viem';
import { psm3L2Abi, usdsPsmWrapperAbi } from '@/hooks/generated';
import { TransactionRefusedError } from '@/hooks/shared/useTransactionOutcome';
import { getPsmDirectionHalted } from '@/modules/convert/hooks/usePsmConversion.helpers';
import type { BridgeRouteFacts } from '../../model/resolveRoute';
import { blockRanges } from '../blockRanges';
import {
  CCTP_DOMAIN,
  L1_DAI,
  L1_USDC,
  LITE_PSM,
  MESSAGE_TRANSMITTER_V2,
  TOKEN_MESSENGER_V2,
  TOKEN_MINTER_V2,
  USDS_PER_USDC_UNIT,
  USDS_PSM_WRAPPER,
  addressToBytes32,
  cctpL2Contracts,
  messageTransmitterV2Abi,
  tokenMessengerV2Abi,
  tokenMinterV2Abi,
  type CctpL2NetworkId
} from './contracts';
import { decodeCctpMessage, isCctpMessageExpired } from './message';

/** What CCTP from an L2 to Ethereum depends on, read on both chains. */
export type CctpGateReads = {
  /** TokenMinterV2 and MessageTransmitterV2 on the L2 (burn) and on Ethereum (mint). */
  sourcePaused: readonly [minter: boolean, transmitter: boolean];
  destinationPaused: readonly [minter: boolean, transmitter: boolean];
  /** The L2 USDC a single burn can carry, in USDC units; 0 when the token can't be burned. */
  burnLimit: bigint;
  /** USDC the L2 PSM3's pocket holds to swap the USDS for, in USDC units. */
  psm3Usdc: bigint;
  /** DAI the LitePSM holds to sell the minted USDC for USDS, in wei. */
  litePsmDai: bigint;
  /** The USDS wrapper's liveness (1 unless caged), its sell fee and its halted value. */
  live: bigint;
  tin: bigint;
  halted: bigint;
};

const wrapperSells = ({ live, tin, halted }: Pick<CctpGateReads, 'live' | 'tin' | 'halted'>) =>
  live === 1n &&
  tin === 0n &&
  !getPsmDirectionHalted({ direction: 'USDC_TO_USDS', feeWad: tin, haltedValue: halted });

/**
 * CCTP's route fact. Closed when either side is paused or the wrapper can't
 * sell for the full USDS (caged, halted or charging a fee), as the USDC supply
 * gate requires, so the claim always ends in USDS; limited by one burn's cap and by
 * the USDC and DAI each PSM can pay out.
 */
export function cctpGate(
  reads: CctpGateReads,
  { swap = true }: { swap?: boolean } = {}
): NonNullable<Exclude<BridgeRouteFacts['cctp'], 'loading' | 'error'>> {
  const paused = [...reads.sourcePaused, ...reads.destinationPaused].some(Boolean);
  const usdcLiquidity = reads.psm3Usdc * USDS_PER_USDC_UNIT;
  return {
    isOpen: !paused && wrapperSells(reads),
    maxAmount: reads.burnLimit * USDS_PER_USDC_UNIT,
    // Without the swap, as when continuing one, PSM3's USDC is not needed.
    liquidity: swap && usdcLiquidity < reads.litePsmDai ? usdcLiquidity : reads.litePsmDai
  };
}

const pausedReads = [
  { address: TOKEN_MINTER_V2, abi: tokenMinterV2Abi, functionName: 'paused' },
  { address: MESSAGE_TRANSMITTER_V2, abi: messageTransmitterV2Abi, functionName: 'paused' }
] as const;

/** The gate's reads on the L2: both pauses, the burn cap and PSM3's pocket. */
export const cctpSourceGateReads = (network: CctpL2NetworkId) => {
  const { psm3, usdc } = cctpL2Contracts(network);
  return [
    ...pausedReads,
    { address: TOKEN_MINTER_V2, abi: tokenMinterV2Abi, functionName: 'burnLimitsPerMessage', args: [usdc] },
    { address: psm3, abi: psm3L2Abi, functionName: 'pocket' }
  ] as const;
};

/** The USDC PSM3 swaps out, held by its pocket (PSM3 itself unless moved), as usePsmLiquidity reads it. */
export const cctpPocketUsdcRead = (network: CctpL2NetworkId, pocket: Address) =>
  ({
    address: cctpL2Contracts(network).usdc,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [pocket]
  }) as const;

/** The gate's reads on Ethereum: both pauses, the LitePSM's DAI and the wrapper's liveness and sell fee. */
export const cctpDestinationGateReads = [
  ...pausedReads,
  { address: L1_DAI, abi: erc20Abi, functionName: 'balanceOf', args: [LITE_PSM] },
  { address: USDS_PSM_WRAPPER, abi: usdsPsmWrapperAbi, functionName: 'live' },
  { address: USDS_PSM_WRAPPER, abi: usdsPsmWrapperAbi, functionName: 'tin' },
  { address: USDS_PSM_WRAPPER, abi: usdsPsmWrapperAbi, functionName: 'HALTED' }
] as const;

export type CctpSourceResults = readonly [boolean, boolean, bigint, Address];
export type CctpDestinationResults = readonly [boolean, boolean, bigint, bigint, bigint, bigint];

/** The gate's inputs from the results of both read lists, in their order, and the pocket's USDC. */
export const toCctpGateReads = (
  [sourceMinter, sourceTransmitter, burnLimit]: CctpSourceResults,
  psm3Usdc: bigint,
  [destinationMinter, destinationTransmitter, litePsmDai, live, tin, halted]: CctpDestinationResults
): CctpGateReads => ({
  sourcePaused: [sourceMinter, sourceTransmitter],
  destinationPaused: [destinationMinter, destinationTransmitter],
  burnLimit,
  psm3Usdc,
  litePsmDai,
  live,
  tin,
  halted
});

/**
 * The gate read afresh right before a burn: why `amount` USDS may not go
 * through CCTP now, if anything. A burn with no `swap` (a continued bridge)
 * needs no USDC from PSM3. A failed read refuses it too.
 */
export async function cctpBurnRefusal({
  network,
  amount,
  source,
  destination,
  swap = true
}: {
  network: CctpL2NetworkId;
  amount: bigint;
  source: PublicClient;
  destination: PublicClient;
  swap?: boolean;
}): Promise<Error | undefined> {
  const [sourceResults, destinationResults] = (await Promise.all([
    Promise.all(cctpSourceGateReads(network).map(read => source.readContract(read as never))),
    Promise.all(cctpDestinationGateReads.map(read => destination.readContract(read as never)))
  ])) as unknown as [CctpSourceResults, CctpDestinationResults];
  const pocketUsdc = await source.readContract(cctpPocketUsdcRead(network, sourceResults[3]));
  const reads = toCctpGateReads(sourceResults, pocketUsdc, destinationResults);
  const gate = cctpGate(reads);
  if (!gate.isOpen) return new Error('CCTP is paused.');
  if (amount > (gate.maxAmount ?? 0n))
    return new Error('The amount is over what one CCTP transfer can carry.');
  if (amount > (swap ? (gate.liquidity ?? 0n) : reads.litePsmDai))
    return new Error('There is not enough liquidity to bridge this amount.');
  return undefined;
}

/** A refusal that sending again can't lift. */
const finalRefusal = (message: string) => new TransactionRefusedError(message, { final: true });

/** L2 blocks per log query, within the 10k range many RPC providers cap eth_getLogs at. */
export const RESUME_SCAN_CHUNK_BLOCKS = 10_000n;
/** The most L2 blocks a continue scans: about three weeks of Base or OP, three days of Arbitrum. */
export const RESUME_SCAN_MAX_BLOCKS = 1_000_000n;

/**
 * `client` on its first backend only: a fallback transport may answer the head
 * from one backend and the logs from another that hasn't indexed them yet.
 */
function oneBackend(client: PublicClient): PublicClient {
  const backends = (client.transport as { transports?: readonly { request: EIP1193RequestFn }[] } | undefined)
    ?.transports;
  if (!backends?.length) return client;
  return createPublicClient({ chain: client.chain, transport: custom({ request: backends[0].request }) });
}

/**
 * Read right before continuing a bridge whose swap mined but whose burn was
 * never sent: why its USDC can't be burned, if anything. Only a swap of
 * `account` on PSM3 that mined successfully, with no USDC leaving the wallet
 * since, is continued, so USDC the wallet held before is never burned. A swap
 * older than `RESUME_SCAN_MAX_BLOCKS` is refused, as is a failed read. The
 * head and the logs are read from one backend, so an empty answer covers the
 * blocks up to the head it read.
 */
export async function cctpResumeRefusal({
  network,
  swapTxHash,
  account,
  usdcAmount,
  recipient,
  client
}: {
  network: CctpL2NetworkId;
  swapTxHash: Hex;
  account: Address;
  /** The USDC the swap returned, and the Ethereum recipient it was for. */
  usdcAmount: bigint;
  recipient: Address;
  client: PublicClient;
}): Promise<Error | undefined> {
  const { psm3, usdc } = cctpL2Contracts(network);
  const receipt = await client.getTransactionReceipt({ hash: swapTxHash }).catch(() => undefined);
  if (!receipt) return new Error('The swap of this bridge is not confirmed yet.');
  if (receipt.status !== 'success')
    return finalRefusal('The swap of this bridge failed, so there is nothing to bridge.');
  if (!isAddressEqual(receipt.from, account) || !receipt.to || !isAddressEqual(receipt.to, psm3))
    return finalRefusal('This swap is not a bridge of this account.');
  // viem caches the head for seconds: a burn in that window would go unscanned.
  const reader = oneBackend(client);
  const head = () => reader.getBlockNumber({ cacheTime: 0 });
  let latest = await head();
  // A node behind the swap would scan nothing and let it through.
  if (latest < receipt.blockNumber)
    return new Error("The network isn't synced up to the swap yet. Try again in a moment.");
  if (latest - receipt.blockNumber >= RESUME_SCAN_MAX_BLOCKS)
    return finalRefusal('This swap is too old for this app to check, so it cannot be continued.');
  const mintRecipient = addressToBytes32(recipient);
  const scan = async (from: bigint, to: bigint) => {
    for (const range of blockRanges(from, to, RESUME_SCAN_CHUNK_BLOCKS)) {
      const [burns, outflows] = await Promise.all([
        reader.getContractEvents({
          address: TOKEN_MESSENGER_V2,
          abi: tokenMessengerV2Abi,
          eventName: 'DepositForBurn',
          args: { burnToken: usdc, depositor: account },
          ...range
        }),
        reader.getContractEvents({
          address: usdc,
          abi: erc20Abi,
          eventName: 'Transfer',
          args: { from: account },
          ...range
        })
      ]);
      const sent = burns.some(
        ({ args }) =>
          args.amount === usdcAmount &&
          args.destinationDomain === CCTP_DOMAIN.ethereum &&
          args.mintRecipient?.toLowerCase() === mintRecipient
      );
      if (sent) return finalRefusal('This bridge was already sent.');
      // Every burn moves USDC out too, so this also covers burns of other bridges.
      if (outflows.length > 0)
        return finalRefusal(
          "USDC left this wallet after the swap, so this app can't tell the swapped USDC from USDC held before."
        );
    }
    return undefined;
  };
  const refusal = await scan(receipt.blockNumber, latest);
  if (refusal) return refusal;
  // Once more up to the head now, for what mined during the scan.
  const scanned = latest;
  latest = await head();
  return latest > scanned ? scan(scanned + 1n, latest) : undefined;
}

/**
 * Read right before a claim on Ethereum: why the attested message can't be
 * received and sold for USDS now, if anything. A message already received, by
 * anyone, is refused, as is a claim the wrapper can't sell for USDS: the user
 * would end with USDC. A failed read refuses it too.
 */
export async function cctpClaimRefusal({
  message,
  client
}: {
  message: Hex;
  client: PublicClient;
}): Promise<Error | undefined> {
  const { nonce, body } = decodeCctpMessage(message);
  const [minterPaused, transmitterPaused, litePsmDai, live, tin, halted, used, block] = (await Promise.all([
    ...cctpDestinationGateReads.map(read => client.readContract(read as never)),
    client.readContract({
      address: MESSAGE_TRANSMITTER_V2,
      abi: messageTransmitterV2Abi,
      functionName: 'usedNonces',
      args: [nonce]
    }),
    client.getBlockNumber()
  ])) as unknown as [boolean, boolean, bigint, bigint, bigint, bigint, bigint, bigint];
  if (used !== 0n) return finalRefusal('This transfer was already claimed.');
  // The receive mines in a block after the latest one.
  if (isCctpMessageExpired(message, block + 1n))
    return new Error('This attestation has expired; wait for a new one.');
  if (minterPaused || transmitterPaused || !wrapperSells({ live, tin, halted }))
    return new Error('CCTP is paused.');
  if ((body.amount - body.feeExecuted) * USDS_PER_USDC_UNIT > litePsmDai)
    return new Error('There is not enough liquidity to claim this transfer as USDS.');
  return undefined;
}

/**
 * Read right before a settled claim's USDC is sold for USDS on Ethereum: why
 * `amount` USDC can't be converted now, if anything. The wrapper must sell
 * for the full USDS, the LitePSM must hold the DAI and the account the USDC.
 * A failed read refuses it too.
 */
export async function cctpConvertRefusal({
  amount,
  account,
  client
}: {
  amount: bigint;
  account: Address;
  client: PublicClient;
}): Promise<Error | undefined> {
  if (amount <= 0n) return new Error('Nothing to convert.');
  const [litePsmDai, live, tin, halted, usdc] = (await Promise.all([
    ...cctpDestinationGateReads.slice(pausedReads.length).map(read => client.readContract(read as never)),
    client.readContract({ address: L1_USDC, abi: erc20Abi, functionName: 'balanceOf', args: [account] })
  ])) as unknown as [bigint, bigint, bigint, bigint, bigint];
  if (!wrapperSells({ live, tin, halted }))
    return new Error("The wrapper can't convert USDC to USDS right now.");
  if (amount * USDS_PER_USDC_UNIT > litePsmDai)
    return new Error('There is not enough liquidity to convert this USDC to USDS.');
  if (usdc < amount) return new Error('This account holds less USDC than this conversion.');
  return undefined;
}
