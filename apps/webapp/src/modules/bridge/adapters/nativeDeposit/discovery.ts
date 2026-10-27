import { decodeEventLog, getAbiItem, isAddressEqual, type Address, type Hex, type Log } from 'viem';
import { skyL1TokenBridgeImplementationAbi, skyL1TokenGatewayImplementationAbi } from '@/hooks/generated';
import type { ChainReader } from '../types';
import { blockRanges } from '../blockRanges';
import {
  ARBITRUM_DEPOSIT,
  L1_USDS,
  OP_STACK_DEPOSIT,
  type NativeDepositNetwork,
  type OpStackNetworkId
} from './contracts';

/** About 8 days of Ethereum blocks: an Arbitrum ticket's 7-day lifetime and a day of margin. */
export const DISCOVERY_WINDOW_BLOCKS = 57_600n;
/** Ethereum blocks per log query. */
export const DISCOVERY_CHUNK_BLOCKS = 10_000n;

const BRIDGE_INITIATED = getAbiItem({ abi: skyL1TokenBridgeImplementationAbi, name: 'ERC20BridgeInitiated' });
const DEPOSIT_INITIATED = getAbiItem({ abi: skyL1TokenGatewayImplementationAbi, name: 'DepositInitiated' });

const OP_BRIDGES = Object.entries(OP_STACK_DEPOSIT) as [
  OpStackNetworkId,
  (typeof OP_STACK_DEPOSIT)[OpStackNetworkId]
][];

/** A USDS deposit the account sent from Ethereum through one of Sky's native bridges. */
export type DiscoveredDeposit = {
  txHash: Hex;
  blockNumber: bigint;
  to: NativeDepositNetwork;
  amount: bigint;
  recipient: Address;
};

/** Decodes one log as the account's USDS deposit; anything else, from any other contract or token, is undefined. */
function depositInLog(log: Log, account: Address): DiscoveredDeposit | undefined {
  if (!log.transactionHash || log.blockNumber === null || log.removed) return undefined;
  const at = { txHash: log.transactionHash, blockNumber: log.blockNumber };
  try {
    const op = OP_BRIDGES.find(([, contracts]) => isAddressEqual(log.address, contracts.l1TokenBridge));
    if (op) {
      const [network, contracts] = op;
      const { args } = decodeEventLog({ abi: [BRIDGE_INITIATED], data: log.data, topics: log.topics });
      if (
        !isAddressEqual(args.localToken, L1_USDS) ||
        !isAddressEqual(args.remoteToken, contracts.l2Usds) ||
        !isAddressEqual(args.from, account)
      )
        return undefined;
      return { ...at, to: network, amount: args.amount, recipient: args.to };
    }
    if (isAddressEqual(log.address, ARBITRUM_DEPOSIT.l1Gateway)) {
      const { args } = decodeEventLog({ abi: [DEPOSIT_INITIATED], data: log.data, topics: log.topics });
      if (!isAddressEqual(args.l1Token, L1_USDS) || !isAddressEqual(args._from, account)) return undefined;
      return { ...at, to: 'arbitrum', amount: args._amount, recipient: args._to };
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/** The account's USDS deposits among `logs`, one per transaction. */
export function depositsInLogs(logs: Log[], account: Address): DiscoveredDeposit[] {
  const deposits = new Map<string, DiscoveredDeposit>();
  for (const log of logs) {
    const deposit = depositInLog(log, account);
    if (deposit && !deposits.has(deposit.txHash.toLowerCase()))
      deposits.set(deposit.txHash.toLowerCase(), deposit);
  }
  return [...deposits.values()];
}

/**
 * The account's USDS deposits through Sky's native bridges in the last
 * `DISCOVERY_WINDOW_BLOCKS` up to `toBlock`, newest range first. A range
 * whose logs can't be read is skipped and reported in `complete`.
 */
export async function discoverNativeDeposits({
  l1,
  account,
  toBlock
}: {
  l1: Pick<ChainReader, 'getLogs'>;
  account: Address;
  toBlock: bigint;
}): Promise<{ deposits: DiscoveredDeposit[]; complete: boolean }> {
  const first = toBlock > DISCOVERY_WINDOW_BLOCKS ? toBlock - DISCOVERY_WINDOW_BLOCKS : 0n;
  const logs: Log[] = [];
  let complete = true;
  for (const blocks of blockRanges(first, toBlock, DISCOVERY_CHUNK_BLOCKS, { newestFirst: true })) {
    const range = { ...blocks, strict: true } as const;
    try {
      const [bridged, deposited] = await Promise.all([
        l1.getLogs({
          ...range,
          address: OP_BRIDGES.map(([, contracts]) => contracts.l1TokenBridge),
          event: BRIDGE_INITIATED,
          args: { localToken: L1_USDS, from: account }
        }),
        l1.getLogs({
          ...range,
          address: ARBITRUM_DEPOSIT.l1Gateway,
          event: DEPOSIT_INITIATED,
          args: { _from: account }
        })
      ]);
      logs.push(...(bridged as Log[]), ...(deposited as Log[]));
    } catch {
      complete = false;
    }
  }
  return { deposits: depositsInLogs(logs, account), complete };
}
